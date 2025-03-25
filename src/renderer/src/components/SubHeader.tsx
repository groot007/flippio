import {
  Box,
  Flex,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react'
import { is } from '@electron-toolkit/utils'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection } from '@renderer/store'
import { useColorMode } from '@renderer/ui/color-mode'
import { useEffect, useMemo } from 'react'
import FLSelect from './Select'

export function SubHeader() {
  const { colorMode } = useColorMode()
  const isDark = colorMode === 'dark'
  const { selectedDevice, selectedApplication } = useCurrentDeviceSelection()
  const {
    selectedDatabaseFile,
    setSelectedDatabaseFile,
    selectedDatabaseTable,
    setSelectedDatabaseTable,
    databaseFiles,
    setDatabaseFiles,
    databaseTables,
    setDatabaseTables,
    setPulledDatabaseFilePath,
    setIsDBPulling,
    isDBPulling,
  } = useCurrentDatabaseSelection()

  const handleDatabaseFileChange = (path: string) => {
    const file = databaseFiles?.find(f => f.path === path[0]) || null
    setSelectedDatabaseFile(file)
  }

  const handleTableChange = (name: string) => {
    const table = databaseTables?.find(t => t.name === name[0]) || null

    setSelectedDatabaseTable(table)
  }

  const dbFileOptions = useMemo(() => databaseFiles?.map(file => ({
    label: file.filename,
    value: file.path,
  })), [databaseFiles]) ?? []

  const tableOptions = useMemo(() => databaseTables?.map(table => ({
    label: table.name,
    value: table.name,
  })), [databaseTables]) ?? []

  const getTabels = async () => {
    let dbPath = selectedDatabaseFile?.path
    if (selectedDatabaseFile?.deviceType !== 'iphone') {
      const pull = await window.api.pullDatabaseFile(selectedDevice.id, selectedDatabaseFile.path)
      if (!pull.success) {
        console.error('PULL FAILED', pull)
        return
      }

      dbPath = pull.path
    }

    setPulledDatabaseFilePath(dbPath)

    await window.api.openDatabase(dbPath)
    const response = await window.api.getTables()

    if (response.success) {
      setDatabaseTables(response.tables)
    }
    else {
      setDatabaseTables([])
    }
  }

  const getDatabaseFiles = async () => {
    setIsDBPulling(true)
    const fetchFunction = selectedDevice?.deviceType === 'iphone'
      ? window.api.getIOSDatabaseFiles
      : window.api.getAndroidDatabaseFiles

    const response = await fetchFunction(selectedDevice.id, selectedApplication.bundleId)
    if (response.success) {
      setDatabaseFiles(response.files)
      setIsDBPulling(false)
    }
    else {
      console.error('Failed to fetch database files', response.error)
    }
  }

  const isLoadingDatabase = false

  useEffect(() => {
    if (selectedDatabaseFile?.path) {
      getTabels()
    }
  }, [selectedDatabaseFile])

  useEffect(() => {
    if (selectedApplication?.bundleId) {
      getDatabaseFiles()
    }
  }, [selectedApplication])

  if (!selectedApplication.bundleId || isDBPulling) {
    return null
  }

  if (!databaseFiles?.length && !isDBPulling) {
    return (
      <Box
        width="full"
        py={3}
        px={6}
        borderBottomWidth="1px"
        borderColor={isDark ? 'gray.700' : 'gray.200'}
        bg={isDark ? 'gray.700' : 'gray.100'}
      >
        <Text fontWeight="medium">
          No database files available
        </Text>
      </Box>
    )
  }

  return (
    <Box
      width="full"
      py={3}
      px={6}
      borderBottomWidth="1px"
      borderColor={isDark ? 'gray.700' : 'gray.200'}
      bg={isDark ? 'gray.700' : 'gray.100'}
    >
      <Flex justifyContent="flex-start" alignItems="center">
        <Stack direction="row" gap={4}>
          {/* Database File Selection or Static Text */}
          <Box width="250px">

            <FLSelect
              label="Select Database"
              options={dbFileOptions}
              value={[selectedDatabaseFile?.path]}
              onChange={handleDatabaseFileChange}
            />
          </Box>

          {/* Table Selection */}
          <Box width="250px">
            <FLSelect
              label="Select Table"
              options={tableOptions}
              value={[selectedDatabaseTable?.name]}
              onChange={handleTableChange}
              isDisabled={isLoadingDatabase}
            />
          </Box>

          {/* Loading Indicator */}
          {isLoadingDatabase && (
            <Spinner size="sm" color="blue.500" />
          )}
        </Stack>
      </Flex>
    </Box>
  )
}
