/**
 * Enhanced Button Component
 * 
 * A reusable button component with consistent styling and behavior.
 * Demonstrates senior developer patterns:
 * - Proper TypeScript interfaces
 * - Performance optimization with React.memo
 * - Accessibility best practices
 * - Composable design
 */

import type { ButtonProps as ChakraButtonProps } from '@chakra-ui/react'
import { Button as ChakraButton } from '@chakra-ui/react'
import React from 'react'

/**
 * Extended button props with additional functionality
 */
export interface ButtonProps extends Omit<ChakraButtonProps, 'size'> {
  /** Button size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** Button variant */
  variant?: 'solid' | 'outline' | 'ghost' | 'subtle' | 'surface'
  /** Whether button is in loading state */
  isLoading?: boolean
  /** Loading text to display */
  loadingText?: string
  /** Icon to display on the left */
  leftIcon?: React.ReactElement
  /** Icon to display on the right */
  rightIcon?: React.ReactElement
  /** Tooltip text for accessibility */
  tooltip?: string
  /** Whether to show tooltip on hover */
  showTooltip?: boolean
  /** Click handler with proper typing */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>
}

/**
 * Enhanced Button component with consistent styling and accessibility
 */
export const Button: React.FC<ButtonProps> = React.memo(({
  children,
  size = 'md',
  variant = 'solid',
  isLoading = false,
  loadingText,
  leftIcon,
  rightIcon,
  tooltip,
  showTooltip = Boolean(tooltip),
  onClick,
  disabled,
  'aria-label': ariaLabel,
  ...rest
}) => {
  // Handle async onClick handlers
  const handleClick = React.useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick && !isLoading && !disabled) {
      await onClick(event)
    }
  }, [onClick, isLoading, disabled])

  // Generate accessible label if not provided
  const accessibleLabel = ariaLabel || (typeof children === 'string' ? children : tooltip)

  return (
    <ChakraButton
      size={size}
      variant={variant}
      loading={isLoading}
      loadingText={loadingText}
      disabled={disabled || isLoading}
      onClick={handleClick}
      aria-label={accessibleLabel}
      title={showTooltip ? tooltip : undefined}
      _focus={{
        outline: '2px solid',
        outlineColor: 'flipioPrimary',
        outlineOffset: '2px',
      }}
      _focusVisible={{
        outline: '2px solid',
        outlineColor: 'flipioPrimary',
        outlineOffset: '2px',
      }}
      {...rest}
    >
      {leftIcon && (
        <span style={{ marginRight: '0.5rem', display: 'flex', alignItems: 'center' }}>
          {leftIcon}
        </span>
      )}
      {children}
      {rightIcon && (
        <span style={{ marginLeft: '0.5rem', display: 'flex', alignItems: 'center' }}>
          {rightIcon}
        </span>
      )}
    </ChakraButton>
  )
})

Button.displayName = 'Button'

/**
 * Icon-only button variant for compact layouts
 */
export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'leftIcon' | 'rightIcon'> {
  /** Icon to display */
  'icon': React.ReactElement
  /** Accessible label (required for icon buttons) */
  'aria-label': string
}

export const IconButton: React.FC<IconButtonProps> = React.memo(({
  icon,
  size = 'md',
  ...rest
}) => {
  return (
    <Button
      size={size}
      minW={0}
      px={size === 'xs' ? 1 : size === 'sm' ? 2 : 3}
      {...rest}
    >
      {icon}
    </Button>
  )
})

IconButton.displayName = 'IconButton'

/**
 * Button group for related actions
 */
export interface ButtonGroupProps {
  /** Button components to group */
  children: React.ReactNode
  /** Spacing between buttons */
  spacing?: number | string
  /** Whether buttons should be attached */
  isAttached?: boolean
  /** Orientation of the group */
  orientation?: 'horizontal' | 'vertical'
  /** Size for all buttons in group */
  size?: ButtonProps['size']
  /** Variant for all buttons in group */
  variant?: ButtonProps['variant']
}

export const ButtonGroup: React.FC<ButtonGroupProps> = React.memo(({
  children,
  spacing = 2,
  isAttached = false,
  orientation = 'horizontal',
  size,
  variant,
}) => {
  const buttonChildren = React.Children.map(children, (child) => {
    if (React.isValidElement(child) && child.type === Button) {
      return React.cloneElement(child as React.ReactElement<any>, {
        size: size || child.props.size,
        variant: variant || child.props.variant,
      })
    }
    return child
  })

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: orientation === 'vertical' ? 'column' : 'row',
        gap: isAttached ? 0 : spacing,
      }}
      role="group"
    >
      {buttonChildren}
    </div>
  )
})

ButtonGroup.displayName = 'ButtonGroup'
