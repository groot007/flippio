import type { RowEditorProps } from './types'
import { useChangeHistoryRefresh } from '@renderer/features/change-history/hooks'
import { useTableDataQuery } from '@renderer/features/database/hooks'
import { useCurrentDatabaseSelection, useRowEditingStore, useTableData } from '@renderer/features/database/stores'
import { useCurrentDeviceSelection } from '@renderer/features/devices/stores'
import { buildUniqueCondition } from '@renderer/shared/utils'
import { validateRowData } from '@renderer/shared/utils/typeValidation'
import { toaster } from '@renderer/ui/toaster'
import { useCallback } from 'react'
import { RowEditorPresenter } from './RowEditorPresenter'

export function RowEditorContainer({
  isEditing,
  setIsEditing,
  isLoading,
  setIsLoading,
  editedData,
  setEditedData,
}: RowEditorProps) {
  const { selectedRow, setSelectedRow } = useRowEditingStore()
  const tableData = useTableData(state => state.tableData)
  const { selectedDevice, selectedApplication } = useCurrentDeviceSelection()
  const { selectedDatabaseFile, selectedDatabaseTable } = useCurrentDatabaseSelection()
  const { refetch: refetchTable } = useTableDataQuery(selectedDatabaseTable?.name || '')
  const { refreshChangeHistory } = useChangeHistoryRefresh()

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
      
      // Validate data types before sending to backend
      const columnTypes: Record<string, string> = {}
      tableData?.columns?.forEach((col) => {
        columnTypes[col.name] = col.type
      })
      
      const validation = validateRowData(editedData, columnTypes)
      if (!validation.isValid) {
        const firstError = validation.errors && Object.entries(validation.errors)[0]
        toaster.create({
          title: 'Invalid Data',
          description: firstError
            ? `${firstError[0]}: ${firstError[1]}`
            : 'An unknown validation error occurred.',
          type: 'error',
          duration: 6000,
          meta: {
            closable: true,
          },
        })
        setIsLoading(false)
        return
      }
      
      const condition = buildUniqueCondition(
        tableData?.columns || [],
        selectedRow?.originalData || selectedRow?.rowData,
      )

      // Use validated and converted data
      const result = await window.api.updateTableRow(
        selectedDatabaseTable?.name || '',
        validation.convertedData || editedData,
        condition,
        selectedDatabaseFile?.path,
        selectedDevice?.id,
        selectedDevice?.name,
        selectedDevice?.deviceType,
        selectedApplication?.bundleId,
        selectedApplication?.name,
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to update row')
      }

      // Push changes back to device if needed
      let pushSucceeded = true
      let pushError = ''
      
      if (
        selectedDatabaseFile
        && selectedDevice
        && selectedDatabaseFile.packageName
      ) {
        const pushResult = await window.api.pushDatabaseFile(
          selectedDevice.id,
          selectedDatabaseFile.path,
          selectedDatabaseFile.packageName,
          selectedDatabaseFile.remotePath || selectedDatabaseFile.path,
          selectedDatabaseFile.deviceType,
        )
        
        if (!pushResult.success) {
          pushSucceeded = false
          pushError = pushResult.error || 'Unknown push error'
          console.error('Failed to push database file:', pushError)
          
          toaster.create({
            title: 'Sync Failed',
            description: `Data updated locally but failed to sync to device: ${pushError}`,
            type: 'error',
            duration: 8000,
            meta: {
              closable: true,
            },
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
      refreshChangeHistory()
      setIsEditing(false)

      // Only show success message if push succeeded or no push was needed
      if (pushSucceeded) {
        toaster.create({
          title: 'Data updated',
          description: 'Row data has been successfully updated and synced to device',
          type: 'success',
          duration: 3000,
        })
      }
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
  }, [selectedRow, selectedDatabaseTable, editedData, tableData?.columns, setSelectedRow, setIsEditing, setIsLoading, cancelEditing, selectedDevice, selectedApplication, selectedDatabaseFile, refetchTable, refreshChangeHistory])

  return (
    <RowEditorPresenter
      isEditing={isEditing}
      isLoading={isLoading}
      onStartEditing={startEditing}
      onSave={handleSave}
      onCancel={cancelEditing}
    />
  )
}
