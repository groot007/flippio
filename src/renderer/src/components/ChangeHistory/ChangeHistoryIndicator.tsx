import { Badge, IconButton } from '@chakra-ui/react'
import { useChangeHistory } from '@renderer/hooks/useChangeHistory'
import { useState } from 'react'
import { LuClock } from 'react-icons/lu'
import { ChangeHistoryPanel } from './ChangeHistoryPanel'

interface ChangeHistoryIndicatorProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'solid' | 'ghost' | 'outline'
}

export function ChangeHistoryIndicator({
  size = 'sm'
}: ChangeHistoryIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { data: changes = [], isLoading, error } = useChangeHistory(10, 0)
  
  const changeCount = changes.length
  // Only show badge if there are actual changes AND no error
  const hasChanges = changeCount > 0 && !error
  
  // Add debugging
  console.log('🔍 [ChangeHistoryIndicator] Component render:', {
    changes,
    changeCount,
    isLoading,
    error,
    hasChanges,
    changesType: typeof changes,
    changesIsArray: Array.isArray(changes)
  })
  
  // Always grey indicator, colored badge when has changes
  const indicatorVariant = 'ghost'
  const indicatorColorScheme = 'gray'

  return (
    <>
      <IconButton
        aria-label={error ? 'Change history (unavailable)' : `Change history (${changeCount} changes)`}
        size={size}
        variant={indicatorVariant}
        colorScheme={indicatorColorScheme}
        onClick={() => setIsOpen(!isOpen)}
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
            bg="blue.500"
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
        onClose={() => setIsOpen(false)}
      />
    </>
  )
}
