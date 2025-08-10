/**
 * Props for DataGridContainer component
 */
export interface DataGridContainerProps {
  className?: string
  height?: string | number
}

/**
 * Props for DataGridPresenter component
 */
export interface DataGridPresenterProps {
  colorMode: string
  tableData: any
  isLoadingTableData: boolean
  isAddingRow: boolean
  pageSize: number
  onRowClick: (event: any) => void
  onAddRow: () => void
  onFirstDataRendered: () => void
  onPageSizeChange: (pageSize: number) => void
  hasData: boolean
  error?: any
  className?: string
  height?: string | number
  selectedDatabaseTable?: any
}

/**
 * Props for custom header component
 */
export interface CustomHeaderComponentProps {
  displayName: string
  columnType?: string
}
