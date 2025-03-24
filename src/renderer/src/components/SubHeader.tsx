import {
  Box,
  Flex,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useColorMode } from '@renderer/ui/color-mode'
import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../store/appStore'
import FLSelect from './Select'

export function SubHeader() {
  const { colorMode } = useColorMode()
  const isDark = colorMode === 'dark'
  const {
    selectedDatabaseFile,
    selectedDatabaseTable,
    databaseFiles,
    databaseTables,
    selectedApplication,
    selectedDevice,
    setDatabaseTables,
    isLoadingDatabase,
    setSelectedDatabaseFile,
    setSelectedDatabaseTable,
  } = useAppStore()

  // Handler for database file selection change
  const handleDatabaseFileChange = (path: string) => {
    const file = databaseFiles?.find(f => f.path === path[0]) || null
    setSelectedDatabaseFile(file)
  }

  // Handler for table selection change
  const handleTableChange = (name: string) => {
    const table = databaseTables?.find(t => t.name === name[0]) || null

    setSelectedDatabaseTable(table)
  }

  const isExternalFile = false

  // Format database files for select
  const dbFileOptions = useMemo(() => databaseFiles?.map(file => ({
    label: file.filename,
    value: file.path,
  })), [databaseFiles]) ?? []

  // Format tables for select
  const tableOptions = databaseTables?.map(table => ({
    label: table.name,
    value: table.name,
  })) ?? []

  const getTabels = async () => {
    let dbPath = selectedDatabaseFile?.path
    if (selectedDatabaseFile?.deviceType !== 'iphone') {
      const pull = await window.api.pullDatabaseFile(selectedDevice, selectedDatabaseFile.path)
      if (!pull.success) {
        console.error('PULL FAILED', pull)
        return
      }

      dbPath = pull.path
    }
    await window.api.openDatabase(dbPath)
    const response = await window.api.getTables()

    if (response.success) {
      const tabels = response.tables.map((table: any) => ({
        ...table,
        deviceType: selectedDatabaseFile?.deviceType,
        osLocalPath: dbPath,
      }))
      setDatabaseTables(tabels)
    }
    else {
      setDatabaseTables([])
    }
  }

  useEffect(() => {
    if (selectedDatabaseFile?.path) {
      getTabels()
    }
  }, [selectedDatabaseFile])

  if (!selectedApplication) {
    return null
  }

  // If no database file is selected, don't render anything
  if (!databaseFiles?.length) {
    // No database files available
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
            {isExternalFile
              ? (
                  <Text fontWeight="medium">
                    {selectedDatabaseFile.name}
                  </Text>
                )
              : (
                  <FLSelect
                    label="Select Database"
                    options={dbFileOptions}
                    value={[selectedDatabaseFile?.path]}
                    onChange={handleDatabaseFileChange}
                    width="250px"
                  />
                )}
          </Box>

          {/* Table Selection */}
          <Box width="250px">
            <FLSelect
              label="Select Table"
              options={tableOptions}
              value={[selectedDatabaseTable?.name]}
              onChange={handleTableChange}
              isDisabled={isLoadingDatabase}
              width="250px"
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
