/**
 * Query key factories for database-related queries
 * Provides consistent query keys and type safety for React Query
 */
export const databaseQueryKeys = {
  all: ['database'] as const,
  files: () => [...databaseQueryKeys.all, 'files'] as const,
  fileList: (deviceId: string, bundleId: string) => 
    [...databaseQueryKeys.files(), deviceId, bundleId] as const,
  tables: () => [...databaseQueryKeys.all, 'tables'] as const,
  tableList: (databasePath: string, deviceId?: string) => 
    [...databaseQueryKeys.tables(), databasePath, deviceId] as const,
  tableData: () => [...databaseQueryKeys.all, 'tableData'] as const,
  tableDataQuery: (tableName: string, databasePath: string) => 
    [...databaseQueryKeys.tableData(), tableName, databasePath] as const,
} as const

export type DatabaseQueryKeys = typeof databaseQueryKeys
