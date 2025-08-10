export interface ChangeHistoryIndicatorProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'solid' | 'ghost' | 'outline'
}

export interface ChangeHistoryIndicatorPresenterProps {
  size: 'sm' | 'md' | 'lg'
  isOpen: boolean
  changeCount: number
  hasChanges: boolean
  isLoading: boolean
  error: Error | null
  hoverTitle: string
  onToggleOpen: () => void
  onClose: () => void
}
