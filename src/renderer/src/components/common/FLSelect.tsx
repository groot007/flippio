import { HStack, Text, VStack } from '@chakra-ui/react'
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
  variant?: 'small' | 'regular'
  menuListWidth?: string | number
}

const FLSelect: React.FC<CustomSelectProps> = ({
  options = [],
  value = null,
  onChange,
  label,
  isDisabled = false,
  width = '220px',
  menuListWidth = 'auto',
  icon = null,
  placeholder,
  searchable = true,
  noOptionsMessage = 'No options available',
  variant = 'regular',
}) => {
  const controlStyles = {
    small: {
      control: {
        minH: '32px',
        py: 0,
        px: 0,
        pr: 1,
        borderColor: 'none',
      },
  
    },
    regular: {
      control: {
        minH: '40px',
        py: 2,
        px: 3,
        borderWidth: '1px',
        borderColor: 'borderPrimary',
      },
    },
  }

  const styles = controlStyles[variant]

  const customComponents = {
    Control: ({ children, ...props }: any) => {
      return (
        <chakraComponents.Control {...props}>
          <HStack ml={3} mr={1} color="textSecondary">{icon}</HStack>
          {children}
        </chakraComponents.Control>
      )
    },
    Option: ({ children, ...props }: any) => {
      return (
        <chakraComponents.Option {...props}>
          <VStack
            alignItems="start" 
            justifyContent="flex-start" 
            gap={0}
          >
            <Text fontSize="sm" fontWeight="medium" color="textPrimary">
              {props.data.label}
            </Text>
            {props.data.description && (
              <Text fontSize="10px" color="textSecondary">
                {props.data.description}
              </Text>
            )}
          </VStack>
         
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
          border: 'none',
          borderRadius: 'md',
          boxShadow: 'lg',
          width,
          py: 1,
        }),
        menuList: provided => ({
          ...provided,
          border: 'none',
          borderRadius: 'md',
          boxShadow: 'none',
          width: menuListWidth,
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
          
          borderRadius: 'sm',
     
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
          ...styles.control,
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
