import { useColorMode } from '@renderer/ui/color-mode'
import { Select } from 'chakra-react-select'

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
  placeholder,
  searchable = true,
}) => {
  const { colorMode } = useColorMode()
  const isDark = colorMode === 'dark'

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
      size="md"
      chakraStyles={{
        menu: provided => ({
          ...provided,
          zIndex: 100,
        }),
        container: provided => ({
          ...provided,
          width,

        }),
        control: provided => ({
          ...provided,

          borderColor: isDark ? 'gray.600' : 'gray.300',
          _hover: { borderColor: 'flipioPrimary' },
        }),
      }}
    />
  )
}

export default FLSelect
