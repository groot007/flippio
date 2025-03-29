import {
  Box,
  Flex,
  HStack,
  Spinner,
  Text,
} from '@chakra-ui/react'
import { useDatabaseFiles } from '@renderer/hooks/useDatabaseFiles'
import { useDatabaseTables } from '@renderer/hooks/useDatabaseTabels'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection } from '@renderer/store'
import { useCallback, useMemo } from 'react'
import FLSelect from './Select'

export function SubHeader() {
  const selectedDevice = useCurrentDeviceSelection(state => state.selectedDevice)
  const selectedApplication = useCurrentDeviceSelection(state => state.selectedApplication)

  const selectedDatabaseFile = useCurrentDatabaseSelection(state => state.selectedDatabaseFile)
  const setSelectedDatabaseFile = useCurrentDatabaseSelection(state => state.setSelectedDatabaseFile)
  const selectedDatabaseTable = useCurrentDatabaseSelection(state => state.selectedDatabaseTable)
  const setSelectedDatabaseTable = useCurrentDatabaseSelection(state => state.setSelectedDatabaseTable)

  // Custom hooks for data fetching
  const {
    databaseFiles,
    isLoading: isDBPulling,
  } = useDatabaseFiles(selectedDevice, selectedApplication)

  const {
    tables: databaseTables,
  } = useDatabaseTables(selectedDatabaseFile, selectedDevice)

  const handleDatabaseFileChange = useCallback((path) => {
    const file = databaseFiles?.find(f => f.path === path[0]) || null
    setSelectedDatabaseFile(file)
    setSelectedDatabaseTable(null)
  }, [databaseFiles, setSelectedDatabaseFile])

  const handleTableChange = useCallback((name) => {
    const table = databaseTables?.find(t => t.name === name[0]) || null
    setSelectedDatabaseTable(table)
  }, [databaseTables, setSelectedDatabaseTable])

  const dbFileOptions = useMemo(() =>
    databaseFiles?.map(file => ({
      label: file.filename,
      value: file.path,
    })) ?? [], [databaseFiles])

  const tableOptions = useMemo(() =>
    databaseTables?.map(table => ({
      label: table.name,
      value: table.name,
    })) ?? [], [databaseTables])

  // const handleQueryExecution = useCallback(async () => {
  //   const data = await window.api.executeQuery('SELECT * FROM config')
  //   console.log('handleQueryExecution__', data)
  // }, [])

  return (
    <Box
      width="full"
      pb={3}
      px={4}
      borderBottomWidth="1px"
      borderColor="app.border"
      bg="app.subheader.bg"
    >
      {!databaseFiles?.length && !isDBPulling
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
          <FLSelect
            label="Select Database"
            options={dbFileOptions}
            value={[selectedDatabaseFile?.path || '']}
            onChange={handleDatabaseFileChange}
            isDisabled={!databaseFiles?.length}
          />

          <Box width="250px">
            <FLSelect
              label="Select Table"
              options={tableOptions}
              value={[selectedDatabaseTable?.name || '']}
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
      </Flex>
    </Box>
  )
}
