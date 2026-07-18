import {
  Box,
  Button,
  Flex,
  HStack,
  Spinner,
  Text,
} from '@chakra-ui/react'
import {
  clearTableContext,
  selectDatabase,
  selectTable,
} from '@renderer/features/layout/selectionSession'
import { useDatabaseFiles } from '@renderer/hooks/useDatabaseFiles'
import { useDatabaseTables } from '@renderer/hooks/useDatabaseTables'
import { useTableDataQuery } from '@renderer/hooks/useTableDataQuery'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection, useTableData } from '@renderer/store'
import { useRowEditingStore } from '@renderer/store/useRowEditingStore'
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
  const selectedDevice = useCurrentDeviceSelection(state => state.selectedDevice)
  const selectedApplication = useCurrentDeviceSelection(state => state.selectedApplication)
  const setSelectedDevice = useCurrentDeviceSelection(state => state.setSelectedDevice)
  const setSelectedApplication = useCurrentDeviceSelection(state => state.setSelectedApplication)
  const {
    setTableData,
    clearTableData,
  } = useTableData()
  const setSelectedRow = useRowEditingStore(state => state.setSelectedRow)
  const tableDataStore = useTableData()
  const selectedDatabaseFile = useCurrentDatabaseSelection(state => state.selectedDatabaseFile)
  const setSelectedDatabaseFile = useCurrentDatabaseSelection(state => state.setSelectedDatabaseFile)
  const selectedDatabaseTable = useCurrentDatabaseSelection(state => state.selectedDatabaseTable)
  const setSelectedDatabaseTable = useCurrentDatabaseSelection(state => state.setSelectedDatabaseTable)

  const [isQueryModalOpen, setIsQueryModalOpen] = useState(false)
  const [isSettingCustomFile, setIsSettingCustomFile] = useState(false)
  const queryClient = useQueryClient()

  // Handle custom file setting with proper sequencing
  useEffect(() => {
    if (isSettingCustomFile && selectedDatabaseFile?.deviceType === 'desktop' && selectedDatabaseFile?.packageName === '') {
      // Step 1: Custom file has been set, now clear device/application selections
      console.log('🔧 [SubHeader] Custom file detected, clearing device/application selections')
      setSelectedDevice(null)
      setSelectedApplication(null)
      setSelectedDatabaseTable(null)
      clearTableData()
      setSelectedRow(null)
      
      // Step 2: Mark custom file setting as complete
      setTimeout(() => {
        setIsSettingCustomFile(false)
        console.log('🔧 [SubHeader] Custom file setup complete')
      }, 100)
    }
  }, [clearTableData, isSettingCustomFile, selectedDatabaseFile, setSelectedApplication, setSelectedDatabaseTable, setSelectedDevice, setSelectedRow])

  const {
    data: databaseFiles = [],
    isFirstRoundLoading,
    isBackgroundScanning,
    isScanComplete,
    refetch: refetchDatabaseFiles,
  } = useDatabaseFiles(selectedDevice, selectedApplication)

  const { data: tableData, refetch: refetchTable } = useTableDataQuery(selectedDatabaseTable?.name || '')

  useEffect(() => {
    if (tableData && !tableDataStore.tableData?.isCustomQuery) {
      setTableData({
        rows: tableData.rows,
        columns: tableData.columns,
        isCustomQuery: false,
        tableName: selectedDatabaseTable?.name,
      })
    }
  }, [tableData, selectedDatabaseTable, tableDataStore.tableData?.isCustomQuery])

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
      actions: {
        setSelectedDevice,
        setSelectedApplication,
        setSelectedDatabaseFile,
        setSelectedDatabaseTable,
        clearTableData,
        setSelectedRow,
      },
    })
  }, [clearTableData, queryClient, selectedApplication, selectedDevice, setSelectedDatabaseFile, setSelectedDatabaseTable, setSelectedRow])

  const handleTableChange = useCallback((table) => {    
    console.info('CriticalPath: table selected', {
      tableName: table?.name ?? null,
      databasePath: selectedDatabaseFile?.path ?? null,
    })
    selectTable({
      table,
      actions: {
        setSelectedDevice,
        setSelectedApplication,
        setSelectedDatabaseFile,
        setSelectedDatabaseTable,
        clearTableData,
        setSelectedRow,
        setTableData,
      },
    })
  }, [selectedDatabaseFile?.path, setSelectedDatabaseTable, setTableData])

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

    return dbFileOptions
      .flatMap(group => group.options)
      .find(file =>
        file.path === selectedDatabaseFile.path
        || (selectedDatabaseFile.remotePath && file.remotePath === selectedDatabaseFile.remotePath),
      ) ?? null
  }, [dbFileOptions, selectedDatabaseFile])

  const selectedDatabaseTableOption = useMemo(() => {
    if (!selectedDatabaseTable) {
      return null
    }

    return tableOptions.find(table => table.name === selectedDatabaseTable.name) ?? null
  }, [selectedDatabaseTable, tableOptions])

  // Handler to clear custom query and show default table rows
  const handleClearCustomQuery = useCallback(() => {
    if (!selectedDatabaseTable) 
      return
    refetchTable()
    tableDataStore.setTableData({
      rows: [],
      columns: [],
      isCustomQuery: false,
      customQuery: '',
      tableName: selectedDatabaseTable.name,
    })
  }, [selectedDatabaseTable, tableDataStore, refetchTable])

  useEffect(() => {
    if (!selectedDatabaseFile?.filename) {
      clearTableContext({
        setSelectedDevice,
        setSelectedApplication,
        setSelectedDatabaseFile,
        setSelectedDatabaseTable,
        clearTableData,
        setSelectedRow,
      })
    }
  }, [clearTableData, selectedDatabaseFile, setSelectedApplication, setSelectedDatabaseFile, setSelectedDatabaseTable, setSelectedDevice, setSelectedRow])

  const onRefreshClick = useCallback(async () => {
    console.info('CriticalPath: database refresh started', {
      deviceId: selectedDevice?.id ?? null,
      bundleId: selectedApplication?.bundleId ?? null,
      databasePath: selectedDatabaseFile?.path ?? null,
      tableName: selectedDatabaseTable?.name ?? null,
    })

    if (selectedDevice?.deviceType === 'iphone-device') {
      selectDatabase({
        databaseFile: null,
        actions: {
          setSelectedDevice,
          setSelectedApplication,
          setSelectedDatabaseFile,
          setSelectedDatabaseTable,
          clearTableData,
          setSelectedRow,
        },
      })
    }

    await refreshDatabase({
      refetchDatabaseFiles,
      refetchDatabaseTables: selectedDevice?.deviceType === 'iphone-device' ? undefined : refetchDatabaseTables,
      refetchTable: selectedDevice?.deviceType === 'iphone-device' ? undefined : refetchTable,
    })
    console.info('CriticalPath: database refresh finished', {
      databasePath: selectedDatabaseFile?.path ?? null,
      tableName: selectedDatabaseTable?.name ?? null,
    })
  }, [
    clearTableData,
    refetchDatabaseFiles,
    refetchDatabaseTables,
    refetchTable,
    selectedApplication?.bundleId,
    selectedDatabaseFile?.path,
    selectedDatabaseTable?.name,
    selectedDevice?.deviceType,
    selectedDevice?.id,
    setSelectedDatabaseFile,
    setSelectedDatabaseTable,
    setSelectedRow,
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
        console.info('CriticalPath: custom database file opened', {
          filePath,
        })

        // Set custom file flag and database file
        setIsSettingCustomFile(true)
        console.log('🔧 [SubHeader] Setting custom file:', filePath)

        setSelectedDatabaseFile({
          path: filePath,
          filename: filePath.split('/').pop() || '',
          deviceType: 'desktop',
          packageName: '',
          remotePath: filePath,
          location: filePath,
        })
      }
    })
  }, [setSelectedDatabaseFile])

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

  const isTableSelectDisabled = (!selectedApplication?.bundleId && selectedDatabaseFile?.deviceType !== 'desktop') || !selectedDatabaseFile?.path || isDBPulling

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
          {selectedDatabaseFile?.deviceType === 'desktop'
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
            {tableDataStore.tableData?.isCustomQuery && (
              <Button
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
