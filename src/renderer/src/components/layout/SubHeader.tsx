import {
  Box,
  Button,
  Flex,
  HStack,
  Spinner,
  Text,
} from '@chakra-ui/react'
import { useDatabaseFiles } from '@renderer/hooks/useDatabaseFiles'
import { useDatabaseTables } from '@renderer/hooks/useDatabaseTables'
import { useTableDataQuery } from '@renderer/hooks/useTableDataQuery'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection, useTableData } from '@renderer/store'
import { toaster } from '@renderer/ui/toaster'
import { useDatabaseRefresh } from '@renderer/utils/databaseRefresh'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { LuDatabase, LuFilter, LuFolderOpen, LuRefreshCcw, LuTable, LuUpload, LuX } from 'react-icons/lu'
import { CustomQueryModal } from '../data/CustomQueryModal'
import FLSelect from './../common/FLSelect'

export function SubHeader() {
  const selectedDevice = useCurrentDeviceSelection(state => state.selectedDevice)
  const selectedApplication = useCurrentDeviceSelection(state => state.selectedApplication)
  const {
    setTableData,
  } = useTableData()
  const tableDataStore = useTableData()
  const selectedDatabaseFile = useCurrentDatabaseSelection(state => state.selectedDatabaseFile)
  const setSelectedDatabaseFile = useCurrentDatabaseSelection(state => state.setSelectedDatabaseFile)
  const selectedDatabaseTable = useCurrentDatabaseSelection(state => state.selectedDatabaseTable)
  const setSelectedDatabaseTable = useCurrentDatabaseSelection(state => state.setSelectedDatabaseTable)

  const [isQueryModalOpen, setIsQueryModalOpen] = useState(false)

  console.log('SubHeader selectedDevice:', selectedDevice, selectedApplication)

  const {
    data: databaseFiles = [],
    isLoading,
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

  const isDBPulling = !!selectedApplication?.bundleId && !!selectedDevice?.id && isLoading

  const {
    data: tablesData,
    isError,
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

  console.log('Selected tablesData file:', !selectedDatabaseFile?.path, !selectedApplication?.bundleId, isDBPulling)
  const handleDatabaseFileChange = useCallback((file) => {
    setSelectedDatabaseFile(file)
    setSelectedDatabaseTable(null)
  }, [setSelectedDatabaseFile, setSelectedDatabaseTable])

  const handleTableChange = useCallback((table) => {
    setSelectedDatabaseTable(table)
  }, [setSelectedDatabaseTable])

  const dbFileOptions = useMemo(() =>
    databaseFiles?.map(file => ({
      label: file.filename,
      value: file.path,
      ...file,
    })) ?? [], [databaseFiles])

  const tableOptions = useMemo(() =>
    databaseTables?.map(table => ({
      label: table.name,
      value: table.name,
      ...table,
    })) ?? [], [databaseTables])

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
      setSelectedDatabaseTable(null)
    }
  }, [selectedDatabaseFile])

  const handleDBRefresh = useDatabaseRefresh()

  const onRefreshClick = useCallback(async () => {
    await handleDBRefresh()
  }, [handleDBRefresh])

  const isNoDB = !databaseFiles?.length && !isDBPulling && selectedApplication?.bundleId && selectedDevice?.id

  const handleOpenDBFile = useCallback(() => {
    window.api.openFile().then((file) => {
      if (!file.canceled && file.filePaths.length) {
        const filePath = file.filePaths[0]
        console.log('FILELE', filePath)
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

    window.api.exportFile({
      defaultPath: selectedDatabaseFile?.filename,
      filters: [
        {
          name: 'Database Files',
          extensions: ['db', 'sqlite'],
        },
      ],
      dbFilePath: selectedDatabaseFile.path,
    }).then((savedFilePath) => {
      if (!savedFilePath) {
        return
      }
      toaster.create({
        title: 'Success',
        description: `Database file exported successfully to ${savedFilePath}`,
        type: 'success',
      })
    }).catch((error) => {
      toaster.create({
        title: 'Error exporting database',
        description: error.message,
        type: 'error',
      })
    },
    )
  }, [selectedDatabaseFile])

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
                <FLSelect
                  label="Select Database"
                  options={dbFileOptions}
                  value={selectedDatabaseFile}
                  icon={<LuDatabase color="var(--chakra-colors-flipioPrimary)" />}
                  onChange={handleDatabaseFileChange}
                  isDisabled={!selectedApplication?.bundleId || isDBPulling}
                />
              )}

          <Box>
            <FLSelect
              label="Select Table"
              options={tableOptions}
              value={selectedDatabaseTable}
              icon={<LuTable color="var(--chakra-colors-flipioPrimary)" />}
              onChange={handleTableChange}
              isDisabled={!selectedDatabaseFile?.path || isDBPulling}
            />
          </Box>

          <Button
            data-testid="refresh-db"
            data-state={isLoading ? 'open' : 'closed'}
            onClick={onRefreshClick}
            variant="ghost"
            size="sm"
            color="textSecondary"
            _hover={{
              bg: 'bgTertiary',
              color: 'flipioPrimary',
            }}
            disabled={isLoading || !selectedDatabaseTable}
            _disabled={{
              opacity: 0.5,
            }}
            _open={{
              animationName: 'rotate',
              animationDuration: '1100ms',
            }}
            title="Refresh database"
          >
            <LuRefreshCcw size={16} />
          </Button>

          {isDBPulling && (
            <Spinner size="sm" color="flipioPrimary" />
          )}

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
