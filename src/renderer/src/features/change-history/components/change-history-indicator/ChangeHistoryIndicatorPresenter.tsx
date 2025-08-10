import type { ChangeHistoryIndicatorPresenterProps } from './types'

import { Badge, IconButton } from '@chakra-ui/react'
import { memo } from 'react'
import { LuClock } from 'react-icons/lu'

import { ChangeHistoryPanel } from '../change-history-panel'

function ChangeHistoryIndicatorPresenterImpl({
  size,
  isOpen,
  changeCount,
  hasChanges,
  isLoading,
  error,
  hoverTitle,
  onToggleOpen,
  onClose,
}: ChangeHistoryIndicatorPresenterProps) {
  const indicatorVariant = 'ghost'
  const indicatorColorScheme = 'gray'

  return (
    <>
      <IconButton
        aria-label={error ? 'Change history (unavailable)' : `Change history (${changeCount} changes)`}
        title={hoverTitle}
        size={size}
        variant={indicatorVariant}
        colorScheme={indicatorColorScheme}
        onClick={onToggleOpen}
        position="relative"
        loading={isLoading}
        opacity={error ? 0.5 : 1}
      >
        <LuClock />
        {hasChanges && (
          <Badge
            position="absolute"
            top="-1"
            right="-1"
            fontSize="xs"
            bg="gray.500"
            color="white"
            rounded="full"
            minW="18px"
            h="18px"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            {changeCount > 99 ? '99+' : changeCount}
          </Badge>
        )}
      </IconButton>
      
      <ChangeHistoryPanel
        isOpen={isOpen}
        onClose={onClose}
      />
    </>
  )
}

export const ChangeHistoryIndicatorPresenter = memo(ChangeHistoryIndicatorPresenterImpl)
