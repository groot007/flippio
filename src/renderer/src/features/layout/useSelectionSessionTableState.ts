import { useCurrentDatabaseSelection, useTableData } from '@renderer/store'
import { useMemo } from 'react'

export function useSelectionSessionTableState() {
  const selectedDatabaseFile = useCurrentDatabaseSelection(state => state.selectedDatabaseFile)
  const tableData = useTableData(state => state.tableData)
  const setTableData = useTableData(state => state.setTableData)
  const setIsRefreshingTableData = useTableData(state => state.setIsRefreshingTableData)
  const isRefreshingTableData = useTableData(state => state.isRefreshingTableData)

  return useMemo(() => ({
    isRefreshingTableData,
    selectedDatabaseFile,
    setIsRefreshingTableData,
    setTableData,
    tableData,
  }), [
    isRefreshingTableData,
    selectedDatabaseFile,
    setIsRefreshingTableData,
    setTableData,
    tableData,
  ])
}
