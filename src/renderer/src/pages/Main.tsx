import { VStack } from '@chakra-ui/react'
import AppHeader from '@renderer/components/AppHeader'
import { DataGrid } from '@renderer/components/DataGrid'
import { SidePanel } from '@renderer/components/SidePanel'
import { SubHeader } from '@renderer/components/SubHeader'
import { useColorMode } from '@renderer/ui/color-mode'

export function Main() {
  const { colorMode } = useColorMode()
  const isDark = colorMode === 'dark'

  return (
    <VStack
      height="100vh"
      bg="bgPrimary"
      overflow="hidden"
      color={isDark ? 'gray.50' : 'gray.800'}
    >
      <AppHeader />
      <SubHeader />
      <DataGrid />
      <SidePanel />
    </VStack>
  )
}

export default Main
