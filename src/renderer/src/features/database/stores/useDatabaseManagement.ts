import type { DatabaseFile, DatabaseTable } from '@renderer/types'
import { useCurrentDatabaseSelection } from './useCurrentDatabaseSelection'
import { useRowEditingStore } from './useRowEditingStore'
import { useTableData } from './useTableData'

/**
 * Composite hook that provides complete database management functionality
 * Combines database selection, table data, and row editing for streamlined database workflows
 */
export function useDatabaseManagement() {
  const databaseStore = useCurrentDatabaseSelection()
  const tableStore = useTableData()
  const rowEditingStore = useRowEditingStore()

  return {
    // Database file selection
    selectedDatabaseFile: databaseStore.selectedDatabaseFile,
    databaseFiles: databaseStore.databaseFiles,
    setSelectedDatabaseFile: databaseStore.setSelectedDatabaseFile,
    setDatabaseFiles: databaseStore.setDatabaseFiles,
    pulledDatabaseFilePath: databaseStore.pulledDatabaseFilePath,
    setPulledDatabaseFilePath: databaseStore.setPulledDatabaseFilePath,
    
    // Database table selection
    selectedDatabaseTable: databaseStore.selectedDatabaseTable,
    databaseTables: databaseStore.databaseTables,
    setSelectedDatabaseTable: databaseStore.setSelectedDatabaseTable,
    setDatabaseTables: databaseStore.setDatabaseTables,
    
    // Database pulling state
    isDBPulling: databaseStore.isDBPulling,
    setIsDBPulling: databaseStore.setIsDBPulling,
    
    // Table data
    tableData: tableStore.tableData,
    setTableData: tableStore.setTableData,
    isLoadingTableData: tableStore.isLoadingTableData,
    setIsLoadingTableData: tableStore.setIsLoadingTableData,
    
    // Row editing
    selectedRow: rowEditingStore.selectedRow,
    setSelectedRow: rowEditingStore.setSelectedRow,
    
    // Convenience methods
    selectDatabaseFileAndClearTable: (file: DatabaseFile | null) => {
      databaseStore.setSelectedDatabaseFile(file)
      databaseStore.setSelectedDatabaseTable(null)
      databaseStore.setDatabaseTables([])
      tableStore.setTableData(null)
      rowEditingStore.setSelectedRow(null)
    },
    
    selectTableAndClearData: (table: DatabaseTable | null) => {
      databaseStore.setSelectedDatabaseTable(table)
      tableStore.setTableData(null)
      rowEditingStore.setSelectedRow(null)
      tableStore.setIsLoadingTableData(false)
    },
    
    clearAllDatabaseState: () => {
      databaseStore.setSelectedDatabaseFile(null)
      databaseStore.setSelectedDatabaseTable(null)
      databaseStore.setDatabaseFiles([])
      databaseStore.setDatabaseTables([])
      databaseStore.setPulledDatabaseFilePath('')
      tableStore.setTableData(null)
      tableStore.setIsLoadingTableData(false)
      rowEditingStore.setSelectedRow(null)
    },
    
    selectRowForEditing: (rowData: Record<string, any> | null, columnInfo?: any[]) => {
      if (rowData) {
        rowEditingStore.setSelectedRow({
          rowData,
          originalData: { ...rowData },
          columnInfo,
        })
      }
      else {
        rowEditingStore.setSelectedRow(null)
      }
    },
  }
}

export type DatabaseManagement = ReturnType<typeof useDatabaseManagement>
