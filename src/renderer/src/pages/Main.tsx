import { HStack, VStack } from '@chakra-ui/react'
import Welcome from '@renderer/components/Welcome'

export function Main() {
  return (
    <VStack>
      <HStack>App header</HStack>
      <Welcome />
    </VStack>
  )
}

export default Main
