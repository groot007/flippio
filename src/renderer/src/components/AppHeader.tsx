import type { Application } from '@renderer/hooks/useApplications'
import { Button, HStack, Spacer } from '@chakra-ui/react'
import { useApplications } from '@renderer/hooks/useApplications'
import { useDevices } from '@renderer/hooks/useDevices'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection } from '@renderer/store'
import { ColorModeButton } from '@renderer/ui/color-mode'
import { toaster } from '@renderer/ui/toaster'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { LuRefreshCcw } from 'react-icons/lu'
import FLSelect from './FLSelect'

function AppHeader() {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const selectedDevice = useCurrentDeviceSelection(state => state.selectedDevice)
  const setSelectedDevice = useCurrentDeviceSelection(state => state.setSelectedDevice)
  const selectedApplication = useCurrentDeviceSelection(state => state.selectedApplication)
  const setSelectedApplication = useCurrentDeviceSelection(state => state.setSelectedApplication)
  const setSelectedDatabaseFile = useCurrentDatabaseSelection(state => state.setSelectedDatabaseFile)

  const {
    devices: devicesList,
    refresh: refreshDevices,
  } = useDevices()

  const handleRefreshDevices = useCallback(() => {
    let timeoutId: NodeJS.Timeout | null = null
    setIsRefreshing(true)

    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    refreshDevices()
      .then(() => {
        timeoutId = setTimeout(() => {
          toaster.create({
            title: 'Device list refreshed',
            status: 'success',
            duration: 3000,
            isClosable: true,
          })
        }, 800)
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

      .finally(() => {
        timeoutId = setTimeout(() => {
          setIsRefreshing(false)
        }, 800)
      })
  }, [])

  const {
    isLoading,
    applications: applicationsList,
  } = useApplications(selectedDevice)

  const devicesSelectOptions = useMemo(() =>
    devicesList.map(device => ({
      label: device.model,
      value: device.id,
      description: device.deviceType === 'iphone' ? 'iOS' : 'Android',
      ...device,
    })), [devicesList])

  const applicationSelectOptions = useMemo(() =>
    applicationsList.map(app => ({
      label: app.name,
      value: app.bundleId,
      description: app.bundleId,
      ...app,
    })), [applicationsList])

  const handleDeviceChange = useCallback((value: any) => {
    setSelectedDevice(value)
    setSelectedApplication(null)
  }, [setSelectedDevice, setSelectedApplication])

  const handlePackageChange = useCallback((value: Application) => {
    setSelectedDatabaseFile(null)
    setSelectedApplication(value)
  }, [setSelectedApplication])

  useEffect(() => {
    refreshDevices()
  }, [])

  return (
    <HStack padding={4} w="full" alignItems="center">
      <HStack direction="row" gap={5} alignItems="center">
        <FLSelect
          options={devicesSelectOptions}
          label="Select Device"
          value={selectedDevice}
          onChange={handleDeviceChange}
        />
        <FLSelect
          options={applicationSelectOptions}
          label="Select App"
          value={selectedApplication}
          onChange={handlePackageChange}
          isDisabled={!selectedDevice || isLoading}
        />
      </HStack>
      <Button
        data-state={isRefreshing ? 'open' : 'closed'}
        onClick={handleRefreshDevices}
        bg="transparent"
        color="gray.300"
        ml="10px"
        _hover={{
          opacity: 0.8,
        }}
        disabled={isRefreshing || isLoading}
        _open={{
          animationName: 'rotate',
          animationDuration: '1100ms',
        }}
      >
        <LuRefreshCcw />
      </Button>
      <Spacer />

      <ColorModeButton />
    </HStack>
  )
}

export default AppHeader
