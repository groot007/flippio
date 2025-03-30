import type { DeviceInfo } from '@renderer/types'
import { useCurrentDeviceSelection } from '@renderer/store'
import { useCallback, useState } from 'react'

export interface Application {
  name: string
  bundleId: string
}

// Hook for device management
export function useDevices() {
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setDevicesListToStore = useCurrentDeviceSelection(state => state.setDevicesList)

  const fetchDevices = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await window.api.getDevices()
      if (response.success) {
        setDevices(response.devices)
        setDevicesListToStore(response.devices)
      }
      else {
        console.error('Error fetching devices - not success:', response.error)
        setError(response.error || 'Failed to load devices')
        setDevices([])
        setDevicesListToStore([])
      }
    }
    catch (err) {
      console.error('Error fetching devices:', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      setDevices([])
      setDevicesListToStore([])
    }
    finally {
      setIsLoading(false)
    }
  }, [setDevicesListToStore])

  return {
    devices,
    isLoading,
    error,
    refresh: fetchDevices,
  }
}
