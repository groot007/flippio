import { Box, Textarea } from '@chakra-ui/react'

export function JsonEditor({ value, onChange, isDisabled, isDark }) {
  return (
    <Box borderWidth="1px" borderRadius="md" bg={isDark ? 'gray.700' : 'gray.50'}>
      <Textarea
        value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
        onChange={e => onChange(e.target.value)}
        minHeight="150px"
        fontFamily="monospace"
        fontSize="sm"
        color={isDark ? 'white' : 'gray.900'}
        disabled={isDisabled}
      />
    </Box>
  )
}
