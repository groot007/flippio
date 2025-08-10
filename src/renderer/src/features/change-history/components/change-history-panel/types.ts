import type { ChangeEvent } from '@renderer/types/changeHistory'

export interface ChangeHistoryPanelProps {
  isOpen: boolean
  onClose: () => void
}

export interface ChangeHistoryPanelPresenterProps {
  isOpen: boolean
  onClose: () => void
  changes: ChangeEvent[]
  isLoading: boolean
  error: Error | null
  selectedChange: ChangeEvent | null
  isClearHistoryPending: boolean
  isDark: boolean
  selectedDevice: { id: string, name: string } | null
  selectedApplication: { name: string, bundleId?: string } | null
  selectedDatabaseFile: { filename: string, packageName?: string, path: string } | null
  onSelectChange: (change: ChangeEvent | null) => void
  onClearHistory: () => Promise<void>
  onRefresh: () => Promise<void>
}
