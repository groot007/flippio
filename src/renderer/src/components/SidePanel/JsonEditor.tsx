import { Box } from '@chakra-ui/react'
import { githubDarkTheme, JsonEditor as JsonEditorPackage } from 'json-edit-react'
import { useState } from 'react'

export function JsonEditor({ value, onChange, isDark, isEditing }) {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    }
    catch (e) {
      console.error('Invalid JSON string', e)
    }
  }
  const [editorData, setEditorData] = useState(value)
  const handleChange = (newValue) => {
    setEditorData(newValue)
    onChange(JSON.stringify(newValue))
  }

  return (
    <Box borderWidth="1px" borderRadius="md" bg={isDark ? 'gray.700' : 'gray.50'}>
      <JsonEditorPackage
        data={editorData}
        setData={handleChange}
        rootFontSize={12}
        viewOnly={!isEditing}
        theme={[githubDarkTheme, {
          input: ['#fff', { fontSize: '90%' }],
          inputHighlight: ['#555', { fontSize: '90%' }],
        }]}
      />
    </Box>
  )
}
