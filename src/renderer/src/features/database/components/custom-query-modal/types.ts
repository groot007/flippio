export interface CustomQueryModalProps {
  isOpen: boolean
  onClose: () => void
}

export interface CustomQueryModalPresenterProps {
  isOpen: boolean
  query: string
  onQueryChange: (query: string) => void
  onExecute: () => void
  onClose: () => void
  isDisabled: boolean
}
