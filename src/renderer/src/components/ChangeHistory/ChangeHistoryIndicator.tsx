import type { ChangeHistoryIndicatorProps } from '@renderer/features/change-history/components/change-history-indicator'
import { ChangeHistoryIndicator as ChangeHistoryIndicatorContainer } from '@renderer/features/change-history/components/change-history-indicator'

export function ChangeHistoryIndicator(props: ChangeHistoryIndicatorProps) {
  return <ChangeHistoryIndicatorContainer {...props} />
}
