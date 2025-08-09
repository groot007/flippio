import type { MutationContext } from '@renderer/types/changeHistory'
import { buildUniqueCondition } from '@renderer/utils'
import { extractContextParams } from '@renderer/utils/contextBuilder'
import { useBaseDatabaseMutation } from './useBaseDatabaseMutation'

interface DeleteRowVariables extends MutationContext {
  selectedRow: any
  tableColumns: any[]
}

interface ClearTableVariables extends MutationContext {}

/**
 * Hook for deleting a single row from the table
 */
export function useDeleteRowMutation() {
  return useBaseDatabaseMutation<DeleteRowVariables, { selectedDatabaseFile: any, selectedDatabaseTable: any }>({
    mutationFn: async ({ selectedRow, selectedDatabaseTable, tableColumns, ...context }) => {
      if (!selectedRow || !selectedDatabaseTable) {
        throw new Error('Missing required data for deletion')
      }

      const condition = buildUniqueCondition(
        tableColumns,
        selectedRow?.originalData || selectedRow?.rowData,
      )
      
      const { deviceId, deviceName, deviceType, packageName, appName, databasePath } = extractContextParams(context)
      
      const result = await window.api.deleteTableRow(
        selectedDatabaseTable?.name || '',
        condition,
        databasePath,
        deviceId,
        deviceName,
        deviceType,
        packageName,
        appName,
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete row')
      }

      return { selectedDatabaseFile: context.selectedDatabaseFile, selectedDatabaseTable }
    },
    successMessage: 'Row deleted',
    errorMessage: 'Delete failed',
    shouldClosePanel: true,
  })
}

/**
 * Hook for clearing all rows from the table
 */
export function useClearTableMutation() {
  return useBaseDatabaseMutation<ClearTableVariables, { selectedDatabaseFile: any, selectedDatabaseTable: any }>({
    mutationFn: async ({ selectedDatabaseTable, ...context }) => {
      if (!selectedDatabaseTable) {
        throw new Error('No table selected')
      }

      const { deviceId, deviceName, deviceType, packageName, appName, databasePath } = extractContextParams(context)

      const result = await window.api.clearTable(
        selectedDatabaseTable.name,
        databasePath,
        deviceId,
        deviceName,
        deviceType,
        packageName,
        appName,
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to clear table')
      }

      return { selectedDatabaseFile: context.selectedDatabaseFile, selectedDatabaseTable }
    },
    successMessage: 'Table cleared',
    errorMessage: 'Clear table failed',
    shouldClosePanel: true,
  })
}
