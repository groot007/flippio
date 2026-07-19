import { useCurrentDatabaseSelection, useTableData } from '@renderer/store'
import { useMemo } from 'react'

export function useSelectionSessionTableState() {
  const selectedDatabaseFile = useCurrentDatabaseSelection(state => state.selectedDatabaseFile)
  const setSelectedDatabaseFile = useCurrentDatabaseSelection(state => state.setSelectedDatabaseFile)
  const tableData = useTableData(state => state.tableData)
  const setTableData = useTableData(state => state.setTableData)
  const setIsRefreshingTableData = useTableData(state => state.setIsRefreshingTableData)
  const isRefreshingTableData = useTableData(state => state.isRefreshingTableData)

  return useMemo(() => ({
    isRefreshingTableData,
    selectedDatabaseFile,
    setSelectedDatabaseFile,
    setIsRefreshingTableData,
    setTableData,
    tableData,
  }), [
    isRefreshingTableData,
    selectedDatabaseFile,
    setSelectedDatabaseFile,
    setIsRefreshingTableData,
    setTableData,
    tableData,
  ])
}
