import { VStack } from '@chakra-ui/react'
import { DataGrid } from '@renderer/components/data/DataGrid'
import { DragAndDropProvider } from '@renderer/components/data/DragAndDropProvider'
import AppHeader from '@renderer/components/layout/AppHeader'
import { SubHeader } from '@renderer/components/layout/SubHeader'
import { SidePanel } from '@renderer/components/SidePanel'

export function Main() {
  return (
    <DragAndDropProvider>
      <VStack
        height="100vh"
        bg="bgPrimary"
        overflow="hidden"
      >
        <AppHeader />
        <SubHeader />
        <DataGrid />
        <SidePanel />
      </VStack>
    </DragAndDropProvider>
  )
}

export default Main
