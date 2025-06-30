import {
  Box,
  Button,
  CloseButton,
  Dialog,
  Flex,
  Heading,
  HStack,
  Icon,
  List,
  ListItem,
  Portal,
  Spinner,
  Text,
} from '@chakra-ui/react'
import { toaster } from '@renderer/ui/toaster'
import React, { useCallback, useEffect, useState } from 'react'
import { FaAndroid } from 'react-icons/fa'
import { LuApple, LuSmartphone } from 'react-icons/lu'

export interface VirtualDevice {
  name: string
  id: string
  platform: 'android' | 'ios'
  state?: string // Backend sends 'state', not 'status'
}

interface VirtualDeviceModalProps {
  isOpen: boolean
  onClose: () => void
}

export const VirtualDeviceModal: React.FC<VirtualDeviceModalProps> = ({ isOpen, onClose }) => {
  const [androidDevices, setAndroidDevices] = useState<VirtualDevice[]>([])
  const [iosSimulators, setIosSimulators] = useState<VirtualDevice[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isLaunching, setIsLaunching] = useState<string | null>(null)

  // Helper function to check if device is running/booted
  const isDeviceRunning = (device: VirtualDevice): boolean => {
    if (!device.state) 
      return false
    // iOS simulators use "Booted", Android emulators might use "running" or other states
    return device.state.toLowerCase() === 'booted' || device.state.toLowerCase() === 'running'
  }

  // Fetch the list of available virtual devices
  useEffect(() => {
    const fetchVirtualDevices = async () => {
      try {
        setIsLoading(true)

        // Fetch Android emulators
        const androidEmulators = await window.api.getAndroidEmulators()
        console.log('Fetched Android emulators:', androidEmulators)
        if (androidEmulators.success) {
          setAndroidDevices(androidEmulators.emulators || [])
        }

        // Fetch iOS simulators
        const iosDevices = await window.api.getIOSSimulators()
        if (iosDevices.success) {
          setIosSimulators(iosDevices.simulators || [])
        }
      }
      catch (error) {
        toaster.create({
          title: 'Error',
          description: 'Failed to fetch virtual devices',
          type: 'error',
          duration: 3000,
        })
        console.error('Error fetching virtual devices:', error)
      }
      finally {
        setIsLoading(false)
      }
    }

    if (isOpen) {
      fetchVirtualDevices()
    }
  }, [isOpen])

  // Launch a virtual device
  const handleLaunchDevice = useCallback(async (device: VirtualDevice) => {
    try {
      setIsLaunching(device.id)

      // Launch based on platform
      if (device.platform === 'android') {
        const result = await window.api.launchAndroidEmulator(device.id)
        if (!result.success) {
          throw new Error(result.error || 'Failed to launch Android emulator')
        }
      }
      else {
        const result = await window.api.launchIOSSimulator(device.id)
        if (!result.success) {
          throw new Error(result.error || 'Failed to launch iOS simulator')
        }
      }

      toaster.create({
        title: 'Launching device',
        description: `${device.name} is starting up...`,
        type: 'success',
        duration: 3000,
      })

      // Close the modal after successful launch
      setTimeout(onClose, 1000)
    }
    catch (error) {
      toaster.create({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to launch device',
        type: 'error',
        duration: 5000,
      })
      console.error('Error launching virtual device:', error)
    }
    finally {
      setIsLaunching(null)
    }
  }, [onClose])

  // Render a device list item
  const renderDeviceItem = useCallback((device: VirtualDevice) => {
    const isLaunchingThis = isLaunching === device.id
    const isRunning = isDeviceRunning(device)

    return (
      <ListItem
        key={device.id}
        p={3}
        mb={2}
        borderWidth="1px"
        borderRadius="md"
        borderColor={isRunning ? 'flipioPrimary' : 'borderPrimary'}
        _dark={{ borderColor: isRunning ? 'flipioPrimary' : 'borderSecondary' }}
        bg="transparent"
        _hover={{
          bg: 'flipioAqua.50',
        }}
        cursor={isRunning ? 'default' : 'pointer'}
        onClick={() => isRunning ? undefined : handleLaunchDevice(device)}
      >
        <Flex alignItems="center">
          <Icon
            as={device.platform === 'android' ? FaAndroid : LuApple}
            color={device.platform === 'android' ? 'flipioAccent.green' : 'textSecondary'}
            boxSize={6}
            mr={3}
          />
          <Flex direction="column" flex={1}>
            <Text fontWeight="medium" color="textPrimary">{device.name}</Text>
            <Text fontSize="sm" color="textSecondary">
              {isRunning ? 'Booted' : 'Ready to launch'}
            </Text>
          </Flex>
          {isLaunchingThis
            ? (
                <Spinner size="sm" color="flipioPrimary" />
              )
            : (
                <Button
                  size="sm"
                  colorScheme={isRunning ? 'green' : 'blue'}
                  bg={isRunning ? 'green.500' : 'flipioPrimary'}
                  disabled={isRunning}
                  _hover={{
                    bg: isRunning ? 'green.600' : 'flipioSecondary',
                  }}
                  _disabled={{
                    opacity: 0.6,
                    cursor: 'not-allowed',
                  }}
                >
                  {isRunning ? 'Launched' : 'Launch'}
                </Button>
              )}
        </Flex>
      </ListItem>
    )
  }, [isLaunching, handleLaunchDevice, isDeviceRunning])

  // Sort devices with booted ones first
  const sortedDevices = (devices: VirtualDevice[]) => 
    devices.sort((a, b) => {
      const aRunning = isDeviceRunning(a)
      const bRunning = isDeviceRunning(b)
      return aRunning && !bRunning ? -1 : !aRunning && bRunning ? 1 : 0
    })

  return (
    <HStack wrap="wrap" gap="4">
      <Dialog.Root
        key="top"
        open={isOpen}
        onInteractOutside={onClose}
        placement="top"
        motionPreset="slide-in-bottom"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header color="textPrimary">
                <Icon as={LuSmartphone} mr={2} color="textSecondary" />
                Virtual Devices
              </Dialog.Header>
              <Dialog.Body>
                {isLoading
                  ? (
                      <Flex justifyContent="center" py={8}>
                        <Spinner size="md" color="flipioPrimary" />
                      </Flex>
                    )
                  : (
                      <List.Root>
                        <List.Item gap={4}>
                          {/* Android Section */}
                          <Box mb={5}>
                            <Flex align="center" mb={3}>
                              <Icon as={FaAndroid} color="flipioAccent.green" mr={2} />
                              <Heading size="sm" color="textPrimary">Android Emulators</Heading>
                            </Flex>

                            {androidDevices.length > 0
                              ? (
                                  sortedDevices(androidDevices).map(device => (
                                    <React.Fragment key={device.id}>
                                      {renderDeviceItem(device)}
                                    </React.Fragment>
                                  ))
                                )
                              : (
                                  <Flex
                                    direction="column"
                                    alignItems="center"
                                    justifyContent="center"
                                    py={4}
                                    color="textSecondary"
                                  >
                                    <Text color="textPrimary">No Android emulators found</Text>
                                    <Text fontSize="sm" mt={1} color="textSecondary">Install Android Studio to create emulators</Text>
                                  </Flex>
                                )}
                          </Box>
                          {/* iOS Section */}
                          <Box>
                            <Flex align="center" mb={3}>
                              <Icon as={LuApple} color="textSecondary" mr={2} />
                              <Heading size="sm" color="textPrimary">iOS Simulators</Heading>
                            </Flex>

                            {iosSimulators.length > 0
                              ? (
                                  sortedDevices(iosSimulators).map(device => (
                                    <React.Fragment key={device.id}>
                                      {renderDeviceItem(device)}
                                    </React.Fragment>
                                  ))
                                )
                              : (
                                  <Flex
                                    direction="column"
                                    alignItems="center"
                                    justifyContent="center"
                                    py={4}
                                    color="textSecondary"
                                  >
                                    <Text color="textPrimary">No iOS simulators found</Text>
                                    <Text fontSize="sm" mt={1} color="textSecondary">Install Xcode to create iOS simulators</Text>
                                  </Flex>
                                )}
                          </Box>
                        </List.Item>
                      </List.Root>
                    )}
              </Dialog.Body>
              <Dialog.CloseTrigger>
                <CloseButton size="sm" onClick={onClose} />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </HStack>
  )
}
