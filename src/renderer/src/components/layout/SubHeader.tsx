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
import { useCurrentDatabaseSelection, useCurrentDeviceSelection } from '@renderer/store'
import { toaster } from '@renderer/ui/toaster'
import { useCallback, useEffect, useMemo } from 'react'
import FLSelect from './../common/FLSelect'

export function SubHeader() {
  const selectedDevice = useCurrentDeviceSelection(state => state.selectedDevice)
  const selectedApplication = useCurrentDeviceSelection(state => state.selectedApplication)

  const selectedDatabaseFile = useCurrentDatabaseSelection(state => state.selectedDatabaseFile)
  const setSelectedDatabaseFile = useCurrentDatabaseSelection(state => state.setSelectedDatabaseFile)
  const selectedDatabaseTable = useCurrentDatabaseSelection(state => state.selectedDatabaseTable)
  const setSelectedDatabaseTable = useCurrentDatabaseSelection(state => state.setSelectedDatabaseTable)

  const {
    databaseFiles,
    isLoading,
  } = useDatabaseFiles(selectedDevice, selectedApplication)

  const isDBPulling = !!selectedApplication?.bundleId && !!selectedDevice?.id && isLoading

  const {
    tables: databaseTables,
  } = useDatabaseTables(selectedDatabaseFile, selectedDevice)

  const handleDatabaseFileChange = useCallback((file) => {
    setSelectedDatabaseFile(file)
    setSelectedDatabaseTable(null)
  }, [databaseFiles, setSelectedDatabaseFile])

  const handleTableChange = useCallback((table) => {
    setSelectedDatabaseTable(table)
  }, [databaseTables, setSelectedDatabaseTable])

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

  useEffect(() => {
    if (!selectedDatabaseFile?.filename) {
      setSelectedDatabaseTable(null)
    }
  }, [selectedDatabaseFile])

  const isNoDB = !databaseFiles?.length && !isDBPulling && selectedApplication?.bundleId && selectedDevice?.id

  // const handleQueryExecution = useCallback(async () => {
  //   const data = await window.api.executeQuery('SELECT * FROM config')
  //   console.log('handleQueryExecution__', data)
  // }, [])

  const handleOpenDBFile = useCallback(() => {
    window.api.openFile().then((file) => {
      if (!file.canceled && file.filePaths.length) {
        const filePath = file.filePaths[0]
        setSelectedDatabaseFile({
          path: filePath,
          filename: filePath.split('/').pop() || '',
          deviceType: 'desktop',
          packageName: '',
        })
      }
    })
  }, [])

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
      dbFilePath: selectedDatabaseFile?.path,
    }).then((savedFilePath) => {
      if (!savedFilePath) {
        return
      }
      toaster.create({
        title: 'Success',
        description: `Database file exported successfully to ${savedFilePath}`,
        status: 'success',
      })
    })
  }, [selectedDatabaseFile])

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
                <Text fontSize="sm">
                  {selectedDatabaseFile?.path}
                </Text>
              )
            : (
                <FLSelect
                  label="Select Database"
                  options={dbFileOptions}
                  value={selectedDatabaseFile}
                  onChange={handleDatabaseFileChange}
                  isDisabled={!selectedApplication?.bundleId || isDBPulling}
                />
              )}

          <Box width="250px">
            <FLSelect
              label="Select Table"
              options={tableOptions}
              value={selectedDatabaseTable}
              onChange={handleTableChange}
              isDisabled={!selectedDatabaseFile?.path || isDBPulling}
            />
          </Box>
          {/* <Button onClick={handleQueryExecution}>
            Custom query
          </Button> */}
          {isDBPulling && (
            <Spinner size="sm" color="blue.500" />
          )}
        </HStack>
        <HStack
          ml="auto"
          gap={2}
        >
          <Button onClick={handleOpenDBFile} variant="plain" size="xs" color="flipioPrimary" borderColor="flipioPrimary">
            Open DB
          </Button>

          <Button onClick={handleExportDB} variant="outline" size="xs" color="flipioPrimary" borderColor="flipioPrimary" disabled={!selectedDatabaseFile?.path}>
            Export
          </Button>
        </HStack>
      </Flex>
    </Box>
  )
}
