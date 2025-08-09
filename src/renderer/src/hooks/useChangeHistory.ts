import type { ChangeEvent, ContextSummary } from '@renderer/types/changeHistory'
import { useCurrentDatabaseSelection } from '@renderer/store/useCurrentDatabaseSelection'
import { useCurrentDeviceSelection } from '@renderer/store/useCurrentDeviceSelection'
import { generateContextKey } from '@renderer/utils/contextKey'
import { useQuery, useQueryClient } from '@tanstack/react-query'

/**
 * Hook for fetching change history for the current database context
 */
export function useChangeHistory(limit = 50, offset = 0) {
  const { selectedDevice, selectedApplication } = useCurrentDeviceSelection()
  const { selectedDatabaseFile } = useCurrentDatabaseSelection()
  
  const deviceId = selectedDevice?.id
  const packageName = selectedApplication?.bundleId || selectedDatabaseFile?.packageName
  const databasePath = selectedDatabaseFile?.path
  
  // Enable query if we have at least a database path (custom files need only this)
  const isEnabled = !!databasePath
  
  return useQuery({
    queryKey: ['changeHistory', deviceId, packageName, databasePath, limit, offset],
    queryFn: async () => {
      if (!databasePath) {
        console.error('🔍 [useChangeHistory] Missing database path')
        throw new Error('Database path is required for change history')
      }
      
      const contextKey = await generateContextKey(deviceId, packageName, databasePath)
      
      const result = await window.api.getChangeHistory(contextKey)
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch change history')
      }
      
      const changes = result.data as ChangeEvent[] || []
      
      if (changes.length > 0) {
        console.log('🔍 [useChangeHistory] First change:', changes[0])
      }
      
      const start = offset
      const end = start + limit
      const paginatedChanges = changes.slice(start, end)
    
      return paginatedChanges
    },
    enabled: isEnabled,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook for fetching all context summaries (overview of all tracked databases)
 */
export function useContextSummaries() {
  return useQuery({
    queryKey: ['contextSummaries'],
    queryFn: async () => {
      const result = await window.api.getContextSummaries()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch context summaries')
      }
      
      return result.summaries as ContextSummary[]
    },
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook for fetching change history diagnostics (memory usage, statistics)
 */
export function useChangeHistoryDiagnostics() {
  return useQuery({
    queryKey: ['changeHistoryDiagnostics'],
    queryFn: async () => {
      const result = await window.api.getChangeHistoryDiagnostics()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch change history diagnostics')
      }
      
      return result.diagnostics
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook for refreshing change history after database operations
 */
export function useChangeHistoryRefresh() {
  const queryClient = useQueryClient()
  
  return {
    refreshChangeHistory: () => {
      console.log('🔄 [Refresh] refreshChangeHistory called - invalidating queries')
      try {
        queryClient.invalidateQueries({
          queryKey: ['changeHistory'],
        })
        console.log('🔄 [Refresh] Successfully invalidated changeHistory queries')
      }
      catch (error) {
        console.error('🔄 [Refresh] Error invalidating changeHistory queries:', error)
      }
    },
    refreshContextSummaries: () => {
      console.log('🔄 [Refresh] refreshContextSummaries called')
      try {
        queryClient.invalidateQueries({
          queryKey: ['contextSummaries'],
        })
        console.log('🔄 [Refresh] Successfully invalidated contextSummaries queries')
      }
      catch (error) {
        console.error('🔄 [Refresh] Error invalidating contextSummaries queries:', error)
      }
    },
    refreshDiagnostics: () => {
      console.log('🔄 [Refresh] refreshDiagnostics called')
      try {
        queryClient.invalidateQueries({
          queryKey: ['changeHistoryDiagnostics'],
        })
        console.log('🔄 [Refresh] Successfully invalidated diagnostics queries')
      }
      catch (error) {
        console.error('🔄 [Refresh] Error invalidating diagnostics queries:', error)
      }
    },
    refreshAll: () => {
      console.log('🔄 [Refresh] refreshAll called')
      try {
        queryClient.invalidateQueries({
          queryKey: ['changeHistory'],
        })
        queryClient.invalidateQueries({
          queryKey: ['contextSummaries'],
        })
        queryClient.invalidateQueries({
          queryKey: ['changeHistoryDiagnostics'],
        })
        console.log('🔄 [Refresh] Successfully invalidated all queries')
      }
      catch (error) {
        console.error('🔄 [Refresh] Error invalidating all queries:', error)
      }
    },
  }
}
