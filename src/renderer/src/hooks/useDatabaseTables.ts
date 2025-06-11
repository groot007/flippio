import type { DatabaseFile } from '@renderer/types'
import { api } from '@renderer/lib/api-adapter'
import { useQuery } from '@tanstack/react-query'

interface Device {
  id: string
}

export function useDatabaseTables(
  selectedDatabaseFile: DatabaseFile | null,
  selectedDevice: Device | null,
) {
  return useQuery({
    queryKey: ['databaseTables', selectedDatabaseFile?.path, selectedDevice?.id],
    queryFn: async () => {
      if (!selectedDatabaseFile?.path || !selectedDevice?.id) {
        throw new Error('Database file or device not selected')
      }

      console.log('[useDatabaseTables] Opening database:', selectedDatabaseFile.path)
      const dbPath = selectedDatabaseFile.path
      await api.openDatabase(dbPath)

      const response = await api.getTables()

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch tables')
      }

      return {
        tables: response.tables,
      }
    },
    enabled: !!selectedDatabaseFile?.path && !!selectedDevice?.id,
    gcTime: 1000 * 60 * 5, // 5 minutes
    staleTime: 1000 * 60, // 1 minute
    retry: 1,
  })
}
