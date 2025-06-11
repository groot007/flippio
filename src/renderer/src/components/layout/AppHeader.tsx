import { Button, HStack, Spinner } from '@chakra-ui/react'
import { useApplications } from '@renderer/hooks/useApplications'
import { useDevices } from '@renderer/hooks/useDevices'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection } from '@renderer/store'
import { toaster } from '@renderer/ui/toaster'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { LuPackage, LuRefreshCcw, LuSmartphone } from 'react-icons/lu'
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

  console.log('[AppHeader] selectedDevice:', selectedDevice)

  const {
    isLoading,
    data: applicationsList = [],
  } = useApplications(selectedDevice)

  const [isPackageSetModalOpen, setIsPackageSetModalOpen] = useState(false)
  const closePackageSeModal = useCallback(() => {
    setIsPackageSetModalOpen(false)
  }, [setIsPackageSetModalOpen])

  useEffect(() => {
    let timer
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
    refreshDevices()
      .then(() => {
        toaster.create({
          title: 'Success',
          description: 'Device list refreshed',
          status: 'success',
          duration: 3000,
          isClosable: true,
        })
      })
      .catch((err) => {
        toaster.create({
          title: 'Error refreshing devices',
          description: err.message,
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
      })
  }, [])

  const devicesSelectOptions = useMemo(() => {
    console.error('[AppHeader] Raw devicesList:', devicesList)
    const options = devicesList.map((device) => {
      console.error('[AppHeader] Processing device:', device)
      const osVersion = device.deviceType === 'iphone' ? device.iosVersion : ''
      const option = {
        label: `${device.model || device.name || 'Unknown Device'} ${osVersion}`,
        value: device.id,
        description: device.deviceType === 'iphone' ? 'iOS' : 'Android',
        ...device,
      }
      console.error('[AppHeader] Created option:', option)
      return option
    })
    console.error('[AppHeader] Final devicesSelectOptions:', options)
    return options
  }, [devicesList])

  const applicationSelectOptions = useMemo(() => {
    console.error('[AppHeader] Raw applicationsList:', applicationsList)
    return applicationsList.map(app => ({
      label: app.name,
      value: app.bundleId,
      description: app.bundleId,
      ...app,
    }))
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
      <HStack padding={4} w="full" alignItems="center">
        <HStack direction="row" gap={5} alignItems="center">
          <FLSelect
            options={devicesSelectOptions}
            label="Select Device"
            value={selectedDevice}
            icon={<LuSmartphone color="#47d5c9" />}
            onChange={handleDeviceChange}
            noOptionsMessage="No devices available. Try run an emulator"
          />
          <FLSelect
            options={applicationSelectOptions}
            label="Select App"
            value={selectedApplication}
            icon={<LuPackage color="#47d5c9" />}
            onChange={handlePackageChange}
            isDisabled={!selectedDevice || isLoading}
          />
          {isLoading && <Spinner size="sm" color="blue.500" /> }
        </HStack>
        <Button
          data-testid="refresh-devices"
          data-state={isRefreshing ? 'open' : 'closed'}
          onClick={handleRefreshDevices}
          bg="transparent"
          color="flipioSecondary"
          ml="10px"
          _hover={{
            opacity: 0.8,
          }}
          disabled={isRefreshing}
          _open={{
            animationName: 'rotate',
            animationDuration: '1100ms',
          }}
        >
          <LuRefreshCcw />
        </Button>

        <HStack ml="auto" flex={1} w="full" justifyItems="flex-end">
          <Button
            onClick={handleOpenVirtualDeviceModal}
            variant="outline"
            size="sm"
            ml="auto"
            mr="4"
            title="Launch Emulator"
            color="flipioPrimary"
            borderColor="flipioPrimary"
            _hover={{
              bg: 'flipioAqua.50',
              _dark: { bg: 'flipioTeal.900' },
            }}
          >
            <LuSmartphone />
          </Button>

          <Settings />
        </HStack>
      </HStack>

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
