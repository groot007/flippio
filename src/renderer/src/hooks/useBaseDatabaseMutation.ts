import type { ChangeHistoryContext } from '@renderer/types/changeHistory'
import type { UseMutationResult } from '@tanstack/react-query'
import { validateDatabaseContext } from '@renderer/shared/utils/contextBuilder'
import { useDatabaseRefresh } from '@renderer/shared/utils/databaseRefresh'
import { useRowEditingStore } from '@renderer/store/useRowEditingStore'
import { toaster } from '@renderer/ui/toaster'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useChangeHistoryRefresh } from './useChangeHistory'

interface BaseMutationConfig<TVariables, TData> {
  mutationFn: (variables: TVariables) => Promise<TData>
  successMessage: string
  errorMessage: string
  shouldClosePanel?: boolean
  onSuccessCallback?: (data: TData, variables: TVariables) => Promise<void> | void
}

/**
 * Base hook for database mutations with common functionality
 */
export function useBaseDatabaseMutation<TVariables extends ChangeHistoryContext, TData>(
  config: BaseMutationConfig<TVariables, TData>,
): UseMutationResult<TData, Error, TVariables> {
  const queryClient = useQueryClient()
  const { setSelectedRow } = useRowEditingStore()
  const { refresh: refreshDatabase } = useDatabaseRefresh({ 
    showSuccessToast: false, 
    showErrorToast: false, 
  })
  const { refreshChangeHistory } = useChangeHistoryRefresh()

  return useMutation({
    mutationFn: async (variables: TVariables) => {
      if (!validateDatabaseContext(variables)) {
        throw new Error('Missing required database context for operation')
      }
      
      return config.mutationFn(variables)
    },
    
    onSuccess: async (data: TData, variables: TVariables) => {
      const { selectedDatabaseFile, selectedDevice, selectedApplication } = variables
      
      // Execute custom success callback if provided
      if (config.onSuccessCallback) {
        await config.onSuccessCallback(data, variables)
      }
      
      // Push changes back to device if needed
      await pushDatabaseToDevice({
        selectedDatabaseFile,
        selectedDevice,
        queryClient,
        selectedApplication,
      })

      // Show success message
      toaster.create({
        title: config.successMessage,
        description: `Operation completed successfully`,
        type: 'success',
        duration: 3000,
      })

      // Close the panel if requested
      if (config.shouldClosePanel) {
        setSelectedRow(null)
      }

      // Refresh table data and change history
      await refreshDatabase()
      refreshChangeHistory()
    },
    
    onError: (error: Error) => {
      console.error(`Database operation failed:`, error)
      toaster.create({
        title: config.errorMessage,
        description: error.message,
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
    return { success: true }
  }
}
