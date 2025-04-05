import { VStack } from '@chakra-ui/react'
import AppHeader from '@renderer/components/AppHeader'
import { DataGrid } from '@renderer/components/DataGrid'
import { DragAndDropProvider } from '@renderer/components/DragAndDropProvider'
import { SidePanel } from '@renderer/components/SidePanel'
import { SubHeader } from '@renderer/components/SubHeader'

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
