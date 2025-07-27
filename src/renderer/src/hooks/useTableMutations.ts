import { useRowEditingStore } from '@renderer/store/useRowEditingStore'
import { toaster } from '@renderer/ui/toaster'
import { buildUniqueCondition } from '@renderer/utils'
import { useDatabaseRefresh } from '@renderer/utils/databaseRefresh'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface DatabaseOperation {
  selectedDatabaseTable: any
  selectedDatabaseFile: any
  selectedDevice: any
  selectedApplication: any
}

interface DeleteRowOptions extends DatabaseOperation {
  selectedRow: any
  tableColumns: any[]
}

interface ClearTableOptions extends DatabaseOperation {}

/**
 * Hook for deleting a single row from the table
 */
export function useDeleteRowMutation() {
  const queryClient = useQueryClient()
  const { setSelectedRow } = useRowEditingStore()
  const { refresh: refreshDatabase } = useDatabaseRefresh({ showSuccessToast: false, showErrorToast: false })

  return useMutation({
    mutationFn: async ({ selectedRow, selectedDatabaseTable, selectedDatabaseFile, tableColumns }: DeleteRowOptions) => {
      if (!selectedRow || !selectedDatabaseTable) {
        throw new Error('Missing required data for deletion')
      }

      const condition = buildUniqueCondition(
        tableColumns,
        selectedRow?.originalData || selectedRow?.rowData,
      )
      
      const result = await window.api.deleteTableRow(
        selectedDatabaseTable?.name || '',
        condition,
        selectedDatabaseFile?.path,
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete row')
      }

      return { selectedDatabaseFile, selectedDatabaseTable }
    },
    onSuccess: async ({ selectedDatabaseFile }, variables) => {
      const { selectedDevice, selectedApplication } = variables

      // Push changes back to device if needed
      await pushDatabaseToDevice({
        selectedDatabaseFile,
        selectedDevice,
        queryClient,
        selectedApplication,
      })

      // Show success message
      toaster.create({
        title: 'Row deleted',
        description: 'The row has been successfully deleted',
        type: 'success',
        duration: 3000,
      })

      // Close the panel
      setSelectedRow(null)

      // Refresh table data
      await refreshDatabase()
    },
    onError: (error) => {
      console.error('Error deleting row:', error)
      toaster.create({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete row',
        type: 'error',
        duration: 5000,
      })
    },
  })
}

/**
 * Hook for clearing all rows from the table
 */
export function useClearTableMutation() {
  const queryClient = useQueryClient()
  const { setSelectedRow } = useRowEditingStore()
  const { refresh: refreshDatabase } = useDatabaseRefresh({ showSuccessToast: false, showErrorToast: false })

  return useMutation({
    mutationFn: async ({ selectedDatabaseTable, selectedDatabaseFile }: ClearTableOptions) => {
      if (!selectedDatabaseTable) {
        throw new Error('No table selected')
      }

      const result = await window.api.executeQuery(
        `DELETE FROM ${selectedDatabaseTable.name}`,
        selectedDatabaseFile?.path,
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to clear table')
      }

      return { selectedDatabaseFile, selectedDatabaseTable }
    },
    onSuccess: async ({ selectedDatabaseFile }, variables) => {
      const { selectedDevice, selectedApplication } = variables

      // Push changes back to device if needed
      await pushDatabaseToDevice({
        selectedDatabaseFile,
        selectedDevice,
        queryClient,
        selectedApplication,
      })

      // Show success message
      toaster.create({
        title: 'Table cleared',
        description: 'All rows have been successfully deleted from the table',
        type: 'success',
        duration: 3000,
      })

      // Close the panel
      setSelectedRow(null)

      // Refresh table data
      await refreshDatabase()
    },
    onError: (error) => {
      console.error('Error clearing table:', error)
      toaster.create({
        title: 'Clear table failed',
        description: error instanceof Error ? error.message : 'Failed to clear table',
        type: 'error',
        duration: 5000,
      })
    },
  })
}

/**
 * Shared utility for pushing database changes to device
 */
async function pushDatabaseToDevice({
  selectedDatabaseFile,
  selectedDevice,
  queryClient,
  selectedApplication,
}: {
  selectedDatabaseFile: any
  selectedDevice: any
  queryClient: any
  selectedApplication: any
}): Promise<{ success: boolean, error?: string }> {
  if (
    selectedDatabaseFile
    && selectedDevice
    && selectedDatabaseFile.packageName
    && selectedDatabaseFile.path) {
    const localPath = selectedDatabaseFile.path
    const remotePath = selectedDatabaseFile.remotePath || `/${selectedDatabaseFile.location}/${selectedDatabaseFile.filename}`
    
    console.log('Pushing database file:', {
      deviceId: selectedDevice.id,
      localPath,
      packageName: selectedDatabaseFile.packageName,
      remotePath,
      deviceType: selectedDatabaseFile.deviceType,
    })
    
    const pushResult = await window.api.pushDatabaseFile(
      selectedDevice.id,
      localPath,
      selectedDatabaseFile.packageName,
      remotePath,
      selectedDatabaseFile.deviceType,
    )
    
    if (!pushResult.success) {
      console.error('Failed to push database file:', pushResult.error)
      toaster.create({
        title: 'Sync Failed',
        description: `Failed to push changes to device: ${pushResult.error}`,
        type: 'error',
        duration: 8000,
        meta: {
          closable: true,
        },
      })
      // Return the push result so calling code can handle the failure
      return { success: false, error: pushResult.error }
    }
    else {
      console.log('Database file pushed successfully')
      return { success: true }
    }
    
    // Invalidate and refetch database files
    await queryClient.invalidateQueries({
      queryKey: ['databaseFiles', selectedDevice.id, selectedApplication?.bundleId],
    })
  }
  else {
    console.log('Skipping push to device - missing required data:', {
      hasDatabaseFile: !!selectedDatabaseFile,
      hasDevice: !!selectedDevice,
      hasPackageName: !!selectedDatabaseFile?.packageName,
      hasPath: !!selectedDatabaseFile?.path,
      deviceType: selectedDatabaseFile?.deviceType,
    })
    return { success: true } // No push needed, consider it successful
  }
}
