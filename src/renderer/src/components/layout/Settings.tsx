import { Box, Button, HStack, Link, Menu, Portal, Text } from '@chakra-ui/react'
import { useAutoUpdater } from '@renderer/hooks/useAutoUpdater'
import { ColorModeButton } from '@renderer/ui/color-mode'
import { toaster } from '@renderer/ui/toaster'
import { LuDownload, LuExternalLink, LuGithub, LuSettings } from 'react-icons/lu'
import packageJSON from '../../../../../package.json'
import { useEffect } from 'react'

export function Settings() {
  const { updateInfo, isChecking, checkForUpdates, downloadAndInstall } = useAutoUpdater()

  const handleCheckForUpdates = async () => {
    try {
      const result = await checkForUpdates()
      
      // The updateInfo will be automatically updated via the hook
      // Show appropriate message based on the result
      if (result.error) {
        toaster.create({
          title: 'Update Check Failed',
          description: result.error,
          type: 'error',
          duration: 5000,
        })
      } else if (updateInfo?.available) {
        toaster.create({
          title: 'Update Available',
          description: `Version ${updateInfo.version} is available!`,
          type: 'success',
          duration: 5000,
          action: {
            label: 'Install Now',
            onClick: downloadAndInstall,
          },
        })
      } else {
        toaster.create({
          title: 'No Updates',
          description: 'You are running the latest version.',
          type: 'info',
          duration: 3000,
        })
      }
    }
    catch {
      toaster.create({
        title: 'Update Check Failed',
        description: 'Unable to check for updates. Please try again later.',
        type: 'error',
        duration: 5000,
      })
    }
  }

  useEffect(() => {
    setTimeout(() => {
      checkForUpdates().then(rez => {
        if (rez.data?.available) {
          toaster.create({
          title: 'Update Available',
          description: `Version ${rez.data.version} is available!`,
          type: 'success',
          duration: 5000,
          action: {
            label: 'Install Now',
            onClick: downloadAndInstall,
          },
        })
        }
      })
    }, 5000)
  }, [])

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
              value="check-updates"
              px={3}
              py={2}
              _hover={{
                bg: 'bgTertiary',
              }}
              _focus={{
                bg: 'bgTertiary',
              }}
              onClick={handleCheckForUpdates}
              disabled={isChecking}
            >
              <Button
                variant="ghost"
                size="sm"
                color="textPrimary"
                _hover={{ color: 'flipioPrimary' }}
                display="flex"
                alignItems="center"
                gap={2}
                fontSize="sm"
                fontWeight="medium"
                loading={isChecking}
                p={0}
                h="auto"
                minH="auto"
              >
                <LuDownload size={16} />
                <Text>Check for Updates</Text>
              </Button>
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
            <HStack px={3} py={2} justifyContent="space-between" borderTop="1px solid" borderColor="borderSecondary" mt={1}>
              <Text fontSize="xs" color="textTertiary">
                v
                {packageJSON.version}
              </Text>
              <ColorModeButton />
            </HStack>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}
