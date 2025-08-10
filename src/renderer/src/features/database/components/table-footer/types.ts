import type { AgGridReact } from 'ag-grid-react'

export interface TableFooterProps {
  gridRef: React.RefObject<AgGridReact>
  totalRows: number
  onPageSizeChange?: (pageSize: number) => void
}

export interface TableFooterPresenterProps {
  colorMode: 'light' | 'dark'
  pageSize: number
  currentPage: number
  totalPages: number
  _totalRows: number
  isLoading: boolean
  selectedTableName?: string
  onPageSizeChange: (pageSize: number) => void
  onPageChange: (page: number) => void
  onOpenClearTableDialog: () => void
  getDisplayedRowRange: () => string
}
