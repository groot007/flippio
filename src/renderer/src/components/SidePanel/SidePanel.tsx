import {
  Button,
  Drawer,
  Flex,
  IconButton,
  Portal,
  Stack,
} from '@chakra-ui/react'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection, useTableData } from '@renderer/store'
import { useRowEditingStore } from '@renderer/store/useRowEditingStore'
import { useColorMode } from '@renderer/ui/color-mode'
import { toaster } from '@renderer/ui/toaster'
import { buildUniqueCondition } from '@renderer/utils'
import { useCallback, useState } from 'react'
import { LuPencil, LuSave, LuX } from 'react-icons/lu'
import { FieldItem } from './Field'

export function SidePanel() {
  const { colorMode } = useColorMode()
  const isDark = colorMode === 'dark'
  const { selectedRow, setSelectedRow } = useRowEditingStore()
  const isOpen = !!selectedRow

  const { selectedDevice } = useCurrentDeviceSelection()
  const { selectedDatabaseFile, selectedDatabaseTable, pulledDatabaseFilePath } = useCurrentDatabaseSelection()
  const tableData = useTableData(state => state.tableData)

  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedData, setEditedData] = useState<Record<string, any>>({})

  const closePanel = useCallback(() => {
    setSelectedRow(null)
    setIsEditing(false)
  }, [setSelectedRow])

  const startEditing = useCallback(() => {
    if (selectedRow?.rowData) {
      setEditedData(selectedRow.rowData)
    }
    setIsEditing(true)
  }, [selectedRow])

  const cancelEditing = useCallback(() => {
    setIsEditing(false)
    setEditedData(selectedRow?.rowData || {})
  }, [selectedRow])

  const handleInputChange = useCallback((key: string, value: any) => {
    setEditedData(prev => ({
      ...prev,
      [key]: value,
    }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!selectedRow || !selectedDatabaseTable || !editedData)
      return

    try {
      setIsLoading(true)
      await updateRowData()
      await pushDatabaseFileIfNeeded()
      updateSelectedRow()
      showSuccessToast()
    }
    catch (error) {
      handleSaveError(error)
    }
    finally {
      setIsLoading(false)
    }
  }, [selectedRow, selectedDatabaseTable, editedData])

  async function updateRowData() {
    const condition = buildUniqueCondition(tableData?.columns, selectedRow?.originalData || selectedRow?.rowData)
    const result = await window.api.updateTableRow(selectedDatabaseTable?.name || '', editedData, condition)
    if (!result.success)
      throw new Error(result.error || 'Failed to update row')
  }

  async function pushDatabaseFileIfNeeded() {
    if (selectedDatabaseFile && selectedDevice && selectedDatabaseFile.packageName && selectedDatabaseTable?.deviceType !== 'iphone') {
      await window.api.pushDatabaseFile(selectedDevice.id, pulledDatabaseFilePath, selectedDatabaseFile.packageName, selectedDatabaseFile.path)
    }
  }

  function updateSelectedRow() {
    setSelectedRow({
      rowData: editedData,
      originalData: { ...editedData },
    })
    setIsEditing(false)
  }

  function showSuccessToast() {
    toaster.create({
      title: 'Data updated',
      description: 'Row data has been successfully updated',
      status: 'success',
      duration: 3000,
      isClosable: true,
    })
  }

  function handleSaveError(error: any) {
    console.error('Error saving data:', error)
    toaster.create({
      title: 'Update failed',
      description: error.message || 'Failed to update data',
      status: 'error',
      duration: 5000,
      isClosable: true,
    })
    cancelEditing()
  }

  // Using the provided Drawer pattern for consistent UI
  return (
    <Drawer.Root open={isOpen} onOpenChange={() => closePanel()}>
      <Portal>
        <Drawer.Backdrop />
        {/* @ts-expect-error chakra types */}
        <Drawer.Positioner placement="right">
          {/* @ts-expect-error chakra types */}
          <Drawer.Content maxWidth="500px" width="100%">
            <Drawer.Header pr={16}>
              <Drawer.Title>{isEditing ? 'Edit Row Data' : 'Row Details'}</Drawer.Title>
              <Flex gap={2}>
                {!isEditing
                  ? (
                      <IconButton
                        aria-label="Edit row"

                        size="sm"
                        onClick={startEditing}
                        disabled={isLoading}
                      >
                        <LuPencil />
                        {' '}

                      </IconButton>
                    )
                  : (
                      <>
                        <Button
                          colorScheme="green"
                          size="sm"
                          onClick={handleSave}
                          disabled={isLoading}
                        >
                          Save
                          <LuSave />
                        </Button>
                        <Button
                          size="sm"
                          colorPalette="pink"
                          onClick={cancelEditing}
                          disabled={isLoading}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                {/* @ts-expect-error chakra types */}
                <Drawer.CloseTrigger asChild>
                  <IconButton
                    aria-label="Close panel"
                    size="xl"
                    bg="transparent"
                    disabled={isLoading}
                    color="gray.400"
                  >
                    <LuX size={64} />
                  </IconButton>
                </Drawer.CloseTrigger>
              </Flex>
            </Drawer.Header>

            <Drawer.Body>
              {selectedRow && (
                <Stack gap="4">
                  {Object.entries(selectedRow.rowData || {}).map(([key, value]) => (
                    <FieldItem
                      key={key}
                      fieldKey={key}
                      value={isEditing ? editedData[key] : value}
                      isEditing={isEditing}
                      onChange={handleInputChange}
                      isLoading={isLoading}
                      isDark={isDark}
                    />
                  ))}
                </Stack>
              )}
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  )
}
