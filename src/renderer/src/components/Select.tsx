import {
  createListCollection,
  Portal,
  Select,
  Span,
  Stack,
} from '@chakra-ui/react'
import React from 'react'

interface CustomSelectProps {
  label: string
  options: {
    label: string
    value: string
    description?: string
  }[]
  value: string
  onChange: (value: string) => void // Handle change
  helperText?: string
  errorMessage?: string
  isDisabled?: boolean
}

const FLSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  label,
}) => {
  const optionsCollection = createListCollection({
    items: options,
  })

  return (
    <Select.Root
      collection={optionsCollection}
      width="200px"
      value={value}
      onValueChange={(e) => {
        onChange(e.value)
      }}
    >
      <Select.HiddenSelect />
      {/* <Select.Label>{label}</Select.Label> */}
      <Select.Control>
        <Select.Trigger>
          <Select.ValueText placeholder={label}  />
        </Select.Trigger>
        <Select.IndicatorGroup>
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      <Portal>
        <Select.Positioner>
          <Select.Content>
            {options.map(option => (
              <Select.Item item={option} key={option.value} > 
                <Stack gap="0">
                  <Select.ItemText maxW="170px">{option.label}</Select.ItemText>
                  {option.description && <Span color="fg.muted" textStyle="xs" maxW="170px">
                    {option.description}
                  </Span>}
                </Stack>
                <Select.ItemIndicator />
            </Select.Item>
            ))}
          </Select.Content>
        </Select.Positioner>
      </Portal>
    </Select.Root>
  )
}

export default FLSelect
