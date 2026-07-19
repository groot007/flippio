import { useDatabaseFiles } from '@renderer/hooks/useDatabaseFiles'
import { useDatabaseTables } from '@renderer/hooks/useDatabaseTables'
import { useTableDataQuery } from '@renderer/hooks/useTableDataQuery'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection } from '@renderer/store'
import { toaster } from '@renderer/ui/toaster'
import { useCallback } from 'react'

interface RefreshDatabaseOptions {
  refreshDatabaseFiles?: boolean
  refreshDatabaseTables?: boolean
  refreshTableData?: boolean
  showSuccessToast?: boolean
  showErrorToast?: boolean
}

/**
 * Utility function to refresh database files, tables, and table data
 * Handles success/error notifications consistently across the app
 */
export async function refreshDatabase({
  refetchDatabaseFiles,
  refetchDatabaseTables,
  refetchTable,
  refreshDatabaseFiles = true,
  refreshDatabaseTables = true,
  refreshTableData = true,
  showSuccessToast = true,
  showErrorToast = true,
}: {
  refetchDatabaseFiles?: () => Promise<any>
  refetchDatabaseTables?: () => Promise<any>
  refetchTable?: () => Promise<any>
  refreshDatabaseFiles?: boolean
  refreshDatabaseTables?: boolean
  refreshTableData?: boolean
  showSuccessToast?: boolean
  showErrorToast?: boolean
} = {}) {
  try {
    let databaseFilesResult: any

    // Refresh database files if refetch function provided
    if (refreshDatabaseFiles && refetchDatabaseFiles) {
      databaseFilesResult = await refetchDatabaseFiles()
    }

    // Refresh database tables if refetch function provided
    if (refreshDatabaseTables && refetchDatabaseTables) {
      await refetchDatabaseTables()
    }

    // Refresh table data if refetch function provided
    if (refreshTableData && refetchTable) {
      await refetchTable()
    }

    // Show success notification
    if (showSuccessToast) {
      toaster.create({
        title: 'Success',
        description: 'Database refreshed',
        type: 'success',
        duration: 3000,
      })
    }

    return databaseFilesResult
  }
  catch (error) {
    console.error('Error refreshing database:', error)
    
    // Show error notification
    if (showErrorToast) {
      toaster.create({
        title: 'Error refreshing database',
        description: error instanceof Error ? error.message : 'Failed to refresh database',
        type: 'error',
        duration: 3000,
      })
    }
    
    // Re-throw to allow caller to handle if needed
    throw error
  }
}

/**
 * Hook that provides a database refresh handler using the current context
 * Automatically uses the current device, application, database file, and table selections
 * Returns an object with the refresh function and loading state
 */
export function useDatabaseRefresh(options: RefreshDatabaseOptions = {}) {
  const selectedDevice = useCurrentDeviceSelection(state => state.selectedDevice)
  const selectedApplication = useCurrentDeviceSelection(state => state.selectedApplication)
  const selectedDatabaseFile = useCurrentDatabaseSelection(state => state.selectedDatabaseFile)
  const selectedDatabaseTable = useCurrentDatabaseSelection(state => state.selectedDatabaseTable)

  // Get refetch functions and loading states from hooks
  const { refetch: refetchDatabaseFiles, isFetching: isFetchingDatabaseFiles } = useDatabaseFiles(selectedDevice, selectedApplication)
  const { refetch: refetchDatabaseTables, isFetching: isFetchingDatabaseTables } = useDatabaseTables(selectedDatabaseFile, selectedDevice)
  const { refetch: refetchTable, isFetching: isFetchingTable } = useTableDataQuery(selectedDatabaseTable?.name || '')

  // Combine all loading states
  const isLoading = isFetchingDatabaseFiles || isFetchingDatabaseTables || isFetchingTable

  const refresh = useCallback(async (overrideOptions: RefreshDatabaseOptions = {}) => {
    await refreshDatabase({
      refetchDatabaseFiles,
      refetchDatabaseTables,
      refetchTable,
      ...options,
      ...overrideOptions,
    })
  }, [refetchDatabaseFiles, refetchDatabaseTables, refetchTable, options])

  return { refresh, isLoading }
}

/**
 * @deprecated Use useDatabaseRefresh hook instead
 * Hook-based wrapper for refreshDatabase that automatically provides
 * the refresh functions from common hooks
 */
export function createDatabaseRefreshHandler({
  refetchDatabaseFiles,
  refetchDatabaseTables,
  refetchTable,
}: {
  refetchDatabaseFiles?: () => Promise<any>
  refetchDatabaseTables?: () => Promise<any>
  refetchTable?: () => Promise<any>
}) {
  return async (options: RefreshDatabaseOptions = {}) => {
    return refreshDatabase({
      refetchDatabaseFiles,
      refetchDatabaseTables,
      refetchTable,
      ...options,
    })
  }
}
