import { Box, HStack, IconButton, Input, Text, Textarea } from '@chakra-ui/react'
import { isJsonValue } from '@renderer/utils'
import { useEffect, useMemo, useState } from 'react'
import { LuCode, LuType } from 'react-icons/lu'
import { JsonEditor } from './JsonEditor'

interface FieldItemProps {
  fieldKey: string
  fieldType: string
  value: any
  isEditing: boolean
  onChange: (key: string, value: any) => void
  isLoading: boolean
  isDark: boolean
}

export function FieldItem({ fieldKey, fieldType, value, isEditing, onChange, isLoading, isDark }: FieldItemProps) {
  const isJson = useMemo(() => isJsonValue(value), [value])
  const [userPreferredTextMode, setUserPreferredTextMode] = useState(false)
  const [showJsonError, setShowJsonError] = useState(false)

  // Determine the actual editor mode
  const shouldUseJsonEditor = useMemo(() => {
    if (!isJson) 
      return false
    return !userPreferredTextMode
  }, [isJson, userPreferredTextMode])

  // Reset user preference when entering edit mode (fresh start)
  useEffect(() => {
    if (isEditing) {
      setUserPreferredTextMode(false)
      setShowJsonError(false)
    }
  }, [isEditing])

  // Clear error when JSON becomes valid
  useEffect(() => {
    if (isJson) {
      setShowJsonError(false)
    }
  }, [isJson])

  const handleToggleEditorMode = () => {
    if (userPreferredTextMode) {
      // User wants to switch from text to JSON
      if (isJson) {
        setUserPreferredTextMode(false)
        setShowJsonError(false)
      }
      else {
        // Show error if trying to switch to JSON with invalid content
        setShowJsonError(true)
        // Auto-hide error after 3 seconds
        setTimeout(() => setShowJsonError(false), 3000)
      }
    }
    else {
      // User wants to switch from JSON to text
      setUserPreferredTextMode(true)
      setShowJsonError(false)
    }
  }

  const getTypeColor = (type: string): string => {
    const lowerType = type.toLowerCase()
    if (lowerType.includes('int') || lowerType.includes('real') || lowerType.includes('numeric')) {
      return isDark ? 'blue.300' : 'blue.600'
    }
    if (lowerType.includes('text') || lowerType.includes('varchar') || lowerType.includes('char')) {
      return isDark ? 'green.300' : 'green.600'
    }
    if (lowerType.includes('blob')) {
      return isDark ? 'purple.300' : 'purple.600'
    }
    if (lowerType.includes('date') || lowerType.includes('time')) {
      return isDark ? 'orange.300' : 'orange.600'
    }
    return isDark ? 'gray.400' : 'gray.500'
  }

  const getDisplayType = (): string => {
    if (isJson) {
      return `${fieldType.toUpperCase()} json`
    }
    return fieldType.toUpperCase()
  }

  const getTypeColorForDisplay = (): string => {
    if (isJson) {
      return isDark ? 'yellow.300' : 'yellow.600'
    }
    return getTypeColor(fieldType)
  }

  return (
    <Box mb={3} borderBottom="1px solid" borderBottomColor="gray.800" pb={2}>
      <HStack align="center" mb={2} justify="space-between">
        <HStack align="center">
          <Text
            fontWeight="bold"
            fontSize="md"
            mr={1} 
            color={isDark ? 'gray.200' : 'gray.700'}
          >
            {fieldKey}
          </Text>
          <Text
            fontSize="xs"
            fontWeight="medium"
            color={getTypeColorForDisplay()}
            bg={isDark ? 'gray.700' : 'gray.100'}
            px={1}
            py={0}
            borderRadius="md"
            fontFamily="mono"
          >
            {getDisplayType()}
          </Text>
        </HStack>
        {isEditing && isJson && (
          <IconButton
            aria-label={userPreferredTextMode ? 'Switch to JSON editor' : 'Switch to text editor'}
            size="xs"
            variant="ghost"
            colorScheme={showJsonError ? 'red' : 'blue'}
            onClick={handleToggleEditorMode}
            title={userPreferredTextMode ? 'Switch to JSON editor' : 'Switch to text editor'}
          >
            {userPreferredTextMode ? <LuCode /> : <LuType />}
          </IconButton>
        )}
      </HStack>

      {showJsonError && (
        <Text
          fontSize="xs"
          color="red.500"
          mb={2}
          fontStyle="italic"
        >
          Invalid JSON format. Please fix the syntax before switching to JSON editor.
        </Text>
      )}

      {isEditing
        ? (
            isJson
              ? (
                  shouldUseJsonEditor
                    ? (
                        <JsonEditor
                          value={value}
                          onChange={newValue => onChange(fieldKey, newValue)}
                          isEditing={isEditing}
                          isDark={isDark}
                        />
                      )
                    : (
                        <Textarea
                          value={value || ''}
                          onChange={e => onChange(fieldKey, e.target.value)}
                          placeholder={`Enter ${fieldKey}...`}
                          bg={isDark ? 'gray.800' : 'white'}
                          borderColor={isDark ? 'gray.600' : 'gray.300'}
                          color={isDark ? 'gray.200' : 'gray.700'}
                          rows={4}
                          resize="vertical"
                          fontFamily="mono"
                          fontSize="sm"
                        />
                      )
                )
              : (

                  <Input
                    fontSize="sm"
                    value={value !== undefined ? value : ''}
                    onChange={e => onChange(fieldKey, e.target.value)}
                    disabled={isLoading}
                    borderColor={isDark ? 'gray.600' : 'gray.300'}
                    _hover={{ borderColor: 'flipioPrimary' }}
                    _focus={{
                      borderColor: 'flipioPrimary',
                      boxShadow: `0 0 0 1px var(--chakra-colors-flipioPrimary)`,
                    }}
                  />
                )
          )
        : (
            isJson
              ? (
                  <JsonEditor
                    value={value}
                    onChange={newValue => onChange(fieldKey, newValue)}
                    isEditing={isEditing}
                    isDark={isDark}
                  />
                )
              : (
                  <Text
                    fontSize="sm"
                    mb={2}
                    color={isDark ? 'gray.300' : 'gray.600'}
                  >
                    {String(value)}
                  </Text>
                )
          )}
    </Box>
  )
}
