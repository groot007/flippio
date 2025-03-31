import { HStack, Stack, Text } from '@chakra-ui/react'
import { useColorMode } from '@renderer/ui/color-mode'
import { chakraComponents, Select } from 'chakra-react-select'

interface CustomSelectProps {
  label: string
  options: {
    label: string
    value: string
    description?: string
  }[]
  value: any
  onChange: (value: any) => void
  helperText?: string
  icon?: React.ReactNode
  errorMessage?: string
  isDisabled?: boolean
  width?: string | number
  placeholder?: string
  searchable?: boolean
}

const FLSelect: React.FC<CustomSelectProps> = ({
  options = [],
  value = null,
  onChange,
  label,
  isDisabled = false,
  width = '200px',
  icon = null,
  placeholder,
  searchable = true,
}) => {
  const customComponents = {
    Control: ({ children, ...props }) => {
      return (
        // @ts-expect-error chakra-react-select types
        <chakraComponents.Control {...props}>
          <HStack mr={1}>{icon}</HStack>
          {children}
        </chakraComponents.Control>
      )
    },
  }

  return (
    <Select
      options={options}
      value={value}
      onChange={(selected) => {
        onChange(selected)
      }}

      placeholder={placeholder || label}
      isSearchable={searchable}
      isDisabled={isDisabled}
      components={customComponents}
      size="md"
      chakraStyles={{
        menu: provided => ({
          ...provided,
          zIndex: 100,
          
        }),

        option: provided => ({
          ...provided,
          _selected: {
            background: 'flipioPrimary',
          },
          _hover: { cursor: 'pointer' },
        }),
        container: provided => ({
          ...provided,
          width,
          _hover: { cursor: 'pointer' },
        }),
        dropdownIndicator: provided => ({
          ...provided,
          color: 'flipioPrimary',
        }),
        valueContainer: provided => ({
          ...provided,
          color: 'flipioPrimary',
        }),

        control: provided => ({
          ...provided,

          borderColor: 'flipioPrimary',
          borderWidth: '1px',
          _hover: { borderColor: 'flipioPrimary' },
          _focus: { borderColor: 'flipioPrimary', outline: 'none', borderWidth: '2px' },
        }),
      }}
    />
  )
}

export default FLSelect
