import { Button, Flex, Spinner } from '@chakra-ui/react'
import { useTableDataQuery } from '@renderer/hooks/useTableDataQuery'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection, useTableData } from '@renderer/store'
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
  const tableData = useTableData(state => state.tableData)
  const { selectedDevice } = useCurrentDeviceSelection()
  const { selectedDatabaseFile, selectedDatabaseTable } = useCurrentDatabaseSelection()
  const { refetch: refetchTable } = useTableDataQuery(selectedDatabaseTable?.name || '')

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
      console.log('Saving edited data:', condition, selectedRow)
      const result = await window.api.updateTableRow(
        selectedDatabaseTable?.name || '',
        editedData,
        condition,
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to update row')
      }

      // Push changes back to device if needed
      if (
        selectedDatabaseFile
        && selectedDevice
        && selectedDatabaseFile.packageName
      ) {
        console.log('Pushing database file back to device:', {
          deviceId: selectedDevice.id,
          localPath: selectedDatabaseFile.path,
          packageName: selectedDatabaseFile.packageName,
          remotePath: selectedDatabaseFile.remotePath || selectedDatabaseFile.path,
          deviceType: selectedDatabaseFile.deviceType,
        })
        
        const pushResult = await window.api.pushDatabaseFile(
          selectedDevice.id,
          selectedDatabaseFile.path,
          selectedDatabaseFile.packageName,
          selectedDatabaseFile.remotePath || selectedDatabaseFile.path,
          selectedDatabaseFile.deviceType,
        )
        
        if (!pushResult.success) {
          console.error('Failed to push database file:', pushResult.error)
          toaster.create({
            title: 'Push failed',
            description: `Failed to push changes to device: ${pushResult.error}`,
            type: 'warning',
            duration: 5000,
          })
        }
        else {
          console.log('Database file pushed successfully')
        }
      }

      setSelectedRow({
        rowData: editedData,
        originalData: { ...editedData },
        columnInfo: selectedRow.columnInfo, // Preserve column information
      })
      refetchTable()
      setIsEditing(false)

      toaster.create({
        title: 'Data updated',
        description: 'Row data has been successfully updated',
        type: 'success',
        duration: 3000,
      })
    }
    catch (error) {
      console.error('Error saving data:', error)
      toaster.create({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Failed to update data',
        type: 'error',
        duration: 5000,
      })
      cancelEditing()
    }
    finally {
      setIsLoading(false)
    }
  }, [selectedRow, selectedDatabaseTable, editedData, tableData?.columns, setSelectedRow, setIsEditing, setIsLoading, cancelEditing])

  return (
    <>
      
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
                  {isLoading
                    ? (
                        <>
                          <Spinner size="sm" />
                          Saving...
                        </>
                      )
                    : (
                        <>
                          Save
                          <LuSave />
                        </>
                      )}
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
    </>
  )
}
