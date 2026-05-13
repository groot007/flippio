import { Box, Button, HStack, Spinner } from '@chakra-ui/react'
import { DeviceInfoModal } from '@renderer/components/common/DeviceInfoModal'
import { fetchApplicationsForDevice, useApplications } from '@renderer/hooks/useApplications'
import { fetchDatabaseFilesForSelection } from '@renderer/hooks/useDatabaseFiles'
import { useDevices } from '@renderer/hooks/useDevices'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection, useRecentlyUsedApps } from '@renderer/store'
import { toaster } from '@renderer/ui/toaster'
import { useQueryClient } from '@tanstack/react-query'
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
  const setSelectedDatabaseTable = useCurrentDatabaseSelection(state => state.setSelectedDatabaseTable)
  
  const { addRecentApp, getRecentAppsForDevice } = useRecentlyUsedApps()
  const queryClient = useQueryClient()

  const {
    data: devicesList = [],
    refetch: refreshDevices,
    isFetching: isRefreshing,
    isPending: isDevicesPending,
    isFetched: hasFetchedDevices,
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
    if (!selectedDevice) {
      return
    }

    const matchedDevice = devicesList.find(device => device.id === selectedDevice.id)

    if (!matchedDevice) {
      setSelectedApplication(null)
      setSelectedDevice(null)
      setSelectedDatabaseTable(null)
      
      // Only clear database file if it's not a custom file (desktop type)
      if (selectedDatabaseFile?.deviceType !== 'desktop') {
        setSelectedDatabaseFile(null)
      }

      return
    }

    if (matchedDevice !== selectedDevice) {
      setSelectedDevice(matchedDevice)
    }
  }, [devicesList, selectedDevice, selectedDatabaseFile, setSelectedApplication, setSelectedDevice, setSelectedDatabaseFile, setSelectedDatabaseTable])

  useEffect(() => {
    if (!selectedApplication) {
      return
    }

    if (isLoading) {
      return
    }

    const matchedApplication = applicationsList.find(app => app.bundleId === selectedApplication.bundleId)

    if (!matchedApplication) {
      setSelectedApplication(null)
      setSelectedDatabaseTable(null)
      setSelectedDatabaseFile(null)
      return
    }

    if (matchedApplication !== selectedApplication) {
      setSelectedApplication(matchedApplication)
    }
  }, [applicationsList, isLoading, selectedApplication, setSelectedApplication, setSelectedDatabaseFile, setSelectedDatabaseTable])

  const handleRefreshDevices = useCallback(async () => {
    try {
      console.info('CriticalPath: refreshing devices from header', {
        deviceId: selectedDevice?.id ?? null,
        bundleId: selectedApplication?.bundleId ?? null,
      })
      const devicesResult = await refreshDevices()
      const refreshedDevices = devicesResult.data ?? []
      const matchedDevice = selectedDevice
        ? refreshedDevices.find(device => device.id === selectedDevice.id) ?? null
        : null

      if (selectedDevice && !matchedDevice) {
        setSelectedDevice(null)
        setSelectedApplication(null)
        setSelectedDatabaseTable(null)
        if (selectedDatabaseFile?.deviceType !== 'desktop') {
          setSelectedDatabaseFile(null)
        }
      }

      if (matchedDevice) {
        setSelectedDevice(matchedDevice)

        const applications = await queryClient.fetchQuery({
          queryKey: ['applications', matchedDevice.id, matchedDevice.deviceType],
          queryFn: () => fetchApplicationsForDevice(matchedDevice),
          staleTime: 0,
        })

        if (selectedApplication) {
          const matchedApplication = applications.find(app => app.bundleId === selectedApplication.bundleId) ?? null

          if (matchedApplication) {
            setSelectedApplication(matchedApplication)

            if (selectedDatabaseFile?.deviceType !== 'desktop') {
              const databaseFiles = await queryClient.fetchQuery({
                queryKey: ['databaseFiles', matchedDevice.id, matchedApplication.bundleId],
                queryFn: () => fetchDatabaseFilesForSelection(matchedDevice, matchedApplication),
                staleTime: 0,
              })

              if (selectedDatabaseFile) {
                const matchedDatabaseFile = databaseFiles.find(file => file.path === selectedDatabaseFile.path) ?? null

                if (matchedDatabaseFile) {
                  setSelectedDatabaseFile(matchedDatabaseFile)
                }
                else {
                  setSelectedDatabaseFile(null)
                  setSelectedDatabaseTable(null)
                }
              }
            }
          }
          else {
            setSelectedApplication(null)
            setSelectedDatabaseFile(null)
            setSelectedDatabaseTable(null)
          }
        }
      }

      toaster.create({
        title: 'Success',
        description: 'Device list refreshed',
        type: 'success',
        duration: 3000,
        meta: {
          closable: true,
        },
      })
      console.info('CriticalPath: device refresh completed', {
        deviceId: matchedDevice?.id ?? null,
        bundleId: selectedApplication?.bundleId ?? null,
      })
    }
    catch (err) {
      console.error('CriticalPath: device refresh failed', err)
      toaster.create({
        title: 'Error refreshing devices',
        description: err instanceof Error ? err.message : 'Failed to refresh devices',
        type: 'error',
        duration: 3000,
        meta: {
          closable: true,
        },
      })
    }
  }, [
    queryClient,
    refreshDevices,
    selectedApplication,
    selectedDatabaseFile,
    selectedDevice,
    setSelectedApplication,
    setSelectedDatabaseFile,
    setSelectedDatabaseTable,
    setSelectedDevice,
  ])

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

  const selectedDeviceOption = useMemo(() => {
    if (!selectedDevice) {
      return null
    }

    return devicesSelectOptions.find(device => device.id === selectedDevice.id) ?? null
  }, [devicesSelectOptions, selectedDevice])

  const selectedApplicationOption = useMemo(() => {
    if (!selectedApplication) {
      return null
    }

    return applicationSelectOptions.find(app => app.bundleId === selectedApplication.bundleId) ?? null
  }, [applicationSelectOptions, selectedApplication])

  const handleDeviceChange = useCallback((value: any) => {
    console.info('CriticalPath: device selected', {
      deviceId: value?.id ?? null,
      deviceType: value?.deviceType ?? null,
      deviceName: value?.name ?? value?.label ?? null,
    })
    setSelectedDevice(value)
    setSelectedApplication(null)
    setSelectedDatabaseTable(null)
  }, [setSelectedApplication, setSelectedDatabaseTable, setSelectedDevice])

  const handlePackageChange = useCallback((value) => {
    console.info('CriticalPath: app selected', {
      deviceId: selectedDevice?.id ?? null,
      bundleId: value?.bundleId ?? null,
      appName: value?.name ?? null,
    })
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
    console.info('CriticalPath: virtual device modal closed, scheduling device refresh')
    setTimeout(() => {
      refreshDevices()
    }, 1500)
  }, [refreshDevices])

  const isInitialDeviceSync = isDevicesPending && !hasFetchedDevices

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
              value={selectedDeviceOption}
              icon={<LuSmartphone color="var(--chakra-colors-flipioPrimary)" />}
              onChange={handleDeviceChange}
              isDisabled={isInitialDeviceSync}
              noOptionsMessage="No devices found. Connect a device or launch an emulator/simulator"
            />
            <FLSelect
              options={applicationSelectOptions}
              label="Select App"
              menuListWidth={300}
              value={selectedApplicationOption}
              icon={<LuPackage color="var(--chakra-colors-flipioPrimary)" />}
              onChange={handlePackageChange}
              isDisabled={!selectedDevice || isLoading}
              showPinIcon={true}
            />
            {(isInitialDeviceSync || isLoading) && (
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
