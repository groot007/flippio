import { Center, Spinner, Text } from '@chakra-ui/react'
import { memo } from 'react'

export interface LoadingSpinnerProps {
  /**
   * Text to display below the spinner
   */
  text?: string
  /**
   * Size of the spinner
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /**
   * Height of the container
   */
  height?: string | number
  /**
   * Additional CSS class
   */
  className?: string
}

/**
 * Reusable loading spinner component with consistent styling
 */
export const LoadingSpinner = memo<LoadingSpinnerProps>(({
  text = 'Loading...',
  size = 'lg',
  height = '400px',
  className,
}) => (
  <Center h={height} className={className}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <Spinner size={size} />
      <Text>{text}</Text>
    </div>
  </Center>
))

LoadingSpinner.displayName = 'LoadingSpinner'
