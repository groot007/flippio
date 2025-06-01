import { useQuery } from '@tanstack/react-query'

interface TableDataResponse {
  success: boolean
  columns?: { name: string, type: string }[]
  rows?: Record<string, any>[]
  error?: string
}

export function useTableDataQuery(tableName: string) {
  return useQuery({
    queryKey: ['tableData', tableName],
    queryFn: async () => {
      if (!tableName) {
        throw new Error('No table selected')
      }

      const response: TableDataResponse = await window.api.getTableInfo(tableName)

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
    enabled: !!tableName,
    staleTime: 0,
    gcTime: 0,
    retry: 1,
  })
}
