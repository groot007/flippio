import { VStack } from '@chakra-ui/react'
import AppHeader from '@renderer/components/AppHeader'
import { DataGrid } from '@renderer/components/DataGrid'
import { SidePanel } from '@renderer/components/SidePanel'
import { SubHeader } from '@renderer/components/SubHeader'

export function Main() {
  return (
    <VStack
      height="100vh"
      bg="bgPrimary"
    >
      <AppHeader />
      <SubHeader />
      <DataGrid />
      <SidePanel />
    </VStack>
  )
}

export default Main
