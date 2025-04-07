import { Button, Link, Menu, Portal, Text, VStack } from '@chakra-ui/react'
import { ColorModeButton } from '@renderer/ui/color-mode'
import { LuExternalLink, LuGithub, LuSettings } from 'react-icons/lu'
import packageJSON from '../../../../../package.json'

export function Settings() {
  return (
    <Menu.Root>
      {/* @ts-expect-error chakra types */}
      <Menu.Trigger asChild>
        <Button
          variant="outline"
          size="sm"
          borderColor="gray.300"
          _dark={{ borderColor: 'gray.600' }}
          _hover={{ borderColor: 'flipioPrimary' }}
        >
          <LuSettings color="flipioPrimary" />
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
              <Link
                target="_blank"
                href="https://github.com/groot007/flippio"
                variant="plain"
                outline="none"
                color="gray.600"
                _dark={{ color: 'gray.300' }}
                _hover={{ color: 'flipioPrimary' }}
              >
                <LuGithub />
                {' '}
                <LuExternalLink />
              </Link>
            </Menu.Item>
            <VStack>
              <Text fontSize="sm" color="gray.500" _dark={{ color: 'gray.400' }}>
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
