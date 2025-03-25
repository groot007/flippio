import {
  Box,
  Button,
  Flex,
  Heading,
  IconButton,
  Input,
  Stack,
  Text,
  Textarea,
  // useToast,
} from '@chakra-ui/react'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection, useTableData } from '@renderer/store'
import { useRowEditingStore } from '@renderer/store/useRowEditingStore'

import { useColorMode } from '@renderer/ui/color-mode'
import JsonView from '@uiw/react-json-view'
import React, { useState } from 'react'
import { toaster } from '../ui/toaster'

function buildUniqueCondition(cols, rowData) {
  const conditions = []
  cols.forEach((col) => {
    if (rowData[col]) {
      conditions.push(`${col} = '${rowData[col]}'`)
    }
  })

  return conditions.join(' AND ')
}

export function SidePanel() {
  const { colorMode } = useColorMode()
  const isDark = colorMode === 'dark'
  const { selectedRow, setSelectedRow } = useRowEditingStore()

  const { selectedDevice } = useCurrentDeviceSelection()
  const { selectedDatabaseFile, selectedDatabaseTable, pulledDatabaseFilePath } = useCurrentDatabaseSelection()
  const { tableData, setIsLoadingTableData } = useTableData()

  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedData, setEditedData] = useState<Record<string, any>>({})

  const closeRowPanel = () => {
    setSelectedRow(null)
  }

  const cancelEditingRow = () => {
    setIsEditing(false)
  }

  React.useEffect(() => {
    if (isEditing && selectedRow) {
      setEditedData(selectedRow.rowData)
    }
  }, [isEditing, selectedRow])

  // Handle input change
  const handleInputChange = (key: string, value: any) => {
    setEditedData(prev => ({
      ...prev,
      [key]: value,
    }))
  }

  // Handle save button click
  const handleSave = async () => {
    if (!selectedRow || !selectedDatabaseTable)
      return

    try {
      setIsLoading(true)
      setIsLoadingTableData(true)

      const condition = buildUniqueCondition(tableData?.columns, selectedRow.rowData)
      const result = await window.api.updateTableRow(
        selectedDatabaseTable.name,
        editedData,
        condition,
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to update row')
      }

      if (selectedDatabaseTable.deviceType !== 'iphone' && selectedDatabaseFile.packageName) {
        await window.api.pushDatabaseFile(
          selectedDevice.id,
          pulledDatabaseFilePath,
          selectedDatabaseFile.packageName,
          selectedDatabaseFile.path,
        )
      }

      setSelectedRow({
        rowData: editedData,
        originalData: editedData,
      })

      toaster.create({
        title: 'Data updated',
        description: 'Row data has been successfully updated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    }
    catch (error) {
      console.error('Error saving data:', error)
      toaster.create({
        title: 'Update failed',
        description: error.message || 'Failed to update data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      // Revert to original data on error
      cancelEditingRow()
    }
    finally {
      setIsLoading(false)
      setIsLoadingTableData(false)
    }
  }

  if (!selectedRow) {
    return null
  }

  const isJsonValue = (value: any) => {
    if (typeof value !== 'string')
      return false

    try {
      const json = JSON.parse(value)
      return typeof json === 'object' && json !== null
    }
    catch (e) {
      return false
    }
  }

  const parseJson = (value: string) => {
    try {
      return JSON.parse(value)
    }
    catch (e) {
      return value
    }
  }

  return (
    <Box
      position="fixed"
      top="0"
      right="0"
      width="500px"
      height="100vh"
      bg={isDark ? 'gray.800' : 'white'}
      borderLeftWidth="1px"
      borderColor={isDark ? 'gray.700' : 'gray.200'}
      boxShadow="lg"
      zIndex="10"
      overflowY="auto"
      transform={selectedRow ? 'translateX(0)' : 'translateX(100%)'}
      transition="transform 0.3s ease-in-out"
      pt="80px" // Account for the header
    >
      {/* Panel Header */}
      <Flex
        justifyContent="space-between"
        alignItems="center"
        p={4}
        borderBottomWidth="1px"
        borderColor={isDark ? 'gray.700' : 'gray.200'}
        position="fixed"
        top="0"
        right="0"
        width="500px"
        bg={isDark ? 'gray.800' : 'white'}
        zIndex="11"
      >
        <Heading size="md" pl={5}>
          {isEditing ? 'Edit Row Data' : 'Row Details'}
        </Heading>
        <Stack direction="row">
          {!isEditing
            ? (
                <IconButton
                  aria-label="Edit row"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  edit
                </IconButton>
              ) : (
                <>
                  <Button
                    colorScheme="green"
                    size="sm"
                    onClick={handleSave}
                    isLoading={isLoading}
                  >
                    {/* <CheckIcon mr={2} /> */}
                    Save
                  </Button>
                  <Button
                    size="sm"
                    onClick={cancelEditingRow}
                    isDisabled={isLoading}
                  >
                    Cancel
                  </Button>
                </>
              )}
          <IconButton
            aria-label="Close panel"
            size="sm"
            onClick={closeRowPanel}
            isDisabled={isLoading}
          >
            Close
          </IconButton>
        </Stack>
      </Flex>

      {/* Panel Content */}
      <Box p={6}>
        <Stack direction="column" align="stretch">
          {Object.entries(selectedRow.rowData || {}).map(([key, value]) => (
            <Box key={key}>
              {isEditing
                ? (
                    <Box>
                      <Text fontWeight="bold" fontSize="sm" mb={0}>{key}</Text>
                      {isJsonValue(value)
                        ? (
                            <Box borderWidth="1px" borderRadius="md" bg={isDark ? 'gray.700' : 'gray.50'}>
                              <Textarea
                                value={typeof editedData[key] === 'string'
                                  ? editedData[key]
                                  : JSON.stringify(editedData[key], null, 2)}
                                onChange={e => handleInputChange(key, e.target.value)}
                                minHeight="150px"
                                fontFamily="monospace"
                                color={isDark ? 'white' : 'gray.900'}
                                isDisabled={isLoading}
                              />
                            </Box>
                          )
                        : (
                            <Input
                              fontSize="xs"
                              value={editedData[key] !== undefined ? editedData[key] : ''}
                              onChange={e => handleInputChange(key, e.target.value)}
                              isDisabled={isLoading}
                              border="1px solid #ccc"
                            />
                          )}
                    </Box>
                  )
                : (
                    <>
                      <Text fontWeight="bold" fontSize="sm" mb={0}>{key}</Text>
                      {isJsonValue(value)
                        ? (
                            <Box borderWidth="1px" borderRadius="md" p={2} bg={isDark ? 'gray.200' : 'gray.50'}>
                              <JsonView
                                value={parseJson(value as string)}
                                collapsed={1}
                                displayDataTypes={false}
                                style={{
                                  fontSize: '14px',
                                  fontFamily: 'monospace',
                                }}
                              />
                            </Box>
                          )
                        : (
                            <Text fontSize="sm" mb={0}>{String(value)}</Text>
                          )}
                    </>
                  )}
              <Box
                height="1px"
                bg={isDark ? 'gray.700' : 'gray.200'}
                my={1}
                width="100%"
              />
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  )
}
