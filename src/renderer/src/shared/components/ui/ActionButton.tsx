import type { ReactNode } from 'react'
import { Button } from '@chakra-ui/react'
import { memo } from 'react'

export interface ActionButtonProps {
  /**
   * Button label
   */
  children: ReactNode
  /**
   * Whether the button is in a loading state
   */
  isLoading?: boolean
  /**
   * Text to show when loading
   */
  loadingText?: string
  /**
   * Button variant
   */
  variant?: 'solid' | 'outline' | 'ghost' | 'subtle' | 'surface' | 'plain'
  /**
   * Button color scheme
   */
  colorScheme?: string
  /**
   * Button size
   */
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /**
   * Whether the button is disabled
   */
  disabled?: boolean
  /**
   * Click handler
   */
  onClick?: () => void
  /**
   * Additional CSS class
   */
  className?: string
  /**
   * Left icon element
   */
  leftIcon?: ReactNode
  /**
   * Right icon element
   */
  rightIcon?: ReactNode
}

/**
 * Reusable action button component with consistent styling and loading states
 */
export const ActionButton = memo<ActionButtonProps>(({
  children,
  isLoading = false,
  loadingText,
  variant = 'solid',
  colorScheme = 'blue',
  size = 'md',
  disabled = false,
  onClick,
  className,
  leftIcon,
  rightIcon,
}) => (
  <Button
    variant={variant}
    colorScheme={colorScheme}
    size={size}
    loading={isLoading}
    loadingText={loadingText}
    disabled={disabled}
    onClick={onClick}
    className={className}
  >
    {leftIcon && <span style={{ marginRight: '8px' }}>{leftIcon}</span>}
    {children}
    {rightIcon && <span style={{ marginLeft: '8px' }}>{rightIcon}</span>}
  </Button>
))

ActionButton.displayName = 'ActionButton'
