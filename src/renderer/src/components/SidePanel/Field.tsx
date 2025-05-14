import { Box, Input, Text } from '@chakra-ui/react'
import { isJsonValue } from '@renderer/utils'
import { useMemo } from 'react'
import { JsonEditor } from './JsonEditor'

export function FieldItem({ fieldKey, value, isEditing, onChange, isLoading, isDark }) {
  const isJson = useMemo(() => isJsonValue(value), [value])

  return (
    <Box mb={4}>
      <Text
        fontWeight="bold"
        fontSize="sm"
        mb={1}
        color={isDark ? 'gray.200' : 'gray.700'}
      >
        {fieldKey}
      </Text>

      {isEditing
        ? (
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
