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
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { LuX } from 'react-icons/lu'
import { DeleteRowDialog } from './DeleteRowDialog'
import { FieldItem } from './Field'
import { RowEditor } from './RowEditor'

export function SidePanel() {
  const { colorMode } = useColorMode()
  const isDark = colorMode === 'dark'
  const { selectedRow, setSelectedRow } = useRowEditingStore()
  const isOpen = !!selectedRow
  const { selectedDevice, selectedApplication } = useCurrentDeviceSelection()
  const { selectedDatabaseFile, selectedDatabaseTable, pulledDatabaseFilePath } = useCurrentDatabaseSelection()
  const tableData = useTableData(state => state.tableData)
  const setTableData = useTableData(state => state.setTableData)
  const queryClient = useQueryClient()
  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedData, setEditedData] = useState<Record<string, any>>({})
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const closePanel = useCallback(() => {
    setSelectedRow(null)
    setIsEditing(false)
  }, [setSelectedRow])

  const handleDeleteRow = useCallback(async () => {
    if (!selectedRow || !selectedDatabaseTable)
      return

    try {
      const condition = buildUniqueCondition(
        tableData?.columns,
        selectedRow?.originalData || selectedRow?.rowData,
      )
      const result = await window.api.deleteTableRow(
        selectedDatabaseTable?.name || '',
        condition,
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete row')
      }

      console.log('Row deleted successfully:', selectedDatabaseFile)
      // Push changes back to device if needed
      if (
        selectedDatabaseFile
        && selectedDevice
        && selectedDatabaseFile.packageName
        && selectedDatabaseFile.path // Ensure we have the local file path
        && (selectedDatabaseFile?.deviceType === 'android'
          || selectedDatabaseFile?.deviceType === 'iphone'
          || selectedDatabaseFile?.deviceType === 'iphone-device'
          || selectedDatabaseFile?.deviceType === 'simulator')
      ) {
        // Use the correct paths: local temp file and remote path on device
        const localPath = selectedDatabaseFile.path // This is the local temp file path
        const remotePath = selectedDatabaseFile.remotePath || `/${selectedDatabaseFile.location}/${selectedDatabaseFile.filename}`
        
        console.log('Pushing database file:', {
          deviceId: selectedDevice.id,
          localPath,
          packageName: selectedDatabaseFile.packageName,
          remotePath,
          deviceType: selectedDatabaseFile.deviceType,
        })
        
        await window.api.pushDatabaseFile(
          selectedDevice.id,
          localPath,
          selectedDatabaseFile.packageName,
          remotePath,
          selectedDatabaseFile.deviceType,
        )
        
        // Invalidate and refetch database files to get updated data
        await queryClient.invalidateQueries({
          queryKey: ['databaseFiles', selectedDevice.id, selectedApplication?.bundleId],
        })
      }

      setIsDeleteDialogOpen(false)

      // Show success message
      toaster.create({
        title: 'Row deleted',
        description: 'The row has been successfully deleted',
        type: 'success',
        duration: 3000,
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
        type: 'error',
        duration: 5000,
      })
    }
  }, [
    selectedRow,
    selectedDatabaseTable,
    tableData?.columns,
    selectedDatabaseFile,
    selectedDevice,
    pulledDatabaseFilePath,
    closePanel,
  ])

  return (
    <Drawer.Root open={isOpen} onOpenChange={() => closePanel()} placement="end">
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content maxWidth="500px" width="100%">
            <Drawer.Header pr={16}>
              <Drawer.Title>{isEditing ? 'Edit Row Data' : 'Row Details'}</Drawer.Title>
              <Flex gap={2}>
                <RowEditor
                  isEditing={isEditing}
                  setIsEditing={setIsEditing}
                  isLoading={isLoading}
                  setIsLoading={setIsLoading}
                  editedData={editedData}
                  setEditedData={setEditedData}
                />
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
              {selectedRow && tableData?.columns && (
                <Stack gap="0">
                  {tableData.columns.map((column) => {
                    const key = column.name || column
                    const value = selectedRow.rowData?.[key]
                    // Find the column type for this field
                    const columnInfo = selectedRow.columnInfo?.find(col => col.name === key)
                    
                    return (
                      <FieldItem
                        key={key}
                        fieldKey={key}
                        fieldType={columnInfo?.type || 'unknown'}
                        value={isEditing ? editedData[key] : value}
                        isEditing={isEditing}
                        onChange={(key, value) =>
                          setEditedData(prev => ({
                            ...prev,
                            [key]: value,
                          }))}
                        isLoading={isLoading}
                        isDark={isDark}
                      />
                    )
                  })}
                  <Button
                    colorScheme="red"
                    variant="outline"
                    onClick={() => {
                      setIsDeleteDialogOpen(true)
                    }}
                    size="md"
                    width="full"
                    mt={8}
                    mb={4}
                    _hover={{ bg: 'red.50', _dark: { bg: 'red.900' } }}
                  >
                    Remove Row
                  </Button>
                  <DeleteRowDialog
                    isOpen={isDeleteDialogOpen}
                    onClose={() => setIsDeleteDialogOpen(false)}
                    onDelete={handleDeleteRow}
                    isLoading={isLoading}
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
