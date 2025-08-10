/**
 * Query key factories for change history-related queries
 * Provides consistent query keys and type safety for React Query
 */
export const changeHistoryQueryKeys = {
  all: ['changeHistory'] as const,
  lists: () => [...changeHistoryQueryKeys.all, 'list'] as const,
  list: (deviceId?: string, packageName?: string, databasePath?: string) => 
    [...changeHistoryQueryKeys.lists(), deviceId, packageName, databasePath] as const,
  paginatedList: (deviceId?: string, packageName?: string, databasePath?: string, limit?: number, offset?: number) => 
    [...changeHistoryQueryKeys.list(deviceId, packageName, databasePath), limit, offset] as const,
  summaries: () => [...changeHistoryQueryKeys.all, 'summaries'] as const,
  diagnostics: () => [...changeHistoryQueryKeys.all, 'diagnostics'] as const,
} as const

export type ChangeHistoryQueryKeys = typeof changeHistoryQueryKeys
