import { Box, Input, Text } from '@chakra-ui/react'
import { isJsonValue, parseJson } from '@renderer/utils'
import { useMemo } from 'react'
import { JsonEditor } from './JsonEditor'
import { JsonViewer } from './JsonViewer'

export function FieldItem({ fieldKey, value, isEditing, onChange, isLoading, isDark }) {
  const isJson = useMemo(() => isJsonValue(value), [value])

  return (
    <Box mb={4}>
      <Text fontWeight="bold" fontSize="sm" mb={1}>{fieldKey}</Text>

      {isEditing
        ? (
            isJson
              ? (
                  <JsonEditor
                    value={value}
                    onChange={newValue => onChange(fieldKey, newValue)}
                    isDisabled={isLoading}
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
                  />
                )
          )
        : (
            isJson
              ? (
                  <JsonViewer value={parseJson(value)} isDark={isDark} />
                )
              : (
                  <Text fontSize="sm" mb={2}>{String(value)}</Text>
                )
          )}
    </Box>
  )
}
