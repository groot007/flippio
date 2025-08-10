import type { ChangeHistoryIndicatorProps } from './types'

import { useChangeHistory } from '@renderer/features/change-history/hooks'
import { formatDistanceToNow } from 'date-fns'

import { useState } from 'react'

import { ChangeHistoryIndicatorPresenter } from './ChangeHistoryIndicatorPresenter'

export function ChangeHistoryIndicator({
  size = 'sm',
}: ChangeHistoryIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { data: changes = [], isLoading, error } = useChangeHistory(10, 0)
  
  const changeCount = changes.length
  const hasChanges = changeCount > 0 && !error
  
  const latestChange = changes.length > 0 ? changes[0] : null
  const hoverTitle = latestChange 
    ? `Last change ${formatDistanceToNow(new Date(latestChange.timestamp), { addSuffix: true })}`
    : hasChanges 
      ? `${changeCount} changes available`
      : error 
        ? 'Change history unavailable'
        : 'No changes recorded'

  const handleToggleOpen = () => {
    setIsOpen(!isOpen)
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  return (
    <ChangeHistoryIndicatorPresenter
      size={size}
      isOpen={isOpen}
      changeCount={changeCount}
      hasChanges={hasChanges}
      isLoading={isLoading}
      error={error}
      hoverTitle={hoverTitle}
      onToggleOpen={handleToggleOpen}
      onClose={handleClose}
    />
  )
}
