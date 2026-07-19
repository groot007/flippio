import {
  Box,
  Button,
  Flex,
  HStack,
  Spinner,
  Text,
} from '@chakra-ui/react'
import {
  matchSelectedDatabaseFile,
  matchSelectedDatabaseTable,
  reconcileActiveDatabaseFile,
  reconcileSelectionWithDatabaseFiles,
  selectDatabase,
  selectDesktopDatabase,
  selectTable,
} from '@renderer/features/layout/selectionSession'
import { useSelectionSessionActions } from '@renderer/features/layout/useSelectionSessionActions'
import { useSelectionSessionState } from '@renderer/features/layout/useSelectionSessionState'
import { useSelectionSessionTableState } from '@renderer/features/layout/useSelectionSessionTableState'
import { useSubHeaderSelectionEffects } from '@renderer/features/layout/useSubHeaderSelectionEffects'
import { useDatabaseFiles } from '@renderer/hooks/useDatabaseFiles'
import { useDatabaseTables } from '@renderer/hooks/useDatabaseTables'
import { useTableDataQuery } from '@renderer/hooks/useTableDataQuery'
import { toaster } from '@renderer/ui/toaster'
import { groupDatabaseFilesByLocation } from '@renderer/utils/databaseFileGrouping'
import { ensureActiveDatabaseFile } from '@renderer/utils/databaseFileResolver'
import { refreshDatabase } from '@renderer/utils/databaseRefresh'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { LuDatabase, LuFilter, LuFolderOpen, LuRefreshCcw, LuTable, LuUpload, LuX } from 'react-icons/lu'
import { CustomQueryModal } from '../data/CustomQueryModal'
import FLSelect from './../common/FLSelect'

