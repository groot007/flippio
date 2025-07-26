import { useCurrentDatabaseSelection } from '@renderer/store'
import { useQuery } from '@tanstack/react-query'

interface TableDataResponse {
  success: boolean
  columns?: { name: string, type: string }[]
  rows?: Record<string, any>[]
  error?: string
}

export function useTableDataQuery(tableName: string) {
  const selectedDatabaseFile = useCurrentDatabaseSelection(state => state.selectedDatabaseFile)
  
  return useQuery({
    queryKey: ['tableData', tableName, selectedDatabaseFile?.path],
    queryFn: async () => {
      if (!tableName) {
        throw new Error('No table selected')
      }

      if (!selectedDatabaseFile?.path) {
        throw new Error('No database file selected')
      }

      // Ensure database is opened before fetching table data
      console.log('🔄 Opening database before fetching table data:', selectedDatabaseFile.path)
      const openResponse = await window.api.openDatabase(selectedDatabaseFile.path)
      
      if (!openResponse.success) {
        throw new Error(openResponse.error || 'Failed to open database')
      }

      // Small delay to ensure connection is established
      await new Promise(resolve => setTimeout(resolve, 100))

      console.log('📊 Fetching table data for:', tableName)
      const response: TableDataResponse = await window.api.getTableInfo(tableName, selectedDatabaseFile.path)
      console.log('Table data response:', response)

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch table data')
      }

      if (!response.columns || !response.rows) {
        throw new Error('Invalid data structure received')
      }

      return {
        columns: response.columns,
        rows: response.rows,
      }
    },
    enabled: !!tableName && !!selectedDatabaseFile?.path,
    staleTime: 0,
    gcTime: 0,
    retry: (failureCount, error) => {
      // Retry up to 3 times for connection-related errors
      if (failureCount < 3 && error.message.includes('no such table')) {
        console.log(`🔄 Retrying table data fetch (attempt ${failureCount + 1}/3):`, error.message)
        return true
      }
      return false
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 3000), // Exponential backoff
  })
}
