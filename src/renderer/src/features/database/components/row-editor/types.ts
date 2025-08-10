export interface RowEditorProps {
  isEditing: boolean
  setIsEditing: (isEditing: boolean) => void
  isLoading: boolean
  setIsLoading: (isLoading: boolean) => void
  editedData: Record<string, any>
  setEditedData: (data: Record<string, any>) => void
}

export interface RowEditorPresenterProps {
  isEditing: boolean
  isLoading: boolean
  onStartEditing: () => void
  onSave: () => Promise<void>
  onCancel: () => void
}
