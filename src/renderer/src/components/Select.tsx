import {
  Box,
  createListCollection,
  Input,
  Portal,
  Select,
  Span,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useColorMode } from '@renderer/ui/color-mode'
import { useCallback, useEffect, useMemo, useState } from 'react'

interface CustomSelectProps {
  label: string
  options: {
    label: string
    value: string
    description?: string
  }[]
  value: string[]
  onChange: (value: string) => void
  helperText?: string
  errorMessage?: string
  isDisabled?: boolean
  width?: string | number
  placeholder?: string
  searchable?: boolean
}

const FLSelect: React.FC<CustomSelectProps> = ({
  options = [],
  value = [],
  onChange,
  label,
  helperText,
  errorMessage,
  isDisabled = false,
  width = '200px',
  placeholder,
  searchable = true,
}) => {
  const { colorMode } = useColorMode()
  const isDark = colorMode === 'dark'
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const filteredOptions = useMemo(() => {
    if (!searchQuery)
      return options

    const query = searchQuery.toLowerCase()
    return options.filter(option =>
      option.label.toLowerCase().includes(query)
      || option.description?.toLowerCase().includes(query),
    )
  }, [options, searchQuery])

  const optionsCollection = useMemo(() =>
    createListCollection({
      items: filteredOptions,
    }), [filteredOptions])

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
    }
  }, [isOpen])

  const selectedLabel = useMemo(() => {
    if (!value || value.length === 0)
      return ''
    const selectedOption = options.find(option => option.value === value[0])
    return selectedOption?.label || ''
  }, [options, value])

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }, [])

  return (
    <Box width={width} opacity={isDisabled ? 0.6 : 1} pointerEvents={isDisabled ? 'none' : 'auto'}>
      {/* {label && (
        <Text
          as="label"
          fontSize="sm"
          fontWeight="medium"
          display="block"
          mb={1}
        >
          {label}
        </Text>
      )} */}

      <Select.Root
        collection={optionsCollection}
        value={value}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
        onValueChange={(e) => {
          onChange(e.value)
        }}
      >
        <Select.HiddenSelect />

        <Select.Control>
          <Select.Trigger borderWidth="1px" borderColor="flipioPrimary">
            <Select.ValueText
              placeholder={placeholder || label}
              color={!selectedLabel ? 'flipioTeal' : undefined}
            >
              {selectedLabel}
            </Select.ValueText>
          </Select.Trigger>
          <Select.IndicatorGroup>
            <Select.Indicator />
          </Select.IndicatorGroup>
        </Select.Control>

        <Portal>
          <Select.Positioner>
            <Select.Content
              boxShadow="md"
              borderRadius="md"
              overflow="hidden"
              w="100%"
              position="relative"
              zIndex="popup"
            >
              {searchable && (
                <Box
                  p={2}
                  borderBottomWidth="1px"
                  borderColor={isDark ? 'gray.700' : 'gray.200'}
                >
                  <Input
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search..."
                    borderRadius="md"
                    border="1px solid grey.300"
                    _focusVisible={{ border: '1px solid grey.300', outline: '1px solid transparent' }}
                    autoFocus
                  />
                </Box>
              )}

              <Box maxH="200px" overflowY="auto">
                {filteredOptions.length === 0
                  ? (
                      <Text p={2} color="gray.500" textAlign="center" fontSize="sm">
                        No results found
                      </Text>
                    )
                  : (
                      filteredOptions.map(option => (
                        <Select.Item
                          item={option}
                          key={option.value}
                          _hover={{ bg: isDark ? 'gray.700' : 'gray.100' }}
                        >
                          <Stack gap="0">
                            <Select.ItemText
                              fontWeight="medium"
                              textOverflow="ellipsis"
                              overflow="hidden"
                              whiteSpace="nowrap"
                              maxW="100%"
                            >
                              {option.label}
                            </Select.ItemText>
                            {option.description && (
                              <Span
                                color={isDark ? 'gray.400' : 'gray.600'}
                                fontSize="xs"
                                textOverflow="ellipsis"
                                overflow="hidden"
                                whiteSpace="nowrap"
                                maxW="100%"
                              >
                                {option.description}
                              </Span>
                            )}
                          </Stack>
                          <Select.ItemIndicator />
                        </Select.Item>
                      ))
                    )}
              </Box>
            </Select.Content>
          </Select.Positioner>
        </Portal>
      </Select.Root>

      {/* Simple text for helper messages instead of FormHelperText */}
      {helperText && !errorMessage && (
        <Text fontSize="xs" mt={1} color="gray.500">
          {helperText}
        </Text>
      )}

      {/* Simple text for error messages instead of FormErrorMessage */}
      {errorMessage && (
        <Text fontSize="xs" mt={1} color="red.500">
          {errorMessage}
        </Text>
      )}
    </Box>
  )
}

export default FLSelect
