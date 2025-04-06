import {
  Button,
  Drawer,
  Flex,
  IconButton,
  Portal,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection, useTableData } from '@renderer/store'
import { useRowEditingStore } from '@renderer/store/useRowEditingStore'
import { useColorMode } from '@renderer/ui/color-mode'
import { toaster } from '@renderer/ui/toaster'
import { buildUniqueCondition } from '@renderer/utils'
import { useCallback, useState } from 'react'
import { LuPencil, LuSave, LuX } from 'react-icons/lu'
import FLModal from '../FLModal'
import { FieldItem } from './Field'

export function SidePanel() {
  const { colorMode } = useColorMode()
  const isDark = colorMode === 'dark'
  const { selectedRow, setSelectedRow } = useRowEditingStore()
  const isOpen = !!selectedRow
  const { selectedDevice } = useCurrentDeviceSelection()
  const { selectedDatabaseFile, selectedDatabaseTable, pulledDatabaseFilePath } = useCurrentDatabaseSelection()
  const tableData = useTableData(state => state.tableData)
  const setTableData = useTableData(state => state.setTableData)
  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedData, setEditedData] = useState<Record<string, any>>({})
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

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
      handleSaveError(result)
  }

  async function pushDatabaseFileIfNeeded() {
    if (selectedDatabaseFile && selectedDevice && selectedDatabaseFile.packageName && selectedDatabaseFile?.deviceType !== 'iphone') {
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

  const handleDeleteRow = useCallback(async () => {
    if (!selectedRow || !selectedDatabaseTable)
      return

    try {
      const condition = buildUniqueCondition(tableData?.columns, selectedRow?.originalData || selectedRow?.rowData)

      const result = await window.api.deleteTableRow(selectedDatabaseTable?.name || '', condition)

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete row')
      }

      // Push changes back to device if needed
      if (selectedDatabaseFile && selectedDevice && selectedDatabaseFile.packageName && selectedDatabaseFile?.deviceType !== 'iphone') {
        await window.api.pushDatabaseFile(
          selectedDevice.id,
          pulledDatabaseFilePath,
          selectedDatabaseFile.packageName,
          selectedDatabaseFile.path,
        )
      }

      setIsDeleteDialogOpen(false)
      // Show success message
      toaster.create({
        title: 'Row deleted',
        description: 'The row has been successfully deleted',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })

      // Close the panel
      closePanel()

      // Refresh table data to reflect deletion
      if (selectedDatabaseTable?.name) {
        const response = await window.api.getTableInfo(selectedDatabaseTable.name)
        if (response.success && response.columns && response.rows) {
          setTableData({
            columns: response.columns,
            rows: response.rows,
          })
        }
      }
    }
    catch (error) {
      console.error('Error deleting row:', error)
      toaster.create({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete row',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }, [selectedRow, selectedDatabaseTable, tableData?.columns, selectedDatabaseFile, selectedDevice, pulledDatabaseFilePath, closePanel])

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

                  <Button
                    colorScheme="red"
                    variant="outline"
                    onClick={() => {
                      setIsDeleteDialogOpen(true)
                    }}
                    size="md"
                    width="full"
                    _hover={{ bg: 'red.50', _dark: { bg: 'red.900' } }}
                  >
                    Remove Row
                  </Button>

                  <FLModal
                    isOpen={isDeleteDialogOpen}
                    body={(
                      <Text>
                        Are you sure you want to delete this row? This action cannot be undone.
                      </Text>
                    )}
                    title="Delete Row"
                    acceptBtn="Delete"
                    onAccept={handleDeleteRow}
                    rejectBtn="Cancel"
                    onReject={() => {
                      setIsDeleteDialogOpen(false)
                    }}
                  />

                </Stack>
              )}
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  )
}
