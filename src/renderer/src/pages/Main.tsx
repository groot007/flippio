import { HStack, VStack } from '@chakra-ui/react'
import AppHeader from '@renderer/components/AppHeader'
import Welcome from '@renderer/components/Welcome'

export function Main() {
  return (
    <VStack>
      <AppHeader />
      <Welcome />
    </VStack>
  )
}

export default Main
