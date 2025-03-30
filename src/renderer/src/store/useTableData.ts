import { create } from 'zustand'

interface TableDataHook {
  tableData: Record<string, any> | null
  setTableData: (data: Record<string, any>) => void
  isLoadingTableData: boolean
  setIsLoadingTableData: (loading: boolean) => void
}

export const useTableData = create<TableDataHook>((set, _get) => ({
  tableData: null,
  setTableData: data => set({ tableData: data }),
  isLoadingTableData: false,
  setIsLoadingTableData: loading => set({ isLoadingTableData: loading }),
}))
