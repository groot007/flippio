import { generateContextKeySync } from '@renderer/shared/utils/contextKey'
import { useCurrentDatabaseSelection } from '@renderer/store/useCurrentDatabaseSelection'
import { useCurrentDeviceSelection } from '@renderer/store/useCurrentDeviceSelection'
import { toaster } from '@renderer/ui/toaster'
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
      console.log('🧹 [Clear History] Starting clear mutation...')
      
      const deviceId = selectedDevice?.id
      const packageName = selectedApplication?.bundleId || selectedDatabaseFile?.packageName
      const databasePath = selectedDatabaseFile?.path

      console.log('🧹 [Clear History] Context:', { deviceId, packageName, databasePath })

      if (!databasePath) {
        console.error('🧹 [Clear History] Missing database path')
        throw new Error('Database path is required for clearing change history')
      }

      const contextKey = generateContextKeySync(deviceId, packageName, databasePath)
      console.log('🧹 [Clear History] Generated context key:', contextKey)
      
      console.log('🧹 [Clear History] Calling API...')
      const result = await window.api.clearContextChanges(contextKey)
      console.log('🧹 [Clear History] API result:', result)

      if (!result.success) {
        console.error('🧹 [Clear History] API failed:', result.error)
        throw new Error(result.error || 'Failed to clear change history')
      }

      console.log('🧹 [Clear History] Successfully cleared')
      return result
    },
    onSuccess: () => {
      console.log('🧹 [Clear History] Mutation success - invalidating queries')
      
      // More aggressive cache clearing
      queryClient.removeQueries({
        queryKey: ['changeHistory'],
      })
      queryClient.removeQueries({
        queryKey: ['contextSummaries'],
      })
      queryClient.removeQueries({
        queryKey: ['changeHistoryDiagnostics'],
      })
      
      // Also invalidate to trigger refetch
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
        closable: true,
      })
    },
    onError: (error) => {
      console.error('🧹 [Clear History] Mutation error:', error)
      toaster.create({
        title: 'Clear Failed',
        description: error instanceof Error ? error.message : 'Failed to clear change history',
        type: 'error',
        duration: 5000,
        closable: true,
      })
    },
  })
}

/**
 * Nuclear option: Clear ALL change history from memory
 */
export function useClearAllChangeHistoryMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      console.log('💥 [Nuclear Clear] Starting nuclear clear mutation...')
      
      console.log('💥 [Nuclear Clear] Calling API...')
      const result = await window.api.clearAllChangeHistory()
      console.log('💥 [Nuclear Clear] API result:', result)

      if (!result.success) {
        console.error('💥 [Nuclear Clear] API failed:', result.error)
        throw new Error(result.error || 'Failed to clear all change history')
      }

      console.log('💥 [Nuclear Clear] Successfully cleared all history')
      return result
    },
    onSuccess: () => {
      console.log('💥 [Nuclear Clear] Mutation success - clearing all caches')
      
      // Nuclear cache clearing - remove everything related to change history
      queryClient.removeQueries({
        queryKey: ['changeHistory'],
      })
      queryClient.removeQueries({
        queryKey: ['contextSummaries'],
      })
      queryClient.removeQueries({
        queryKey: ['changeHistoryDiagnostics'],
      })
      
      // Set empty data immediately to prevent reverting
      queryClient.setQueryData(['changeHistory'], [])
      queryClient.setQueryData(['contextSummaries'], [])

      toaster.create({
        title: 'All Change History Cleared',
        description: 'Complete change history database has been wiped clean',
        type: 'success',
        duration: 3000,
        closable: true,
      })
    },
    onError: (error) => {
      console.error('💥 [Nuclear Clear] Mutation error:', error)
      toaster.create({
        title: 'Nuclear Clear Failed',
        description: error instanceof Error ? error.message : 'Failed to clear all change history',
        type: 'error',
        duration: 5000,
        closable: true,
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
