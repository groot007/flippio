import type { DatabaseFile } from '@renderer/types'
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

      let dbPath = selectedDatabaseFile.path

      if (selectedDatabaseFile.deviceType === 'android') {
        const pull = await window.api.pullDatabaseFile(
          selectedDevice.id,
          selectedDatabaseFile.path,
        )

        if (!pull.success) {
          throw new Error(pull.error || 'Failed to pull database file')
        }

        dbPath = pull.path
      }

      await window.api.openDatabase(dbPath)

      const response = await window.api.getTables()

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch tables')
      }

      return {
        tables: response.tables,
        pulledPath: dbPath,
      }
    },
    enabled: !!selectedDatabaseFile?.path && !!selectedDevice?.id,
    gcTime: 1000 * 60 * 5, // 5 minutes
    staleTime: 1000 * 60, // 1 minute
    retry: 1,
  })
}
