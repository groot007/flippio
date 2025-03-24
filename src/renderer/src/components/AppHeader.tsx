import { HStack } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import FLSelect from './Select'
import { ColorModeButton } from '@renderer/ui/color-mode'

interface SelectOption {
  label: string | JSX.Element
  value: string
  desctiption?: string
}

function AppHeader() {
  const [devices, setDevices] = useState<SelectOption[]>([])
  const [packages, setPackages] = useState<SelectOption[]>([])
  const [selectedDevice, setSelectedDevice] = useState('')
  const [selectedPackage, setSelectedPackage] = useState('')
  const onDeviceChange = (value: string) => {
    setSelectedDevice(value)
  }

  const onPackageChange = (value: string) => {
    setSelectedPackage(value)
  }

  const loadDevices = async () => {
    const deviceResponse = await window.api.getDevices()
    if (deviceResponse.success) {
      const devices = deviceResponse.devices?.map((device: any) => ({
        label: device.model,
        value: device.id,
        deviceType: device.deviceType,
      })) ?? []
      setDevices(devices)
    }
    else {
      setDevices([{
        label: 'No devices found',
        value: 'no device',
      }])
    }
  }

  const getPackages = async () => {
    let response = {
      success: false,
      packages: [],
    }
    const deviceType = devices.find(device => device.value === selectedDevice[0])?.deviceType

    if (deviceType === 'iphone') {
      response = await window.api.getIOSPackages(selectedDevice[0])
    }

    if (deviceType === 'android') {
      response = await window.api.getAndroidPackages(selectedDevice[0])
    }

    if (!response.success) {
      setPackages([])
      return
    }
    console.log('packages', response, deviceType, selectedDevice[0])

    const modPackages = response.packages?.map((pkg: any) => ({
      label: pkg.name,
      value: pkg.bundleId,
      description: pkg.bundleId,
    })) ?? []

    setPackages(modPackages)
  }

  useEffect(() => {
    if (selectedDevice) {
      getPackages()
    }
  }, [selectedDevice])

  useEffect(() => {
    loadDevices()
  }, [])

  return (
    <HStack padding={4} bg="gray.900" w="full">
      <FLSelect
        options={devices}
        label="Select device"
        value={selectedDevice}
        onChange={onDeviceChange}
      />
      <FLSelect
        options={packages}
        label="Select app"
        value={selectedPackage}
        onChange={onPackageChange}
      />

<ColorModeButton />
    </HStack>
  )
}

export default AppHeader
