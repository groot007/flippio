import { Box, Center, Text } from '@chakra-ui/react'
import { memo } from 'react'

export interface ErrorDisplayProps {
  /**
   * Error title
   */
  title?: string
  /**
   * Error message or details
   */
  message: string
  /**
   * Error status variant
   */
  status?: 'error' | 'warning'
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
 * Reusable error display component with consistent styling
 */
export const ErrorDisplay = memo<ErrorDisplayProps>(({
  title = 'Error',
  message,
  status = 'error',
  height = '400px',
  className,
}) => (
  <Center h={height} className={className}>
    <Box
      bg={status === 'error' ? 'red.50' : 'yellow.50'}
      border="1px solid"
      borderColor={status === 'error' ? 'red.200' : 'yellow.200'}
      borderRadius="md"
      p={4}
      maxW="md"
    >
      <Text fontSize="md" fontWeight="semibold" color={status === 'error' ? 'red.700' : 'yellow.700'}>
        {title}
      </Text>
      <Text fontSize="sm" color={status === 'error' ? 'red.600' : 'yellow.600'} mt={1}>
        {message}
      </Text>
    </Box>
  </Center>
))

ErrorDisplay.displayName = 'ErrorDisplay'
