import { HStack } from '@chakra-ui/react'
import { useCurrentDeviceSelection } from '@renderer/store'
import { ColorModeButton, useColorMode } from '@renderer/ui/color-mode'
import { useEffect, useMemo } from 'react'
import FLSelect from './Select'

function AppHeader() {
  const { colorMode } = useColorMode()
  const isDark = colorMode === 'dark'
  const {
    devicesList,
    setDevicesList,
    selectedDevice,
    setSelectedDevice,
    applicationsList,
    setApplicationsList,
    selectedApplication,
    setSelectedApplication,
  } = useCurrentDeviceSelection()

  const devicesSelectOptions = useMemo(() => {
    return devicesList.map((device: any) => ({
      label: device.model,
      value: device.id,
      deviceType: device.deviceType,
    }))
  }, [devicesList])

  const applicationSelectOptions = useMemo(() => {
    return applicationsList.map((app: any) => ({
      label: app.name,
      value: app.bundleId,
      description: app.bundleId,
    }))
  }, [applicationsList])

  const onDeviceChange = (value: string) => {
    const selectedDevice = devicesList.find((device: any) => device.id === value[0])
    if (selectedDevice) {
      setSelectedDevice(selectedDevice)
    }
  }

  const onPackageChange = (value: string) => {
    const selectedApplication = applicationsList.find((app: any) => app.bundleId === value[0])
    if (selectedApplication) {
      setSelectedApplication(selectedApplication)
    }
  }

  const loadDevices = async () => {
    const deviceResponse = await window.api.getDevices()
    if (deviceResponse.success) {
      setDevicesList(deviceResponse.devices)
    }
    else {
      setDevicesList([])
    }
  }

  const getPackages = async () => {
    let response = {
      success: false,
      packages: [],
    }

    if (selectedDevice?.deviceType === 'iphone') {
      response = await window.api.getIOSPackages(selectedDevice.id)
    }

    if (selectedDevice?.deviceType === 'android') {
      response = await window.api.getAndroidPackages(selectedDevice.id)
    }

    console.log('RESPONSE', response)

    if (!response.success) {
      setApplicationsList([])
      return
    }

    setApplicationsList(response.packages)
  }

  useEffect(() => {
    if (selectedDevice?.id) {
      getPackages()
    }
  }, [selectedDevice])

  useEffect(() => {
    loadDevices()
  }, [])

  return (
    <HStack padding={4} bg={isDark ? 'gray.800' : 'white'} w="full">
      <FLSelect
        options={devicesSelectOptions}
        label="Select device"
        value={[selectedDevice?.id]}
        onChange={onDeviceChange}
      />
      <FLSelect
        options={applicationSelectOptions}
        label="Select app"
        value={[selectedApplication?.bundleId]}
        onChange={onPackageChange}
      />

      <ColorModeButton />
    </HStack>
  )
}

export default AppHeader
