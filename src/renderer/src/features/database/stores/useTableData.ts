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
  setTableData: (data: TableData | null) => void
  isLoadingTableData: boolean
  setIsLoadingTableData: (loading: boolean) => void
}

export const useTableData = create<TableDataHook>((set, _get) => ({
  tableData: null,
  setTableData: data => set({ tableData: data }),
  isLoadingTableData: false,
  setIsLoadingTableData: loading => set({ isLoadingTableData: loading }),
}))
