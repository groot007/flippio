/**
 * RowEditor Component
 * 
 * This component provides row editing functionality with validation and save operations.
 * The business logic is handled in RowEditorContainer, while the UI rendering is in RowEditorPresenter.
 */

import { RowEditorContainer } from '@renderer/features/database/components'

interface RowEditorProps {
  isEditing: boolean
  setIsEditing: (isEditing: boolean) => void
  isLoading: boolean
  setIsLoading: (isLoading: boolean) => void
  editedData: Record<string, any>
  setEditedData: (data: Record<string, any>) => void
}

export const RowEditor: React.FC<RowEditorProps> = (props) => {
  return <RowEditorContainer {...props} />
}
