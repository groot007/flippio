import { VStack } from '@chakra-ui/react'
import AppHeader from '@renderer/components/AppHeader'
import { DataGrid } from '@renderer/components/DataGrid'
import { SubHeader } from '@renderer/components/SubHeader'

export function Main() {
  return (
    <VStack height="100vh">
      <AppHeader />
      <SubHeader />
      <DataGrid />
    </VStack>
  )
}

export default Main
