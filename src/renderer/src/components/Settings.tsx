import { Button, Link, Menu, Portal, Text, VStack } from '@chakra-ui/react'
import { ColorModeButton } from '@renderer/ui/color-mode'
import { LuExternalLink, LuGithub, LuSettings } from 'react-icons/lu'
import packageJSON from '../../../../package.json'

export function Settings() {
  return (
    <Menu.Root>
      {/* @ts-expect-error chakra types */}
      <Menu.Trigger asChild>

        <Button variant="outline" size="sm">
          <LuSettings />
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            {/* @ts-expect-error chakra types */}
            <Menu.Item value="new-txt" justifyContent="center" justifyItems="center">
              <ColorModeButton />
            </Menu.Item>
            {/* @ts-expect-error chakra types */}
            <Menu.Item value="version" justifyContent="center" justifyItems="center">
              <Link target="_blank" href="https://github.com/groot007/flippio" variant="plain" outline="none">
                <LuGithub />
                {' '}
                <LuExternalLink />
              </Link>
            </Menu.Item>
            <VStack>
              <Text fontSize="sm" color="gray.500">
                v:
                {' '}
                {packageJSON.version}
              </Text>
            </VStack>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}
