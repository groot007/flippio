import {
  Button,
  Drawer,
  Flex,
  IconButton,
  Portal,
  Stack,
} from '@chakra-ui/react'
import { useClearTableMutation, useDeleteRowMutation } from '@renderer/hooks/useTableMutations'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection, useTableData } from '@renderer/store'
import { useRowEditingStore } from '@renderer/store/useRowEditingStore'
import { useColorMode } from '@renderer/ui/color-mode'
import { useCallback, useState } from 'react'
import { LuX } from 'react-icons/lu'
import { ClearTableDialog } from './ClearTableDialog'
import { DeleteRowDialog } from './DeleteRowDialog'
import { FieldItem } from './Field'
import { RowEditor } from './RowEditor'

export function SidePanel() {
  const { colorMode } = useColorMode()
  const isDark = colorMode === 'dark'
  const { selectedRow, setSelectedRow } = useRowEditingStore()
  const isOpen = !!selectedRow
  const { selectedDevice, selectedApplication } = useCurrentDeviceSelection()
  const { selectedDatabaseFile, selectedDatabaseTable } = useCurrentDatabaseSelection()
  const tableData = useTableData(state => state.tableData)
  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedData, setEditedData] = useState<Record<string, any>>({})
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isClearTableDialogOpen, setIsClearTableDialogOpen] = useState(false)

  const closePanel = useCallback(() => {
    setSelectedRow(null)
    setIsEditing(false)
  }, [setSelectedRow])

  const clearTableMutation = useClearTableMutation()

  const handleClearTable = useCallback(async () => {
    if (!selectedDatabaseTable) 
      return

    await clearTableMutation.mutateAsync({
      selectedDatabaseTable,
      selectedDatabaseFile,
      selectedDevice,
      selectedApplication,
    })

    setIsClearTableDialogOpen(false)
  }, [
    selectedDatabaseTable,
    selectedDatabaseFile,
    selectedDevice,
    selectedApplication,
    clearTableMutation,
  ])

  const deleteRowMutation = useDeleteRowMutation()

  const handleDeleteRow = useCallback(async () => {
    if (!selectedRow || !selectedDatabaseTable) 
      return

    await deleteRowMutation.mutateAsync({
      selectedRow,
      selectedDatabaseTable,
      selectedDatabaseFile,
      selectedDevice,
      selectedApplication,
      tableColumns: tableData?.columns,
    })

    setIsDeleteDialogOpen(false)
  }, [
    selectedRow,
    selectedDatabaseTable,
    selectedDatabaseFile,
    selectedDevice,
    selectedApplication,
    tableData?.columns,
    deleteRowMutation,
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
                    mb={2}
                    _hover={{ bg: 'red.50', _dark: { bg: 'red.900' } }}
                  >
                    Remove Row
                  </Button>
                  <Button
                    colorScheme="orange"
                    variant="outline"
                    onClick={() => {
                      setIsClearTableDialogOpen(true)
                    }}
                    size="md"
                    width="full"
                    mb={4}
                    _hover={{ bg: 'orange.50', _dark: { bg: 'orange.900' } }}
                  >
                    Clear Whole Table
                  </Button>
                  <DeleteRowDialog
                    isOpen={isDeleteDialogOpen}
                    onClose={() => setIsDeleteDialogOpen(false)}
                    onDelete={handleDeleteRow}
                    isLoading={isLoading}
                  />
                  <ClearTableDialog
                    isOpen={isClearTableDialogOpen}
                    onClose={() => setIsClearTableDialogOpen(false)}
                    onClear={handleClearTable}
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
