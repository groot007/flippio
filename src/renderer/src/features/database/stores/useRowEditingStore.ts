import { create } from 'zustand'

interface ColumnInfo {
  name: string
  type: string
}

interface SelectedRow {
  rowData: Record<string, any> | null
  originalData?: Record<string, any> | null
  columnInfo?: ColumnInfo[]
}

interface RowEditing {
  selectedRow: SelectedRow | null
  setSelectedRow: (rowData: SelectedRow | null) => void
}

export const useRowEditingStore = create<RowEditing>((set, _get) => ({
  selectedRow: null,
  setSelectedRow: rowData => set({
    selectedRow: rowData,
  }),
}))
