import { HStack } from '@chakra-ui/react'
import { useAppStore } from '@renderer/store/appStore'
import { ColorModeButton, useColorMode } from '@renderer/ui/color-mode'
import { useEffect, useMemo, useState } from 'react'
import FLSelect from './Select'

interface SelectOption {
  label: string | JSX.Element
  value: string
  desctiption?: string
}

function AppHeader() {
  const { colorMode } = useColorMode()
  const isDark = colorMode === 'dark'
  const {
    devices,
    applications,
    setDevices,
    setApplications,
    selectedApplication,
    selectedDevice,
    setSelectedApplication,
    setSelectedDevice,
    setDatabaseFiles,
  } = useAppStore()

  const deviceType = useMemo(() => {
    return devices.find(device => device.value === selectedDevice[0])?.deviceType
  }, [selectedDevice, devices])

  const onDeviceChange = (value: string) => {
    setSelectedDevice(value)
  }

  const onPackageChange = (value: string) => {
    setSelectedApplication(value)
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

    if (deviceType === 'iphone') {
      response = await window.api.getIOSPackages(selectedDevice[0])
    }

    if (deviceType === 'android') {
      response = await window.api.getAndroidPackages(selectedDevice[0])
    }

    if (!response.success) {
      setApplications([])
      return
    }

    const modPackages = response.packages?.map((pkg: any) => ({
      label: pkg.name,
      value: pkg.bundleId,
      // description: pkg.bundleId,
    })) ?? []

    setApplications(modPackages)
    // setSelectedDatabaseFile('nice')
    //   setSelectedDatabaseTable('nice')
  }

  useEffect(() => {
    if (selectedDevice[0]) {
      getPackages()
    }
  }, [selectedDevice])

  const getDatabaseFiles = async () => {
    if (deviceType === 'iphone') {
      const response = await window.api.getIOSDatabaseFiles(selectedDevice[0], selectedApplication?.[0])
      if (response.success) {
        const files = response.files.map((file: any) => ({
          ...file,
          deviceType: 'iphone',
        }))
        setDatabaseFiles(files)
      }
      return
    }

    if (deviceType === 'android') {
      const response = await window.api.getAndroidDatabaseFiles(selectedDevice[0], selectedApplication?.[0])
      if (response.success) {
        setDatabaseFiles(response.files)
      }
    }
  }

  useEffect(() => {
    if (selectedApplication?.[0]) {
      getDatabaseFiles()
    }
  }, [selectedApplication])

  useEffect(() => {
    loadDevices()
  }, [])

  return (
    <HStack padding={4} bg={isDark ? 'gray.800' : 'white'} w="full">
      <FLSelect
        options={devices}
        label="Select device"
        value={selectedDevice}
        onChange={onDeviceChange}
      />
      <FLSelect
        options={applications}
        label="Select app"
        value={selectedApplication || []}
        onChange={onPackageChange}
      />

      <ColorModeButton />
    </HStack>
  )
}

export default AppHeader
