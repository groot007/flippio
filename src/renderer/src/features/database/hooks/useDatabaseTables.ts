import type { DatabaseFile } from '@renderer/types'
import { transformToCamelCase } from '@renderer/shared/utils/caseTransformer'
import { useQuery } from '@tanstack/react-query'
import { databaseQueryKeys } from './queryKeys'

interface Device {
  id: string
}

/**
 * Hook for fetching database tables from a selected database file
 * @param selectedDatabaseFile - The database file to query tables from
 * @param selectedDevice - The device containing the database (for device files)
 * @returns Query result with tables data
 */
export function useDatabaseTables(
  selectedDatabaseFile: DatabaseFile | null,
  selectedDevice: Device | null,
) {
  return useQuery({
    queryKey: selectedDatabaseFile?.path 
      ? databaseQueryKeys.tableList(selectedDatabaseFile.path, selectedDevice?.id)
      : databaseQueryKeys.tables(),
    queryFn: async () => {
      if (!selectedDatabaseFile?.path) {
        throw new Error('Database file not selected')
      }

      // For desktop/local files, we don't need a device
      // For device files, we need both device and database file
      if (selectedDatabaseFile.deviceType !== 'desktop' && !selectedDevice?.id) {
        throw new Error('Device not selected for device database file')
      }

      const dbPath = selectedDatabaseFile.path
      await window.api.openDatabase(dbPath)

      // Pass the database path to getTables to ensure it uses the correct connection
      const response = await window.api.getTables(dbPath)

      console.log('Database tables response:', response)

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch tables')
      }

      return {
        tables: transformToCamelCase(response.tables),
      }
    },
    enabled: !!selectedDatabaseFile?.path
      && (selectedDatabaseFile?.deviceType === 'desktop' || !!selectedDevice?.id),
    gcTime: 1000 * 60 * 5, // 5 minutes
    staleTime: 1000 * 60, // 1 minute
    retry: 1,
  })
}
