/**
 * Enhanced Select Component
 * 
 * A reusable select component with consistent styling and behavior.
 * Features:
 * - Type-safe option handling
 * - Loading states
 * - Error states  
 * - Accessibility support
 */

import { HStack, NativeSelectField, NativeSelectRoot, Spinner } from '@chakra-ui/react'
import React from 'react'

/**
 * Option interface for select items
 */
export interface SelectOption<T = string> {
  /** Option value */
  value: T
  /** Display label */
  label: string
  /** Whether option is disabled */
  disabled?: boolean
  /** Optional icon */
  icon?: React.ReactElement
  /** Additional data */
  data?: Record<string, unknown>
}

/**
 * Enhanced Select component props
 */
export interface EnhancedSelectProps<T = string> {
  /** Available options */
  'options': SelectOption<T>[]
  /** Current selected value */
  'value'?: T | null
  /** Placeholder text */
  'placeholder'?: string
  /** Whether select is disabled */
  'disabled'?: boolean
  /** Whether select is in loading state */
  'isLoading'?: boolean
  /** Whether select has an error */
  'hasError'?: boolean
  /** Size variant */
  'size'?: 'sm' | 'md' | 'lg'
  /** Selection change handler */
  'onSelectionChange'?: (value: T | null, option?: SelectOption<T>) => void
  /** Optional CSS class */
  'className'?: string
  /** Test ID for testing */
  'data-testid'?: string
  /** Accessible label */
  'aria-label'?: string
}

/**
 * Enhanced Select component with type safety and accessibility
 */
export function EnhancedSelect<T = string>({
  options,
  value,
  placeholder = 'Select an option...',
  disabled = false,
  isLoading = false,
  hasError = false,
  size = 'md',
  onSelectionChange,
  className,
  'data-testid': testId,
  'aria-label': ariaLabel,
}: EnhancedSelectProps<T>): JSX.Element {
  // Handle selection change
  const handleChange = React.useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = event.target.value as T
    const option = options.find(opt => String(opt.value) === selectedValue)
    
    if (onSelectionChange) {
      onSelectionChange(selectedValue || null, option)
    }
  }, [options, onSelectionChange])

  // Generate accessible label
  const accessibleLabel = ariaLabel || placeholder

  return (
    <HStack gap={2} className={className}>
      <NativeSelectRoot
        size={size}
        disabled={disabled || isLoading}
        data-testid={testId}
      >
        <NativeSelectField
          value={value ? String(value) : ''}
          onChange={handleChange}
          aria-label={accessibleLabel}
          borderColor={hasError ? 'red.500' : 'borderPrimary'}
          _hover={{
            borderColor: hasError ? 'red.600' : 'flipioPrimary',
          }}
          _focus={{
            borderColor: 'flipioPrimary',
            boxShadow: '0 0 0 1px var(--chakra-colors-flipioPrimary)',
          }}
          _disabled={{
            opacity: 0.6,
            cursor: 'not-allowed',
          }}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map(option => (
            <option
              key={String(option.value)}
              value={String(option.value)}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </NativeSelectField>
      </NativeSelectRoot>

      {/* Loading indicator */}
      {isLoading && (
        <Spinner
          size="sm"
          color="flipioPrimary"
          aria-label="Loading options"
        />
      )}
    </HStack>
  )
}

/**
 * Simple wrapper for backward compatibility
 */
export interface SimpleSelectProps {
  /** Available options as simple strings */
  options: string[]
  /** Current selected value */
  value?: string
  /** Placeholder text */
  placeholder?: string
  /** Whether select is disabled */
  disabled?: boolean
  /** Whether select is in loading state */
  isLoading?: boolean
  /** Selection change handler */
  onChange?: (value: string) => void
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
}

export const SimpleSelect: React.FC<SimpleSelectProps> = React.memo(({
  options,
  value,
  placeholder,
  disabled,
  isLoading,
  onChange,
  size,
}) => {
  const selectOptions = options.map(option => ({
    value: option,
    label: option,
  }))

  return (
    <EnhancedSelect
      options={selectOptions}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      isLoading={isLoading}
      size={size}
      onSelectionChange={(selectedValue) => {
        if (onChange && selectedValue) {
          onChange(selectedValue)
        }
      }}
    />
  )
})

SimpleSelect.displayName = 'SimpleSelect'
