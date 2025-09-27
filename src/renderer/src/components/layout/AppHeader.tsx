import { Box, Button, HStack, Spinner } from '@chakra-ui/react'
import { DeviceInfoModal } from '@renderer/components/common/DeviceInfoModal'
import { useApplications } from '@renderer/hooks/useApplications'
import { useDevices } from '@renderer/hooks/useDevices'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection, useRecentlyUsedApps } from '@renderer/store'
import { toaster } from '@renderer/ui/toaster'
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
  const selectedDatabaseFile = useCurrentDatabaseSelection(state => state.selectedDatabaseFile)
  const setSelectedDatabaseFile = useCurrentDatabaseSelection(state => state.setSelectedDatabaseFile)
  
  const { addRecentApp, getRecentAppsForDevice } = useRecentlyUsedApps()

  const {
    data: devicesList = [],
    refetch: refreshDevices,
    isFetching: isRefreshing,
  } = useDevices()

  const {
    isLoading,
    data: applicationsList = [],
    error: applicationsError,
    isError: isApplicationsError,
  } = useApplications(selectedDevice)

  const [isPackageSetModalOpen, setIsPackageSetModalOpen] = useState(false)
  const [deviceInfoModal, setDeviceInfoModal] = useState<{
    isOpen: boolean
    deviceId: string
    deviceType: string
    deviceName: string
  }>({
    isOpen: false,
    deviceId: '',
    deviceType: '',
    deviceName: '',
  })
  
  const closePackageSeModal = useCallback(() => {
    setIsPackageSetModalOpen(false)
  }, [setIsPackageSetModalOpen])

  const handleDeviceInfoClick = useCallback((device: any) => {
    setDeviceInfoModal({
      isOpen: true,
      deviceId: device.id,
      deviceType: device.deviceType || device.device_type || 'unknown',
      deviceName: device.name || device.label || device.id,
    })
  }, [])

  const closeDeviceInfoModal = useCallback(() => {
    setDeviceInfoModal(prev => ({ ...prev, isOpen: false }))
  }, [])

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (
      selectedDevice?.deviceType === 'iphone-device'
      && isLoading
    ) {
      timer = setTimeout(() => {
        setIsPackageSetModalOpen(true)
      }, 5000)
    }
    else {
      setIsPackageSetModalOpen(false)
    }
    return () => {
      clearTimeout(timer)
    }
  }, [selectedDevice, isLoading])

  // Handle iOS installation proxy errors with user-friendly toast
  useEffect(() => {
    if (isApplicationsError && applicationsError && selectedDevice?.deviceType === 'iphone-device') {
      const errorMessage = applicationsError.message || ''
      
      if (errorMessage.includes('Could not start com.apple.mobile.installation_proxy')) {
        toaster.create({
          title: 'iPhone Connection Issue',
          description: 'Cannot access iPhone apps. Please unlock your phone. Enable Developer Mode (iOS 16+)\n\nThen try again.',
          type: 'error',
          duration: 10000,
          meta: {
            closable: true,
          },
        })
      }
      else if (errorMessage.includes('Device not found') || errorMessage.includes('No device found')) {
        toaster.create({
          title: 'iPhone Not Found',
          description: 'iPhone is not detected. Please check USB connection and try reconnecting your device.',
          type: 'error',
          duration: 6000,
          meta: {
            closable: true,
          },
        })
      }
      else {
        // Generic iOS error
        toaster.create({
          title: 'iPhone Error',
          description: `Failed to load iPhone apps: ${errorMessage}`,
          type: 'error',
          duration: 6000,
          meta: {
            closable: true,
          },
        })
      }
    }
  }, [isApplicationsError, applicationsError, selectedDevice])

  useEffect(() => {
    if (!devicesList.find(device => device.id === selectedDevice?.id)) {
      setSelectedApplication(null)
      setSelectedDevice(null)
      
      // Only clear database file if it's not a custom file (desktop type)
      if (selectedDatabaseFile?.deviceType !== 'desktop') {
        setSelectedDatabaseFile(null)
      }
    }
  }, [devicesList, selectedDevice, selectedDatabaseFile, setSelectedApplication, setSelectedDevice, setSelectedDatabaseFile])

  const handleRefreshDevices = useCallback(() => {
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
        showInfoIcon: true,
        onInfoClick: handleDeviceInfoClick,
        ...device,
      }
    }), [devicesList, handleDeviceInfoClick])

  const applicationSelectOptions = useMemo(() => {
    if (!selectedDevice) 
      return []
    
    // Get recently used apps for the current device
    const recentApps = getRecentAppsForDevice(selectedDevice.id)
    const recentBundleIds = new Set(recentApps.map(app => app.bundleId))
    
    // Map all applications to options
    const allAppOptions = applicationsList.map((app) => {
      const description = app.bundleId === app.name ? '' : app.bundleId
      const isRecentlyUsed = recentBundleIds.has(app.bundleId)
      return {
        label: app.name,
        value: app.bundleId,
        description,
        isRecentlyUsed,
        ...app,
      } 
    })
    
    // Find recently used apps that are still available
    const recentAppOptions = recentApps
      .map((recentApp) => {
        const foundApp = applicationsList.find(app => app.bundleId === recentApp.bundleId)
        if (foundApp) {
          const description = foundApp.bundleId === foundApp.name ? '' : foundApp.bundleId
          return {
            label: foundApp.name,
            value: foundApp.bundleId,
            description,
            isRecentlyUsed: true,
            ...foundApp,
          }
        }
        return null
      })
      .filter(Boolean)
      .slice(0, 3) // Limit to top 3 recent apps
    
    // Filter out recently used apps from the main list to avoid duplicates
    const otherAppOptions = allAppOptions.filter(app => !recentBundleIds.has(app.bundleId))
    
    // Combine: recent apps first, then all other apps
    return [...recentAppOptions, ...otherAppOptions]
  }, [applicationsList, selectedDevice, getRecentAppsForDevice])

  const handleDeviceChange = useCallback((value: any) => {
    setSelectedDevice(value)
    setSelectedApplication(null)
  }, [setSelectedDevice, setSelectedApplication])

  const handlePackageChange = useCallback((value) => {
    setSelectedDatabaseFile(null)
    setSelectedApplication(value)
    
    // Add to recently used apps if we have a device and app selected
    if (selectedDevice && value) {
      addRecentApp(value, selectedDevice.id, selectedDevice.name || selectedDevice.id)
    }
  }, [setSelectedApplication, setSelectedDatabaseFile, selectedDevice, addRecentApp])

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
              menuListWidth={300}
              value={selectedApplication}
              icon={<LuPackage color="var(--chakra-colors-flipioPrimary)" />}
              onChange={handlePackageChange}
              isDisabled={!selectedDevice || isLoading}
              showPinIcon={true}
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

      <DeviceInfoModal
        isOpen={deviceInfoModal.isOpen}
        onClose={closeDeviceInfoModal}
        deviceId={deviceInfoModal.deviceId}
        deviceType={deviceInfoModal.deviceType}
        deviceName={deviceInfoModal.deviceName}
      />
    </>
  )
}

export default AppHeader
