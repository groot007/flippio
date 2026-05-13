import { fetchDatabaseFilesForSelection } from '@renderer/hooks/useDatabaseFiles'
import { useCurrentDeviceSelection } from '@renderer/store'
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

      let resolvedDatabaseFile = selectedDatabaseFile

      const openSelectedDatabase = async (dbPath: string) => {
        const openResponse = await window.api.openDatabase(dbPath)

        if (!openResponse.success) {
          throw new Error(openResponse.error || 'Failed to open database')
        }
      }

      const shouldRecoverMissingTempFile = (error: Error) =>
        error.message.includes('Database file does not exist')
        && resolvedDatabaseFile?.deviceType !== 'desktop'
        && !!resolvedDatabaseFile?.filename
        && !!selectedDevice?.id
        && !!selectedApplication?.bundleId

      const recoverMissingTempDatabaseFile = async (sourceError: Error) => {
        if (!shouldRecoverMissingTempFile(sourceError)) {
          throw sourceError
        }

        console.warn('CriticalPath: selected temp database file missing, refetching database files', {
          missingPath: resolvedDatabaseFile.path,
          remotePath: resolvedDatabaseFile.remotePath ?? null,
          filename: resolvedDatabaseFile.filename,
        })

        const refreshedDatabaseFiles = await fetchDatabaseFilesForSelection(selectedDevice!, selectedApplication!)
        const matchedDatabaseFile = refreshedDatabaseFiles.find(file =>
          (resolvedDatabaseFile.remotePath && file.remotePath === resolvedDatabaseFile.remotePath)
          || file.path === resolvedDatabaseFile.path
          || file.filename === resolvedDatabaseFile.filename,
        )

        if (!matchedDatabaseFile) {
          throw sourceError
        }

        resolvedDatabaseFile = matchedDatabaseFile
        setSelectedDatabaseFile(matchedDatabaseFile)
        await openSelectedDatabase(matchedDatabaseFile.path)
      }

      // Ensure database is opened before fetching table data
      console.log('🔄 Opening database before fetching table data:', resolvedDatabaseFile.path)

      try {
        await openSelectedDatabase(resolvedDatabaseFile.path)
      }
      catch (error) {
        const resolvedError = error instanceof Error ? error : new Error(String(error))
        await recoverMissingTempDatabaseFile(resolvedError)
      }

      // Small delay to ensure connection is established
      await new Promise(resolve => setTimeout(resolve, 100))

      console.log('📊 Fetching table data for:', tableName)
      let response: TableDataResponse = await window.api.getTableInfo(tableName, resolvedDatabaseFile.path)

      if (!response.success && response.error?.includes('Database file does not exist')) {
        await recoverMissingTempDatabaseFile(new Error(response.error))
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
