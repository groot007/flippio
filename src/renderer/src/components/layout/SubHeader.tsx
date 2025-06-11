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
import { api } from '@renderer/lib/api-adapter'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection, useTableData } from '@renderer/store'
import { toaster } from '@renderer/ui/toaster'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { LuDatabase, LuFilter, LuFolderOpen, LuRefreshCcw, LuTable, LuUpload } from 'react-icons/lu'
import { useDevices } from '../../hooks/useDevices'
import { CustomQueryModal } from '../data/CustomQueryModal'
import FLSelect from './../common/FLSelect'

export function SubHeader() {
  const selectedDevice = useCurrentDeviceSelection(state => state.selectedDevice)
  const selectedApplication = useCurrentDeviceSelection(state => state.selectedApplication)
  const {
    setTableData,
  } = useTableData()
  const selectedDatabaseFile = useCurrentDatabaseSelection(state => state.selectedDatabaseFile)
  const setSelectedDatabaseFile = useCurrentDatabaseSelection(state => state.setSelectedDatabaseFile)
  const selectedDatabaseTable = useCurrentDatabaseSelection(state => state.selectedDatabaseTable)
  const setSelectedDatabaseTable = useCurrentDatabaseSelection(state => state.setSelectedDatabaseTable)

  const [isQueryModalOpen, setIsQueryModalOpen] = useState(false)

  const {
    data: databaseFiles = [],
    isLoading,
    refetch: refetchDatabaseFiles,
  } = useDatabaseFiles(selectedDevice, selectedApplication)

  const { data: tableData, refetch: refetchTable } = useTableDataQuery(selectedDatabaseTable?.name || '')

  useEffect(() => {
    if (tableData) {
      setTableData({
        rows: tableData.rows,
        columns: tableData.columns,
      })
    }
  }, [tableData])

  const isDBPulling = !!selectedApplication?.bundleId && !!selectedDevice?.id && isLoading

  const {
    data: tablesData,
    refetch: refetchDatabaseTables,
    isError,
  } = useDatabaseTables(selectedDatabaseFile, selectedDevice)

  useEffect(() => {
    if (isError) {
      toaster.create({
        title: 'Error fetching database tables',
        description: 'Failed to fetch tables for the selected database file.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }, [isError])

  const databaseTables = tablesData?.tables

  const handleDatabaseFileChange = useCallback((file) => {
    setSelectedDatabaseFile(file)
    setSelectedDatabaseTable(null)
  }, [databaseFiles, setSelectedDatabaseFile])

  const handleTableChange = useCallback((table) => {
    setSelectedDatabaseTable(table)
  }, [databaseTables, setSelectedDatabaseTable])

  const dbFileOptions = useMemo(() => {
    const opts = databaseFiles?.map(file => ({
      label: file.filename,
      value: file.path,
      ...file,
    })) ?? []
    console.error('[SubHeader] dbFileOptions', opts, databaseFiles)
    return opts
  }, [databaseFiles])

  const tableOptions = useMemo(() => {
    const opts = databaseTables?.map(table => ({
      label: table.name,
      value: table.name,
      ...table,
    })) ?? []
    console.error('[SubHeader] tableOptions', opts, databaseTables)
    return opts
  }, [databaseTables])

  useEffect(() => {
    if (!selectedDatabaseFile?.filename) {
      setSelectedDatabaseTable(null)
    }
  }, [selectedDatabaseFile])

  const handleDBRefresh = useCallback(async () => {
    await refetchDatabaseFiles()
      .then(() => {
        toaster.create({
          title: 'Success',
          description: 'Database refreshed',
          status: 'success',
          duration: 3000,
          isClosable: true,
        })
      })
      .catch((err) => {
        toaster.create({
          title: 'Error refreshing database',
          description: err.message,
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
      })
    await refetchDatabaseTables()
    await refetchTable()
  }, [])

  const isNoDB = !databaseFiles?.length && !isDBPulling && selectedApplication?.bundleId && selectedDevice?.id

  const handleOpenDBFile = useCallback(async () => {
    const file = await api.openFile?.()
    if (!file?.canceled && file?.filePaths?.length) {
      const filePath = file.filePaths[0]
      setSelectedDatabaseFile({
        path: filePath,
        filename: filePath.split('/').pop() || '',
        deviceType: 'desktop',
        packageName: '',
        remotePath: filePath,
      })
    }
  }, [setSelectedDatabaseFile])

  const handleExportDB = useCallback(async () => {
    if (!selectedDatabaseFile?.path) {
      return
    }

    const savedFilePath = await api.exportFile?.({
      defaultPath: selectedDatabaseFile?.filename,
      filters: [
        {
          name: 'Database Files',
          extensions: ['db', 'sqlite'],
        },
      ],
      dbFilePath: selectedDatabaseFile.path,
    })
    if (!savedFilePath) {
      return
    }
    toaster.create({
      title: 'Success',
      description: `Database file exported successfully to ${savedFilePath}`,
      status: 'success',
    })
  }, [selectedDatabaseFile])

  const {
    isLoading: isDevicesLoading,
    data: devices = [],
  } = useDevices()

  // Debug logging for devices
  console.log('🔍 SubHeader Debug - devices:', devices)
  console.log('🔍 SubHeader Debug - devices length:', devices.length)
  console.log('🔍 SubHeader Debug - first device:', devices[0])
  console.log('🔍 SubHeader Debug - selectedDevice:', selectedDevice)

  useEffect(() => {
    console.error('[SubHeader] selectedDatabaseFile', selectedDatabaseFile)
    console.error('[SubHeader] selectedDatabaseTable', selectedDatabaseTable)
  }, [selectedDatabaseFile, selectedDatabaseTable])

  return (
    <Box
      width="full"
      pb={3}
      px={4}
      borderBottomWidth="1px"
      borderColor="app.border"
      bg="app.subheader.bg"
    >
      {isNoDB
        ? (
            <Box
              width="full"
              pb={7}
            >
              <Text fontWeight="medium" color="red.400">
                No database files available
              </Text>
            </Box>
          )
        : null}
      <Flex justifyContent="flex-start" alignItems="center">
        <HStack direction="row" gap={5}>
          {selectedDatabaseFile?.deviceType === 'desktop'
            ? (
                <Text fontSize="x-small" maxWidth={300}>
                  {selectedDatabaseFile?.path}
                </Text>
              )
            : (
                <FLSelect
                  label="Select Database"
                  options={dbFileOptions}
                  value={selectedDatabaseFile}
                  icon={<LuDatabase color="#47d5c9" />}
                  onChange={handleDatabaseFileChange}
                  isDisabled={!selectedApplication?.bundleId || isDBPulling}
                />
              )}

          <Box>
            <FLSelect
              label="Select Table"
              options={tableOptions}
              value={selectedDatabaseTable}
              icon={<LuTable color="#47d5c9" />}
              onChange={handleTableChange}
              isDisabled={!selectedDatabaseFile?.path || !selectedApplication?.bundleId || isDBPulling}
            />
          </Box>
          <Button
            data-testid="refresh-db"
            data-state={isLoading ? 'open' : 'closed'}
            onClick={handleDBRefresh}
            bg="transparent"
            color="flipioSecondary"

            _hover={{
              opacity: 0.8,
            }}
            disabled={isLoading}
            _open={{
              animationName: 'rotate',
              animationDuration: '1100ms',
            }}
          >
            <LuRefreshCcw />
          </Button>
          {isDBPulling && (
            <Spinner size="sm" color="blue.500" />
          )}

          <Button onClick={() => setIsQueryModalOpen(true)} variant="outline" size="xs" color="flipioPrimary" borderColor="flipioPrimary" disabled={!selectedDatabaseFile?.path}>
            SQL
            {' '}
            <LuFilter />
          </Button>

        </HStack>
        <HStack
          ml="auto"
          gap={2}
        >
          <Button onClick={handleOpenDBFile} variant="plain" size="xs" color="flipioPrimary" borderColor="flipioPrimary">
            <LuFolderOpen />
            {' '}
            Open DB
          </Button>

          <Button onClick={handleExportDB} variant="outline" size="xs" color="flipioPrimary" borderColor="flipioPrimary" disabled={!selectedDatabaseFile?.path}>
            <LuUpload />
            {' '}
            Export
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
