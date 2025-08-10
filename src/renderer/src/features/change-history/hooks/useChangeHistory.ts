import type { ChangeEvent, ContextSummary } from '@renderer/types/changeHistory'
import { useCurrentDatabaseSelection } from '@renderer/features/database/stores'
import { useCurrentDeviceSelection } from '@renderer/features/devices/stores'
import { generateContextKey } from '@renderer/shared/utils/contextKey'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { changeHistoryQueryKeys } from './queryKeys'

/**
 * Hook for fetching change history for the current database context
 * @param limit - Maximum number of changes to fetch
 * @param offset - Offset for pagination
 * @returns Query result with change history
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
    queryKey: changeHistoryQueryKeys.paginatedList(deviceId, packageName, databasePath, limit, offset),
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
 * @returns Query result with context summaries
 */
export function useContextSummaries() {
  return useQuery({
    queryKey: changeHistoryQueryKeys.summaries(),
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
 * @returns Query result with diagnostics data
 */
export function useChangeHistoryDiagnostics() {
  return useQuery({
    queryKey: changeHistoryQueryKeys.diagnostics(),
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
 * @returns Object with refresh functions for different query types
 */
export function useChangeHistoryRefresh() {
  const queryClient = useQueryClient()
  
  return {
    refreshChangeHistory: () => {
      console.log('🔄 [Refresh] refreshChangeHistory called - invalidating queries')
      try {
        queryClient.invalidateQueries({
          queryKey: changeHistoryQueryKeys.all,
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
          queryKey: changeHistoryQueryKeys.summaries(),
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
          queryKey: changeHistoryQueryKeys.diagnostics(),
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
          queryKey: changeHistoryQueryKeys.all,
        })
        console.log('🔄 [Refresh] Successfully invalidated all queries')
      }
      catch (error) {
        console.error('🔄 [Refresh] Error invalidating all queries:', error)
      }
    },
  }
}
