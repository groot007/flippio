import { Box, Button, HStack, Spinner } from '@chakra-ui/react'
import { useApplications } from '@renderer/hooks/useApplications'
import { useDevices } from '@renderer/hooks/useDevices'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection } from '@renderer/store'
import { toaster } from '@renderer/ui/toaster'
import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { LuPackage, LuRefreshCcw, LuRocket, LuSmartphone } from 'react-icons/lu'
import FLSelect from './../common/FLSelect'
import { VirtualDeviceModal } from './../data/VirtualDeviceModal'
import { PackageSetModal } from './PackageSetModal'
import { Settings } from './Settings'

function AppHeader() {
  const [isVirtualDeviceModalOpen, setIsVirtualDeviceModalOpen] = useState(false)

  const selectedDevice = useCurrentDeviceSelection(state => state.selectedDevice)
  const setSelectedDevice = useCurrentDeviceSelection(state => state.setSelectedDevice)
  const selectedApplication = useCurrentDeviceSelection(state => state.selectedApplication)
  const setSelectedApplication = useCurrentDeviceSelection(state => state.setSelectedApplication)
  const setSelectedDatabaseFile = useCurrentDatabaseSelection(state => state.setSelectedDatabaseFile)

  const {
    data: devicesList = [],
    refetch: refreshDevices,
    isFetching: isRefreshing,
  } = useDevices()

  const {
    isLoading,
    data: applicationsList = [],
  } = useApplications(selectedDevice)

  const [isPackageSetModalOpen, setIsPackageSetModalOpen] = useState(false)
  const closePackageSeModal = useCallback(() => {
    setIsPackageSetModalOpen(false)
  }, [setIsPackageSetModalOpen])

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (
      selectedDevice?.deviceType === 'iphone-device'
      && isLoading
    ) {
      timer = setTimeout(() => {
        setIsPackageSetModalOpen(true)
      }, 2000)
    }
    else {
      setIsPackageSetModalOpen(false)
    }
    return () => {
      clearTimeout(timer)
    }
  }, [selectedDevice, isLoading])

  useEffect(() => {
    if (!devicesList.find(device => device.id === selectedDevice?.id)) {
      setSelectedApplication(null)
      setSelectedDevice(null)
      setSelectedDatabaseFile(null)
    }
  }, [devicesList, selectedDevice, setSelectedApplication, setSelectedDevice])

  const handleRefreshDevices = useCallback(() => {
    invoke('get_libimobiledevice_tool_path_cmd', { toolName: 'idevice_id' })
      .then((toolPath) => {
        console.log('Libimobiledevice tool path:', toolPath)
      })
      .catch((err) => {
        console.error('Error getting libimobiledevice tool path:', err)
      })
    refreshDevices()
      .then(() => {
        toaster.create({
          title: 'Success',
          description: 'Device list refreshed',
          type: 'success',
          duration: 3000,
          meta: {
            closable: true,
          },
        })
      })
      .catch((err) => {
        toaster.create({
          title: 'Error refreshing devices',
          description: err.message,
          type: 'error',
          duration: 3000,
          meta: {
            closable: true,
          },
        })
      })
  }, [])

  const devicesSelectOptions = useMemo(() =>
    devicesList.map((device) => {
      const osVersion = device.deviceType === 'iphone' ? device.iosVersion || '' : ''
      return {
        label: device.label || `${device.name} ${osVersion}`,
        value: device.id,
        description: device.description || (device.deviceType?.includes('iphone') ? 'iOS' : 'Android'),
        ...device,
      }
    }), [devicesList])

  const applicationSelectOptions = useMemo(() => {
    console.log('Applications list:', applicationsList)
    return applicationsList.map((app) => {
      const description = app.bundleId === app.name ? '' : app.bundleId
      return {
        label: app.name,
        value: app.bundleId,
        description,
        ...app,
      } 
    })
  }, [applicationsList, selectedApplication])

  const handleDeviceChange = useCallback((value: any) => {
    setSelectedDevice(value)
    setSelectedApplication(null)
  }, [setSelectedDevice, setSelectedApplication])

  const handlePackageChange = useCallback((value) => {
    setSelectedDatabaseFile(null)
    setSelectedApplication(value)
  }, [setSelectedApplication])

  const handleOpenVirtualDeviceModal = useCallback(() => {
    setIsVirtualDeviceModalOpen(true)
  }, [])

  const handleCloseVirtualDeviceModal = useCallback(() => {
    setIsVirtualDeviceModalOpen(false)
    setTimeout(() => {
      refreshDevices()
    }, 1500)
  }, [refreshDevices])

  return (
    <>
      <Box
        padding={6}
        w="full"
        bg="bgPrimary"
        borderBottom="1px solid"
        borderColor="borderPrimary"
        boxShadow="sm"
      >
        <HStack gap={5} alignItems="center">
          {/* Device and App Selection */}
          <HStack gap={4} alignItems="center" flex={1}>
            <FLSelect
              options={devicesSelectOptions}
              label="Select Device"
              value={selectedDevice}
              icon={<LuSmartphone color="var(--chakra-colors-flipioPrimary)" />}
              onChange={handleDeviceChange}
              noOptionsMessage="No devices found. Connect a device or launch an emulator/simulator"
            />
            <FLSelect
              options={applicationSelectOptions}
              label="Select App"
              value={selectedApplication}
              icon={<LuPackage color="var(--chakra-colors-flipioPrimary)" />}
              onChange={handlePackageChange}
              isDisabled={!selectedDevice || isLoading}
            />
            {isLoading && (
              <Spinner
                size="sm"
                color="flipioPrimary"
              />
            )}

            <Button
              data-testid="refresh-devices"
              data-state={isRefreshing ? 'open' : 'closed'}
              onClick={handleRefreshDevices}
              variant="ghost"
              size="sm"
              color="textSecondary"
              _hover={{
                bg: 'bgTertiary',
                color: 'flipioPrimary',
              }}
              disabled={isRefreshing}
              _disabled={{
                opacity: 0.5,
              }}
              _open={{
                animationName: 'rotate',
                animationDuration: '1100ms',
              }}
              title="Refresh devices"
            >
              <LuRefreshCcw size={16} />
            </Button>
          </HStack>

          {/* Actions */}
          <HStack gap={3} alignItems="center">
            <Button
              onClick={handleOpenVirtualDeviceModal}
              variant="outline"
              size="sm"
              title="Launch Emulator"
              color="textSecondary"
              border="none"
              _hover={{
                bg: 'bgTertiary',
              }}
            >
              <LuRocket size={16} />
            </Button>

            <Settings />
          </HStack>
        </HStack>
      </Box>

      <VirtualDeviceModal
        isOpen={isVirtualDeviceModalOpen}
        onClose={handleCloseVirtualDeviceModal}
      />

      <PackageSetModal
        isLoading={isLoading}
        isOpen={isPackageSetModalOpen}
        onClose={closePackageSeModal}
        onPackageSet={closePackageSeModal}
      />
    </>
  )
}

export default AppHeader
