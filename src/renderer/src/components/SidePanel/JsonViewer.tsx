import { Box } from '@chakra-ui/react'
import JsonView from '@uiw/react-json-view'
import { darkTheme } from '@uiw/react-json-view/dark'
import { lightTheme } from '@uiw/react-json-view/light'

export function JsonViewer({ value, isDark }) {
  return (
    <Box borderWidth="1px" borderRadius="md" p={2} bg={isDark ? 'gray.900' : 'gray.50'}>
      <JsonView
        value={value}
        collapsed={1}
        displayDataTypes={false}
        style={isDark ? darkTheme : lightTheme}
      />
    </Box>
  )
}
