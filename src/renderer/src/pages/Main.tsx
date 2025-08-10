import { Box, Flex } from '@chakra-ui/react'
import { DataGridContainer } from '@renderer/features/database/components'
import { DragAndDropProvider } from '@renderer/features/database/components/drag-and-drop-provider'
import { AppHeaderContainer } from '@renderer/features/layout/components/app-header'
import { SidePanelContainer } from '@renderer/features/layout/components/side-panel'
import { SubHeaderContainer } from '@renderer/features/layout/components/sub-header'

export function Main() {
  return (
    <DragAndDropProvider>
      <Flex
        direction="column"
        height="100vh"
        bg="bgPrimary"
        overflow="hidden"
        fontFamily="body"
      >
        <AppHeaderContainer />
        <SubHeaderContainer />
        <Box flex="1" overflow="hidden" position="relative">
          <DataGridContainer />
        </Box>
        <SidePanelContainer />
      </Flex>
    </DragAndDropProvider>
  )
}

export default Main
