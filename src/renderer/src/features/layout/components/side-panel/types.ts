export interface SidePanelProps {
  selectedRow: any
  tableData: any
  isOpen: boolean
  isDark: boolean
  isLoading: boolean
  isEditing: boolean
  editedData: Record<string, any>
  isDeleteDialogOpen: boolean
  isClearTableDialogOpen: boolean
  
  onClosePanel: () => void
  onDeleteRow: () => void
  onClearTable: () => void
  onDeleteDialogOpen: () => void
  onDeleteDialogClose: () => void
  onClearTableDialogOpen: () => void
  onClearTableDialogClose: () => void
  onEditingChange: (isEditing: boolean) => void
  onLoadingChange: (isLoading: boolean) => void
  onEditedDataChange: (data: Record<string, any>) => void
  onFieldChange: (key: string, value: any) => void
}
