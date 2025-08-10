import type { ChangeHistoryPanelProps } from '@renderer/features/change-history/components/change-history-panel'
import { ChangeHistoryPanel as ChangeHistoryPanelContainer } from '@renderer/features/change-history/components/change-history-panel'

export function ChangeHistoryPanel(props: ChangeHistoryPanelProps) {
  return <ChangeHistoryPanelContainer {...props} />
}
