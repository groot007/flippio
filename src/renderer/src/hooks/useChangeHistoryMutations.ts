import { useCurrentDatabaseSelection } from '@renderer/store/useCurrentDatabaseSelection'
import { useCurrentDeviceSelection } from '@renderer/store/useCurrentDeviceSelection'
import { toaster } from '@renderer/ui/toaster'
import { generateContextKeySync } from '@renderer/utils/contextKey'
import { useMutation, useQueryClient } from '@tanstack/react-query'

/**
 * Hook for clearing change history for the current context
 */
export function useClearChangeHistoryMutation() {
  const queryClient = useQueryClient()
  const { selectedDevice, selectedApplication } = useCurrentDeviceSelection()
  const { selectedDatabaseFile } = useCurrentDatabaseSelection()

  return useMutation({
    mutationFn: async () => {
      const deviceId = selectedDevice?.id
      const packageName = selectedApplication?.bundleId || selectedDatabaseFile?.packageName
      const databasePath = selectedDatabaseFile?.path

      if (!deviceId || !packageName || !databasePath) {
        throw new Error('Missing required context for clearing change history')
      }

      const contextKey = generateContextKeySync(deviceId, packageName, databasePath)
      const result = await window.api.clearContextChanges(contextKey)

      if (!result.success) {
        throw new Error(result.error || 'Failed to clear change history')
      }

      return result
    },
    onSuccess: () => {
      // Invalidate all change history queries
      queryClient.invalidateQueries({
        queryKey: ['changeHistory'],
      })
      queryClient.invalidateQueries({
        queryKey: ['contextSummaries'],
      })
      queryClient.invalidateQueries({
        queryKey: ['changeHistoryDiagnostics'],
      })

      toaster.create({
        title: 'Change History Cleared',
        description: 'All change history for this database has been cleared',
        type: 'success',
        duration: 3000,
      })
    },
    onError: (error) => {
      console.error('Error clearing change history:', error)
      toaster.create({
        title: 'Clear Failed',
        description: error instanceof Error ? error.message : 'Failed to clear change history',
        type: 'error',
        duration: 5000,
      })
    },
  })
}

/**
 * Enhanced mutation hooks that refresh change history after database operations
 */
export function useEnhancedTableMutations() {
  const queryClient = useQueryClient()
  
  const refreshChangeHistory = () => {
    queryClient.invalidateQueries({
      queryKey: ['changeHistory'],
    })
    queryClient.invalidateQueries({
      queryKey: ['contextSummaries'],
    })
  }

  return {
    refreshChangeHistory,
    
    // Helper to wrap existing mutations with change history refresh
    wrapMutationWithHistoryRefresh: <T extends (...args: any[]) => any>(mutation: T): T => {
      return ((...args: Parameters<T>) => {
        const result = mutation(...args)
        
        // If it's a promise-like result, refresh after success
        if (result && typeof result.then === 'function') {
          return result.then((value: any) => {
            refreshChangeHistory()
            return value
          })
        }
        
        // Otherwise refresh immediately
        refreshChangeHistory()
        return result
      }) as T
    },
  }
}
