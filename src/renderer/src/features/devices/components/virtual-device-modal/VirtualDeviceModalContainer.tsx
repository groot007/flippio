import type { VirtualDevice } from '../../types/virtualDevice'
import type { VirtualDeviceModalContainerProps } from './types'

import { toaster } from '@renderer/ui/toaster'
import { useCallback, useEffect, useState } from 'react'

import { VirtualDeviceModalPresenter } from './VirtualDeviceModalPresenter'

/**
 * Container component for VirtualDeviceModal
 * Handles business logic, state management, and API calls
 */
export function VirtualDeviceModalContainer({ isOpen, onClose }: VirtualDeviceModalContainerProps) {
  const [androidDevices, setAndroidDevices] = useState<VirtualDevice[]>([])
  const [iosSimulators, setIosSimulators] = useState<VirtualDevice[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isLaunching, setIsLaunching] = useState<string | null>(null)

  // Fetch the list of available virtual devices
  const fetchVirtualDevices = useCallback(async () => {
    try {
      setIsLoading(true)
      console.log('🔄 Fetching virtual devices...')

      // Fetch Android emulators
      const androidResponse = await window.api.getAndroidEmulators()
      console.log('📱 Android emulators response:', androidResponse)

      if (androidResponse.success && Array.isArray(androidResponse.emulators)) {
        const androidVirtualDevices: VirtualDevice[] = androidResponse.emulators.map((device: any) => ({
          name: device.name || device.id || 'Unknown Device',
          id: device.id || device.name || '',
          platform: 'android' as const,
          state: device.state || 'unknown',
        }))
        setAndroidDevices(androidVirtualDevices)
      }
      else {
        console.warn('❌ Failed to fetch Android emulators:', androidResponse.error)
        setAndroidDevices([])
      }

      // Fetch iOS simulators
      const iosResponse = await window.api.getIOSSimulators()
      console.log('📱 iOS simulators response:', iosResponse)

      if (iosResponse.success && Array.isArray(iosResponse.simulators)) {
        const iosVirtualDevices: VirtualDevice[] = iosResponse.simulators.map((device: any) => ({
          name: device.name || device.udid || 'Unknown Simulator',
          id: device.udid || device.name || '',
          platform: 'ios' as const,
          state: device.state || 'unknown',
        }))
        setIosSimulators(iosVirtualDevices)
      }
      else {
        console.warn('❌ Failed to fetch iOS simulators:', iosResponse.error)
        setIosSimulators([])
      }
    }
    catch (error) {
      console.error('❌ Error fetching virtual devices:', error)
      toaster.create({ title: 'Failed to fetch virtual devices', type: 'error' })
      setAndroidDevices([])
      setIosSimulators([])
    }
    finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchVirtualDevices()
    }
  }, [isOpen, fetchVirtualDevices])

  const handleLaunchDevice = useCallback(async (deviceId: string, platform: 'android' | 'ios') => {
    setIsLaunching(deviceId)
    try {
      console.log(`🚀 Launching ${platform} device: ${deviceId}`)

      let response
      if (platform === 'android') {
        response = await window.api.launchAndroidEmulator(deviceId)
      }
      else {
        response = await window.api.launchIOSSimulator(deviceId)
      }

      if (response?.success) {
        toaster.create({ 
          title: `${platform === 'android' ? 'Android emulator' : 'iOS simulator'} is launching...`, 
          type: 'success', 
        })
        // Refresh the device list to update states
        setTimeout(() => {
          fetchVirtualDevices()
        }, 2000)
      }
      else {
        console.error(`❌ Failed to launch ${platform} device:`, response?.error)
        toaster.create({ 
          title: `Failed to launch ${platform === 'android' ? 'Android emulator' : 'iOS simulator'}`, 
          type: 'error', 
        })
      }
    }
    catch (error) {
      console.error(`❌ Error launching ${platform} device:`, error)
      toaster.create({ 
        title: `Error launching ${platform === 'android' ? 'Android emulator' : 'iOS simulator'}`, 
        type: 'error', 
      })
    }
    finally {
      setIsLaunching(null)
    }
  }, [fetchVirtualDevices])

  const handleRefreshDevices = useCallback(() => {
    fetchVirtualDevices()
  }, [fetchVirtualDevices])

  return (
    <VirtualDeviceModalPresenter
      isOpen={isOpen}
      onClose={onClose}
      androidDevices={androidDevices}
      iosSimulators={iosSimulators}
      isLoading={isLoading}
      isLaunching={isLaunching}
      onLaunchDevice={handleLaunchDevice}
      onRefreshDevices={handleRefreshDevices}
    />
  )
}
