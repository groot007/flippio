import type { VirtualDevice } from '../../types/virtualDevice'
import type { VirtualDeviceModalPresenterProps } from './types'

import {
  Box,
  Dialog,
  Flex,
  Heading,
  HStack,
  Icon,
  Portal,
  Text,
  VStack,
} from '@chakra-ui/react'
import { ActionButton, ErrorDisplay, LoadingSpinner } from '@renderer/shared/components/ui'
import { memo, useCallback } from 'react'
import { FaAndroid } from 'react-icons/fa'
import { LuApple, LuRefreshCcw, LuSmartphone } from 'react-icons/lu'

/**
 * Individual virtual device list item component
 */
const VirtualDeviceListItem = memo<{
  device: VirtualDevice
  isLaunching: boolean
  onLaunch: () => void
}>(({ device, isLaunching, onLaunch }) => {
      // Helper function to check if device is running/booted
      const isDeviceRunning = useCallback((device: VirtualDevice): boolean => {
        if (!device.state) 
          return false
        // iOS simulators use "Booted", Android emulators might use "running" or other states
        return device.state.toLowerCase() === 'booted' || device.state.toLowerCase() === 'running'
      }, [])

      const isRunning = isDeviceRunning(device)

      return (
        <Box
          p={3}
          border="1px solid"
          borderColor="gray.200"
          borderRadius="md"
          _hover={{ borderColor: 'blue.300', bg: 'blue.50' }}
          transition="all 0.2s"
          w="100%"
        >
          <Flex align="center" justify="space-between">
            <Flex align="center" gap={3}>
              <Icon 
                as={device.platform === 'android' ? FaAndroid : LuApple} 
                color={device.platform === 'android' ? 'green.500' : 'gray.600'}
                size="lg"
              />
              <Box>
                <Text fontWeight="medium" fontSize="sm">
                  {device.name}
                </Text>
                <Text fontSize="xs" color="gray.500">
                  {device.platform === 'android' ? 'Android Emulator' : 'iOS Simulator'}
                  {' '}
                  •
                  {device.state || 'Unknown'}
                </Text>
              </Box>
            </Flex>
            <ActionButton
              size="sm"
              variant={isRunning ? 'outline' : 'solid'}
              colorScheme={isRunning ? 'gray' : 'blue'}
              onClick={onLaunch}
              isLoading={isLaunching}
              loadingText="Launching..."
              disabled={isRunning}
            >
              {isRunning ? 'Running' : 'Launch'}
            </ActionButton>
          </Flex>
        </Box>
      )
    })

VirtualDeviceListItem.displayName = 'VirtualDeviceListItem'

/**
 * Presenter component for VirtualDeviceModal
 * Handles pure UI rendering and user interactions
 */
export function VirtualDeviceModalPresenter({
  isOpen,
  onClose,
  androidDevices,
  iosSimulators,
  isLoading,
  isLaunching,
  onLaunchDevice,
  onRefreshDevices,
}: VirtualDeviceModalPresenterProps) {
  const handleLaunchDevice = useCallback((deviceId: string, platform: 'android' | 'ios') => {
    onLaunchDevice(deviceId, platform)
  }, [onLaunchDevice])

  if (isLoading) {
    return (
      <Portal>
        <Dialog.Root open={isOpen} onOpenChange={({ open }) => !open && onClose()}>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxW="md" mx={4}>
              <Dialog.Header>
                <Dialog.Title>Virtual Devices</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <LoadingSpinner 
                  text="Loading virtual devices..." 
                  height="200px"
                />
              </Dialog.Body>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>
      </Portal>
    )
  }

  const hasDevices = androidDevices.length > 0 || iosSimulators.length > 0

  if (!hasDevices) {
    return (
      <Portal>
        <Dialog.Root open={isOpen} onOpenChange={({ open }) => !open && onClose()}>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxW="md" mx={4}>
              <Dialog.Header>
                <Dialog.Title>Virtual Devices</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <ErrorDisplay
                  title="No Virtual Devices Found"
                  message="No Android emulators or iOS simulators were found. Please install Android Studio or Xcode to create virtual devices."
                  status="warning"
                  height="200px"
                />
              </Dialog.Body>
              <Dialog.Footer>
                <HStack gap={3} justify="space-between" w="100%">
                  <ActionButton
                    variant="outline"
                    leftIcon={<LuRefreshCcw />}
                    onClick={onRefreshDevices}
                    size="sm"
                  >
                    Refresh
                  </ActionButton>
                  <ActionButton variant="outline" onClick={onClose}>
                    Close
                  </ActionButton>
                </HStack>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>
      </Portal>
    )
  }

  return (
    <Portal>
      <Dialog.Root open={isOpen} onOpenChange={({ open }) => !open && onClose()}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="2xl" mx={4}>
            <Dialog.Header>
              <Flex align="center" gap={2}>
                <Icon as={LuSmartphone} />
                <Dialog.Title>Virtual Devices</Dialog.Title>
              </Flex>
            </Dialog.Header>
            <Dialog.Body>
              <Box maxH="60vh" overflowY="auto">
                {androidDevices.length > 0 && (
                  <Box mb={6}>
                    <Heading size="sm" mb={3} color="green.600">
                      <Flex align="center" gap={2}>
                        <Icon as={FaAndroid} />
                        Android Emulators (
                        {androidDevices.length}
                        )
                      </Flex>
                    </Heading>
                    <VStack gap={2}>
                      {androidDevices.map(device => (
                        <VirtualDeviceListItem
                          key={device.id}
                          device={device}
                          isLaunching={isLaunching === device.id}
                          onLaunch={() => handleLaunchDevice(device.id, 'android')}
                        />
                      ))}
                    </VStack>
                  </Box>
                )}

                {iosSimulators.length > 0 && (
                  <Box>
                    <Heading size="sm" mb={3} color="gray.600">
                      <Flex align="center" gap={2}>
                        <Icon as={LuApple} />
                        iOS Simulators (
                        {iosSimulators.length}
                        )
                      </Flex>
                    </Heading>
                    <VStack gap={2}>
                      {iosSimulators.map(device => (
                        <VirtualDeviceListItem
                          key={device.id}
                          device={device}
                          isLaunching={isLaunching === device.id}
                          onLaunch={() => handleLaunchDevice(device.id, 'ios')}
                        />
                      ))}
                    </VStack>
                  </Box>
                )}
              </Box>
            </Dialog.Body>
            <Dialog.Footer>
              <HStack gap={3} justify="space-between" w="100%">
                <ActionButton
                  variant="outline"
                  leftIcon={<LuRefreshCcw />}
                  onClick={onRefreshDevices}
                  size="sm"
                >
                  Refresh
                </ActionButton>
                <ActionButton variant="outline" onClick={onClose}>
                  Close
                </ActionButton>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Portal>
  )
}
