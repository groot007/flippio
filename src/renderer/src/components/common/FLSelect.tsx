import { HStack, Text } from '@chakra-ui/react'
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
  noOptionsMessage?: string
}

const FLSelect: React.FC<CustomSelectProps> = ({
  options = [],
  value = null,
  onChange,
  label,
  isDisabled = false,
  width = '220px',
  icon = null,
  placeholder,
  searchable = true,
  noOptionsMessage = 'No options available',
}) => {
  const customComponents = {
    Control: ({ children, ...props }: any) => {
      return (
        <chakraComponents.Control {...props}>
          <HStack ml={3} mr={1}>{icon}</HStack>
          {children}
        </chakraComponents.Control>
      )
    },
    Option: ({ children, ...props }: any) => {
      return (
        <chakraComponents.Option {...props}>
          <Text fontSize="sm" fontWeight="medium" color="textPrimary">
            {props.data.label}
          </Text>
          {props.data.description && (
            <Text fontSize="xs" color="textSecondary" mt={0.5}>
              {props.data.description}
            </Text>
          )}
        </chakraComponents.Option>
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
      noOptionsMessage={() => noOptionsMessage}
      placeholder={placeholder || label}
      isSearchable={searchable}
      isDisabled={isDisabled}
      components={customComponents}
      size="md"
      chakraStyles={{
        menu: provided => ({
          ...provided,
          zIndex: 100,
          bg: 'bgPrimary',
          border: '1px solid',
          borderColor: 'borderPrimary',
          borderRadius: 'md',
          boxShadow: 'lg',
          py: 1,
        }),
        option: provided => ({
          ...provided,
          bg: 'transparent',
          py: 2,
          px: 3,
          _selected: {
            bg: 'flipioPrimary',
            color: 'white',
          },
          _hover: { 
            bg: 'bgTertiary',
            cursor: 'pointer',
          },
          _focus: {
            bg: 'bgTertiary',
          },
        }),
        container: provided => ({
          ...provided,
          width,
        }),
        dropdownIndicator: provided => ({
          ...provided,
          color: 'textSecondary',
          _hover: {
            color: 'flipioPrimary',
          },
        }),
        indicatorSeparator: provided => ({
          ...provided,
          display: 'none',
        }),
        control: provided => ({
          ...provided,
          bg: 'bgPrimary',
          borderColor: 'borderPrimary',
          borderWidth: '1px',
          borderRadius: 'sm',
          minH: '40px',
          fontSize: 'sm',
          fontWeight: 'medium',
          transition: 'all 0.2s',
          _hover: { 
            borderColor: 'flipioPrimary',
            boxShadow: '0 0 0 1px var(--chakra-colors-flipioPrimary)',
          },
          _focus: { 
            borderColor: 'flipioPrimary', 
            outline: 'none', 
            boxShadow: '0 0 0 2px var(--chakra-colors-flipioPrimary)',
          },
          _disabled: {
            bg: 'bgTertiary',
            borderColor: 'borderSecondary',
            opacity: 0.6,
            cursor: 'not-allowed',
          },
        }),
        placeholder: provided => ({
          ...provided,
          color: 'textTertiary',
          fontSize: 'sm',
        }),
        singleValue: provided => ({
          ...provided,
          color: 'textPrimary',
          fontSize: 'sm',
          fontWeight: 'medium',
        }),
        input: provided => ({
          ...provided,
          color: 'textPrimary',
        }),
      }}
    />
  )
}

export default FLSelect
