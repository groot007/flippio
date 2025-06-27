import { Box, Button, Link, Menu, Portal, Text } from '@chakra-ui/react'
import { ColorModeButton } from '@renderer/ui/color-mode'
import { LuExternalLink, LuGithub, LuSettings } from 'react-icons/lu'
import packageJSON from '../../../../../package.json'

export function Settings() {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button
          variant="ghost"
          size="sm"
          color="textSecondary"
          _hover={{ 
            bg: 'bgTertiary',
            color: 'flipioPrimary',
          }}
          title="Settings"
        >
          <LuSettings size={16} />
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content
            bg="bgPrimary"
            border="1px solid"
            borderColor="borderPrimary"
            borderRadius="md"
            boxShadow="lg"
            py={2}
            minW="200px"
          >
            <Menu.Item 
              value="theme-toggle" 
              px={3}
              py={2}
              _hover={{
                bg: 'bgTertiary',
              }}
              _focus={{
                bg: 'bgTertiary',
              }}
            >
              <ColorModeButton />
            </Menu.Item>
            <Menu.Item 
              value="github-link" 
              px={3}
              py={2}
              _hover={{
                bg: 'bgTertiary',
              }}
              _focus={{
                bg: 'bgTertiary',
              }}
            >
              <Link
                target="_blank"
                href="https://github.com/groot007/flippio"
                variant="plain"
                outline="none"
                color="textPrimary"
                _hover={{ color: 'flipioPrimary' }}
                display="flex"
                alignItems="center"
                gap={2}
                fontSize="sm"
                fontWeight="medium"
              >
                <LuGithub size={16} />
                <Text>GitHub</Text>
                <LuExternalLink size={12} />
              </Link>
            </Menu.Item>
            <Box px={3} py={2} borderTop="1px solid" borderColor="borderSecondary" mt={1}>
              <Text fontSize="xs" color="textTertiary">
                v{packageJSON.version}
              </Text>
            </Box>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}
