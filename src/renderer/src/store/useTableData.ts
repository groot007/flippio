import { create } from 'zustand'

interface TableData {
  rows: any[]
  columns: any[]
  isCustomQuery?: boolean
  customQuery?: string
  tableName?: string
}

interface TableDataHook {
  tableData: TableData | null
  setTableData: (data: TableData) => void
  clearTableData: () => void
  isLoadingTableData: boolean
  setIsLoadingTableData: (loading: boolean) => void
  isRefreshingTableData: boolean
  setIsRefreshingTableData: (refreshing: boolean) => void
}

export const useTableData = create<TableDataHook>((set, _get) => ({
  tableData: null,
  setTableData: data => set({ tableData: data }),
  clearTableData: () => set({ tableData: null }),
  isLoadingTableData: false,
  setIsLoadingTableData: loading => set({ isLoadingTableData: loading }),
  isRefreshingTableData: false,
  setIsRefreshingTableData: refreshing => set({ isRefreshingTableData: refreshing }),
}))