export function SubHeader() {
  const {
    isDesktopMode,
    selectedApplication,
    selectedDatabaseFile,
    selectedDatabaseTable,
    selectedDevice,
  } = useSelectionSessionState()
  const {
    setTableData,
    tableData: sessionTableData,
    setIsRefreshingTableData,
    setSelectedDatabaseFile,
  } = useSelectionSessionTableState()
  const selectionActions = useSelectionSessionActions()

  const [isQueryModalOpen, setIsQueryModalOpen] = useState(false)
  const queryClient = useQueryClient()

  const {
    data: databaseFiles = [],
    isFirstRoundLoading,
    isBackgroundScanning,
    isScanComplete,
    refetch: refetchDatabaseFiles,
  } = useDatabaseFiles(selectedDevice, selectedApplication)

  const { data: queriedTableData, refetch: refetchTable } = useTableDataQuery(selectedDatabaseTable?.name || '')

  useEffect(() => {
    if (queriedTableData && !sessionTableData?.isCustomQuery) {
      setTableData({
        rows: queriedTableData.rows,
        columns: queriedTableData.columns,
        isCustomQuery: false,
        tableName: selectedDatabaseTable?.name,
      })
    }
  }, [queriedTableData, selectedDatabaseTable, sessionTableData?.isCustomQuery, setTableData])

  const isDBPulling = !!selectedApplication?.bundleId && !!selectedDevice?.id && isFirstRoundLoading

  const {
    data: tablesData,
    isError,
    refetch: refetchDatabaseTables,
  } = useDatabaseTables(selectedDatabaseFile, selectedDevice)

  useEffect(() => {
    if (isError) {
      toaster.create({
        title: 'Error fetching database tables',
        description: 'Failed to fetch tables for the selected database file.',
        type: 'error',
        duration: 3000,
      })
    }
  }, [isError])

  const databaseTables = tablesData?.tables

  const handleDatabaseFileChange = useCallback(async (file) => {
    const resolvedFile = file?.path
      ? await ensureActiveDatabaseFile({
          databaseFile: file,
          selectedDevice,
          selectedApplication,
          queryClient,
          setSelectedDatabaseFile: undefined,
        })
      : file

    console.info('CriticalPath: database file selected', {
      path: resolvedFile?.path ?? null,
      filename: resolvedFile?.filename ?? null,
      deviceType: resolvedFile?.deviceType ?? null,
    })
    // Call database switch cleanup if we have a file path
    if (resolvedFile?.path) {
      try {
        await window.api.switchDatabase(resolvedFile.path)
        console.log('Database switch cleanup completed for:', resolvedFile.path)
      }
      catch (error) {
        console.warn('Database switch cleanup failed (non-critical):', error)
      }
    }
    
    selectDatabase({
      databaseFile: resolvedFile,
      currentApplication: selectedApplication,
      currentDevice: selectedDevice,
      actions: selectionActions,
    })
  }, [queryClient, selectedApplication, selectedDevice, selectionActions])

  const handleTableChange = useCallback((table) => {    
    console.info('CriticalPath: table selected', {
      tableName: table?.name ?? null,
      databasePath: selectedDatabaseFile?.path ?? null,
    })
    selectTable({
      currentApplication: selectedApplication,
      currentDatabaseFile: selectedDatabaseFile,
      currentDevice: selectedDevice,
      table,
      actions: selectionActions,
    })
  }, [selectedApplication, selectedDatabaseFile, selectedDevice, selectionActions])

  const dbFileOptions = useMemo(() => 
    groupDatabaseFilesByLocation(databaseFiles), [databaseFiles])

  const tableOptions = useMemo(() =>
    databaseTables?.map(table => ({
      label: table.name,
      value: table.name,
      ...table,
    })) ?? [], [databaseTables])

  const selectedDatabaseFileOption = useMemo(() => {
    if (!selectedDatabaseFile) {
      return null
    }

    const flattenedDatabaseFiles = dbFileOptions.flatMap(group => group.options)

    return matchSelectedDatabaseFile(flattenedDatabaseFiles, selectedDatabaseFile)
  }, [dbFileOptions, selectedDatabaseFile])

  const selectedDatabaseTableOption = useMemo(() => {
    if (!selectedDatabaseTable) {
      return null
    }

    return matchSelectedDatabaseTable(tableOptions, selectedDatabaseTable)
  }, [selectedDatabaseTable, tableOptions])

  // Handler to clear custom query and show default table rows
  const handleClearCustomQuery = useCallback(() => {
    if (!selectedDatabaseTable) 
      return
    refetchTable()
    setTableData({
      rows: [],
      columns: [],
      isCustomQuery: false,
      customQuery: '',
      tableName: selectedDatabaseTable.name,
    })
  }, [refetchTable, selectedDatabaseTable, setTableData])

  useSubHeaderSelectionEffects({
    databaseFiles: dbFileOptions,
    databaseTables: tableOptions,
    isDatabaseFilesScanning: selectedDevice?.deviceType === 'iphone-device' && (isFirstRoundLoading || isBackgroundScanning),
    isDesktopMode,
    selectedApplication,
    selectedDatabaseFile,
    selectedDatabaseTable,
    selectedDevice,
    selectionActions,
  })

  const onRefreshClick = useCallback(async () => {
    const shouldRefreshCurrentTable = !!selectedDatabaseFile?.path && !!selectedDatabaseTable?.name
    const shouldPrioritizeSelectedIosDb = selectedDevice?.deviceType === 'iphone-device'
      && !!selectedDevice?.id
      && !!selectedApplication?.bundleId
      && !!selectedDatabaseFile?.remotePath

    console.info('CriticalPath: database refresh started', {
      deviceId: selectedDevice?.id ?? null,
      bundleId: selectedApplication?.bundleId ?? null,
      databasePath: selectedDatabaseFile?.path ?? null,
      tableName: selectedDatabaseTable?.name ?? null,
    })

    if (shouldRefreshCurrentTable) {
      setIsRefreshingTableData(true)
    }

    try {
      if (shouldPrioritizeSelectedIosDb) {
        const refreshResult = await window.api.refreshIOSDeviceDatabaseFile(
          selectedDevice.id,
          selectedApplication.bundleId,
          selectedDatabaseFile.remotePath!,
        )

        if (!refreshResult.success || !refreshResult.file) {
          throw new Error(refreshResult.error || 'Failed to refresh selected database file')
        }

        const refreshedSelectedDatabaseFile = refreshResult.file
        const { activeDatabaseFile } = reconcileActiveDatabaseFile(
          {
            databaseFile: refreshedSelectedDatabaseFile,
            selectedApplication,
            selectedDatabaseFile,
            selectedDatabaseTable,
            selectedDevice,
          },
          selectionActions,
        )

        await ensureActiveDatabaseFile({
          databaseFile: activeDatabaseFile,
          selectedDevice,
          selectedApplication,
          queryClient,
          setSelectedDatabaseFile,
        })

        if (refetchDatabaseTables) {
          await refetchDatabaseTables()
        }

        if (selectedDatabaseTable?.name && refetchTable) {
          await refetchTable()
        }

        toaster.create({
          title: 'Success',
          description: 'Current database refreshed',
          type: 'success',
          duration: 3000,
        })

        void refetchDatabaseFiles().catch((error) => {
          console.error('Error refreshing background database list:', error)
        })

        console.info('CriticalPath: database refresh finished', {
          databasePath: refreshedSelectedDatabaseFile.path ?? null,
          tableName: selectedDatabaseTable?.name ?? null,
        })

        return
      }

      const refreshedDatabaseFilesResult = await refreshDatabase({
        refetchDatabaseFiles,
        refetchDatabaseTables: selectedDevice?.deviceType === 'iphone-device' ? undefined : refetchDatabaseTables,
        refetchTable: selectedDevice?.deviceType === 'iphone-device' ? undefined : refetchTable,
        showSuccessToast: !shouldRefreshCurrentTable && selectedDevice?.deviceType !== 'iphone-device',
      })

      if (
        selectedDevice?.deviceType === 'iphone-device'
        && selectedDatabaseFile
        && selectedApplication?.bundleId
      ) {
        const refreshedFiles = refreshedDatabaseFilesResult?.data ?? []
        const { matchedDatabaseFile } = reconcileSelectionWithDatabaseFiles(
          {
            databaseFiles: refreshedFiles,
            selectedApplication,
            selectedDatabaseFile,
            selectedDatabaseTable,
            selectedDevice,
          },
          selectionActions,
        )
        const activeDatabaseFile = matchedDatabaseFile ?? selectedDatabaseFile

        await ensureActiveDatabaseFile({
          databaseFile: activeDatabaseFile,
          selectedDevice,
          selectedApplication,
          queryClient,
          setSelectedDatabaseFile,
        })

        if (refetchDatabaseTables) {
          await refetchDatabaseTables()
        }

        if (selectedDatabaseTable?.name && refetchTable) {
          await refetchTable()
        }
      }

      if (shouldRefreshCurrentTable) {
        toaster.create({
          title: 'Success',
          description: 'Database refreshed',
          type: 'success',
          duration: 3000,
        })
      }

      console.info('CriticalPath: database refresh finished', {
        databasePath: selectedDatabaseFile?.path ?? null,
        tableName: selectedDatabaseTable?.name ?? null,
      })
    }
    catch (error) {
      if (shouldRefreshCurrentTable) {
        setIsRefreshingTableData(false)
      }

      console.error('CriticalPath: database refresh failed', error)
      toaster.create({
        title: 'Error refreshing database',
        description: error instanceof Error ? error.message : 'Failed to refresh database',
        type: 'error',
        duration: 4000,
      })
    }
  }, [
    refetchDatabaseFiles,
    refetchDatabaseTables,
    refetchTable,
    queryClient,
    selectionActions,
    selectedApplication?.bundleId,
    selectedDatabaseFile?.path,
    selectedDatabaseFile?.remotePath,
    selectedDatabaseFile,
    selectedDatabaseTable?.name,
    selectedDevice?.deviceType,
    selectedDevice?.id,
    setIsRefreshingTableData,
    setSelectedDatabaseFile,
  ])

  const isNoDB = !databaseFiles?.length && isScanComplete && selectedApplication?.bundleId && selectedDevice?.id

  const databaseMenuFooter = (isFirstRoundLoading || isBackgroundScanning)
    ? (
        <HStack px={3} py={2}>
          <Text fontSize="xs" color="textSecondary">
            {isFirstRoundLoading ? 'Scanning Documents...' : 'Scanning more folders...'}
          </Text>
          <Spinner size="xs" color="flipioPrimary" />
        </HStack>
      )
    : undefined

  const handleOpenDBFile = useCallback(() => {
    window.api.openFile().then((file) => {
      if (!file.canceled && file.filePaths.length) {
        const filePath = file.filePaths[0]
        const desktopDatabaseFile = {
          path: filePath,
          filename: filePath.split('/').pop() || '',
          deviceType: 'desktop' as const,
          packageName: '',
          remotePath: filePath,
          location: filePath,
        }

        console.info('CriticalPath: custom database file opened', {
          filePath,
        })

        selectDesktopDatabase({
          actions: selectionActions,
          databaseFile: desktopDatabaseFile,
        })
      }
    })
  }, [selectionActions])

  const handleExportDB = useCallback(() => {
    if (!selectedDatabaseFile?.path) {
      return
    }

    console.info('CriticalPath: database export started', {
      databasePath: selectedDatabaseFile.path,
      filename: selectedDatabaseFile.filename,
    })

    window.api.exportFile({
      defaultPath: selectedDatabaseFile?.filename,
      filters: [
        {
          name: selectedDatabaseFile?.filename || 'Database',
          extensions: ['db', 'sqlite'],
        },
      ],
      dbFilePath: selectedDatabaseFile.path,
    }).then((savedFilePath) => {
      if (!savedFilePath) {
        return
      }
      console.info('CriticalPath: database export completed', {
        databasePath: selectedDatabaseFile.path,
        savedFilePath,
      })
      toaster.create({
        title: 'Success',
        description: `Database file exported successfully to ${savedFilePath}`,
        type: 'success',
      })
    }).catch((error) => {
      console.error('CriticalPath: database export failed', error)
      toaster.create({
        title: 'Error exporting database',
        description: error.message,
        type: 'error',
      })
    },
    )
  }, [selectedDatabaseFile])

  const isTableSelectDisabled = (!selectedApplication?.bundleId && !isDesktopMode) || !selectedDatabaseFile?.path || isDBPulling

  return (
    <Box
      width="full"
      py={4}
      px={6}
      borderBottomWidth="1px"
      borderColor="borderPrimary"
      bg="bgSecondary"
    >
      {isNoDB
        ? (
            <Box
              width="full"
              pb={4}
            >
              <Text fontSize="sm" fontWeight="medium" color="error">
                No database files available
              </Text>
            </Box>
          )
        : null}
      <Flex justifyContent="flex-start" alignItems="center">
        <HStack gap={4}>
          {isDesktopMode
            ? (
                <Text
                  fontSize="xs"
                  maxWidth={300}
                  color="textSecondary"
                  fontFamily="mono"
                  bg="bgTertiary"
                  px={2}
                  py={1}
                  borderRadius="sm"
                >
                  {selectedDatabaseFile?.path}
                </Text>
              )
            : (
                <Box>
                  <FLSelect
                    testId="database-file-select"
                    label="Select Database"
                    options={dbFileOptions}
                    value={selectedDatabaseFileOption}
                    icon={<LuDatabase color="var(--chakra-colors-flipioPrimary)" />}
                    onChange={handleDatabaseFileChange}
                    isDisabled={!selectedApplication?.bundleId || isDBPulling}
                    menuListWidth={300}
                    menuFooter={databaseMenuFooter}
                  />
                </Box>
              )}

          <Box>
            <FLSelect
              testId="table-select"
              label="Select Table"
              options={tableOptions}
              value={selectedDatabaseTableOption}
              icon={<LuTable color="var(--chakra-colors-flipioPrimary)" />}
              onChange={handleTableChange}
              isDisabled={isTableSelectDisabled}
            />
          </Box>

          <Button
            data-testid="refresh-db"
            data-state={isFirstRoundLoading ? 'open' : 'closed'}
            onClick={onRefreshClick}
            variant="ghost"
            size="sm"
            color="textSecondary"
            _hover={{
              bg: 'bgTertiary',
              color: 'flipioPrimary',
            }}
            disabled={isFirstRoundLoading || !selectedDatabaseFile?.path}
            _disabled={{
              opacity: 0.5,
            }}
            _open={{
              animationName: 'rotate',
              animationIterationCount: 'infinite',
              animationDuration: '1100ms',
            }}
            title="Refresh database"
          >
            <LuRefreshCcw size={16} />
          </Button>

          <HStack>
            {/* Show SQL button always */}
            <Button
              data-testid="sql-button"
              onClick={() => setIsQueryModalOpen(true)}
              variant="outline"
              size="sm"
              color="flipioPrimary"
              borderColor="borderPrimary"
              _hover={{
                borderColor: 'flipioPrimary',
                bg: 'bgTertiary',
              }}
              disabled={!selectedDatabaseFile?.path}
              fontSize="xs"
              fontWeight="medium"
            >
              <LuFilter size={14} />
              <Text ml={1}>SQL</Text>
            </Button>

            {/* Show clear (times) icon if a custom query is active */}
            {sessionTableData?.isCustomQuery && (
              <Button
                data-testid="clear-sql-button"
                onClick={handleClearCustomQuery}
                variant="ghost"
                size="sm"
                color="red.400"
                fontSize="xs"
                fontWeight="medium"
                p={0}
                title="Clear SQL query and show default table rows"
                _hover={{ bg: 'bgTertiary', color: 'red.600' }}
              >
                <LuX size={12} />
              </Button>
            )}
          </HStack>

        </HStack>
        <HStack
          ml="auto"
          gap={3}
        >
          <Button
            data-testid="open-db-button"
            onClick={handleOpenDBFile}
            variant="ghost"
            size="sm"
            color="flipioPrimary"
            fontSize="xs"
            fontWeight="medium"
            _hover={{
              bg: 'bgTertiary',
            }}
          >
            <LuFolderOpen size={14} />
            <Text ml={1}>Open</Text>
          </Button>

          <Button
            data-testid="export-db-button"
            onClick={handleExportDB}
            variant="outline"
            size="sm"
            color="flipioPrimary"
            borderColor="borderPrimary"
            _hover={{
              borderColor: 'flipioPrimary',
              bg: 'bgTertiary',
            }}
            disabled={!selectedDatabaseFile?.path}
            fontSize="xs"
            fontWeight="medium"
          >
            <LuUpload size={14} />
            <Text ml={1}>Export</Text>
          </Button>
        </HStack>
      </Flex>
      <CustomQueryModal
        isOpen={isQueryModalOpen}
        onClose={() => {
          setIsQueryModalOpen(false)
        }}
      />
    </Box>
  )
}
