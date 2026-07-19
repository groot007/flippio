import { useCurrentDatabaseSelection, useCurrentDeviceSelection } from '@renderer/store'
import { ensureActiveDatabaseFile } from '@renderer/utils/databaseFileResolver'
import { useQuery } from '@tanstack/react-query'

interface TableDataResponse {
  success: boolean
  columns?: { name: string, type: string }[]
  rows?: Record<string, any>[]
  error?: string
}

export function useTableDataQuery(tableName: string) {
  const selectedDatabaseFile = useCurrentDatabaseSelection(state => state.selectedDatabaseFile)
  const setSelectedDatabaseFile = useCurrentDatabaseSelection(state => state.setSelectedDatabaseFile)
  const selectedDevice = useCurrentDeviceSelection(state => state.selectedDevice)
  const selectedApplication = useCurrentDeviceSelection(state => state.selectedApplication)
  
  return useQuery({
    queryKey: ['tableData', tableName, selectedDatabaseFile?.path],
    queryFn: async () => {
      if (!tableName) {
        throw new Error('No table selected')
      }

      if (!selectedDatabaseFile?.path) {
        throw new Error('No database file selected')
      }

      console.info('CriticalPath: table data load started', {
        databasePath: selectedDatabaseFile.path,
        tableName,
      })

      let resolvedDatabaseFile = await ensureActiveDatabaseFile({
        databaseFile: selectedDatabaseFile,
        selectedDevice,
        selectedApplication,
        setSelectedDatabaseFile,
      })

      console.log('🔄 Opening database before fetching table data:', resolvedDatabaseFile.path)

      // Small delay to ensure connection is established
      await new Promise(resolve => setTimeout(resolve, 100))

      console.log('📊 Fetching table data for:', tableName)
      let response: TableDataResponse = await window.api.getTableInfo(tableName, resolvedDatabaseFile.path)

      if (!response.success && response.error?.includes('Database file does not exist')) {
        resolvedDatabaseFile = await ensureActiveDatabaseFile({
          databaseFile: resolvedDatabaseFile,
          selectedDevice,
          selectedApplication,
          setSelectedDatabaseFile,
          forceRefresh: true,
        })
        response = await window.api.getTableInfo(tableName, resolvedDatabaseFile.path)
      }

      console.log('Table data response:', response)

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch table data')
      }

      if (!response.columns || !response.rows) {
        throw new Error('Invalid data structure received')
      }

      console.info('CriticalPath: table data load completed', {
        databasePath: resolvedDatabaseFile.path,
        tableName,
        rowCount: response.rows.length,
        columnCount: response.columns.length,
      })

      return {
        columns: response.columns,
        rows: response.rows,
      }
    },
    enabled: !!tableName && !!selectedDatabaseFile?.path,
    staleTime: 0,
    gcTime: 0,
    retry: (failureCount, error) => {
      // Retry transient file/connection races during fast selection changes.
      if (
        failureCount < 3
        && (
          error.message.includes('no such table')
          || error.message.includes('Database file does not exist')
          || error.message.includes('Failed to open database')
        )
      ) {
        console.log(`🔄 Retrying table data fetch (attempt ${failureCount + 1}/3):`, error.message)
        return true
      }
      return false
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 3000), // Exponential backoff
  })
}
