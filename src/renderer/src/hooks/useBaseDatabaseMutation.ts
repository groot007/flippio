import type { ChangeHistoryContext } from '@renderer/types/changeHistory'
import type { UseMutationResult } from '@tanstack/react-query'
import { useCurrentDatabaseSelection } from '@renderer/store'
import { useRowEditingStore } from '@renderer/store/useRowEditingStore'
import { useTableData } from '@renderer/store/useTableData'
import { toaster } from '@renderer/ui/toaster'
import { validateDatabaseContext } from '@renderer/utils/contextBuilder'
import { ensureActiveDatabaseFile } from '@renderer/utils/databaseFileResolver'
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
  const setSelectedDatabaseFile = useCurrentDatabaseSelection(state => state.setSelectedDatabaseFile)
  const { setSelectedRow } = useRowEditingStore()
  const { refreshChangeHistory } = useChangeHistoryRefresh()

  return useMutation({
    mutationFn: async (variables: TVariables) => {
      if (!validateDatabaseContext(variables)) {
        throw new Error('Missing required database context for operation')
      }

      const resolvedDatabaseFile = await ensureActiveDatabaseFile({
        databaseFile: variables.selectedDatabaseFile,
        selectedDevice: variables.selectedDevice,
        selectedApplication: variables.selectedApplication,
        queryClient,
        setSelectedDatabaseFile,
      })

      return config.mutationFn({
        ...variables,
        selectedDatabaseFile: resolvedDatabaseFile,
      })
    },
    
    onSuccess: async (data: TData, variables: TVariables) => {
      const { selectedDatabaseFile, selectedDatabaseTable, selectedDevice, selectedApplication } = variables
      const resolvedDatabaseFile = await ensureActiveDatabaseFile({
        databaseFile: selectedDatabaseFile,
        selectedDevice,
        selectedApplication,
        queryClient,
        setSelectedDatabaseFile,
      })
      
      // Execute custom success callback if provided
      if (config.onSuccessCallback) {
        await config.onSuccessCallback(data, variables)
      }

      await pushDatabaseToDevice({
        selectedDatabaseFile: resolvedDatabaseFile,
        selectedDevice,
        queryClient,
        selectedApplication,
      })

      await refreshActiveTableOnly({
        queryClient,
        selectedDatabaseFile: resolvedDatabaseFile,
        selectedDatabaseTable,
      })
      refreshChangeHistory()

      // Keep the panel open until the current database has been pushed and
      // the active table has been refreshed from the synced file.
      if (config.shouldClosePanel) {
        setSelectedRow(null)
      }

      toaster.create({
        title: config.successMessage,
        description: 'Operation completed successfully',
        type: 'success',
        duration: 3000,
      })
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

async function refreshActiveTableOnly({
  queryClient,
  selectedDatabaseFile,
  selectedDatabaseTable,
}: {
  queryClient: any
  selectedDatabaseFile: any
  selectedDatabaseTable?: any
}) {
  if (!selectedDatabaseFile?.path || !selectedDatabaseTable?.name) {
    return
  }

  useTableData.getState().setIsRefreshingTableData(true)

  await queryClient.invalidateQueries({
    queryKey: ['tableData', selectedDatabaseTable.name, selectedDatabaseFile.path],
    exact: true,
  })
  await queryClient.refetchQueries({
    queryKey: ['tableData', selectedDatabaseTable.name, selectedDatabaseFile.path],
    exact: true,
    type: 'active',
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

    // Invalidate database files after a successful push so later lookups resolve fresh files.
    void queryClient.invalidateQueries({
      queryKey: ['databaseFiles', selectedDevice.id, selectedApplication?.bundleId],
    })

    console.log('Database file pushed successfully')
    return { success: true }
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
