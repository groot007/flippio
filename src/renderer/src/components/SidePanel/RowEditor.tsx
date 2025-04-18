import { Button, Flex } from '@chakra-ui/react'
import { useCurrentDatabaseSelection, useTableData } from '@renderer/store'
import { useRowEditingStore } from '@renderer/store/useRowEditingStore'
import { toaster } from '@renderer/ui/toaster'
import { buildUniqueCondition } from '@renderer/utils'
import { useCallback } from 'react'
import { LuPencil, LuSave } from 'react-icons/lu'

interface RowEditorProps {
  isEditing: boolean
  setIsEditing: (isEditing: boolean) => void
  isLoading: boolean
  setIsLoading: (isLoading: boolean) => void
  editedData: Record<string, any>
  setEditedData: (data: Record<string, any>) => void
}

export const RowEditor: React.FC<RowEditorProps> = ({
  isEditing,
  setIsEditing,
  isLoading,
  setIsLoading,
  editedData,
  setEditedData,
}) => {
  const { selectedRow, setSelectedRow } = useRowEditingStore()
  const { selectedDatabaseTable } = useCurrentDatabaseSelection()
  const tableData = useTableData(state => state.tableData)

  const startEditing = useCallback(() => {
    if (selectedRow?.rowData) {
      setEditedData(selectedRow.rowData)
    }
    setIsEditing(true)
  }, [selectedRow, setEditedData, setIsEditing])

  const cancelEditing = useCallback(() => {
    setIsEditing(false)
    setEditedData(selectedRow?.rowData || {})
  }, [selectedRow, setEditedData, setIsEditing])

  const handleSave = useCallback(async () => {
    if (!selectedRow || !selectedDatabaseTable || !editedData)
      return

    try {
      setIsLoading(true)
      const condition = buildUniqueCondition(
        tableData?.columns,
        selectedRow?.originalData || selectedRow?.rowData,
      )
      const result = await window.api.updateTableRow(
        selectedDatabaseTable?.name || '',
        editedData,
        condition,
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to update row')
      }

      setSelectedRow({
        rowData: editedData,
        originalData: { ...editedData },
      })
      setIsEditing(false)

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
        description: error instanceof Error ? error.message : 'Failed to update data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      cancelEditing()
    }
    finally {
      setIsLoading(false)
    }
  }, [selectedRow, selectedDatabaseTable, editedData, tableData?.columns, setSelectedRow, setIsEditing, setIsLoading, cancelEditing])

  return (
    <Flex gap={2}>
      {!isEditing
        ? (
            <Button
              size="sm"
              onClick={startEditing}
              disabled={isLoading}
            >
              <LuPencil />
              {' '}
              Edit

            </Button>
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
    </Flex>
  )
}
