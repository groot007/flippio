import { useCurrentDeviceSelection } from '@renderer/store'
import { useEffect, useState } from 'react'

export interface Device {
  id: string
  model: string
  deviceType: 'iphone' | 'android' | 'desktop'
}

export interface Application {
  name: string
  bundleId: string
}

export function useApplications(selectedDevice: Device | null) {
  const [applications, setApplications] = useState<Application[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setApplicationsListToStore = useCurrentDeviceSelection(state => state.setApplicationsList)

  useEffect(() => {
    async function fetchApplications() {
      if (!selectedDevice?.id) {
        setApplications([])
        setApplicationsListToStore([])
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const fetchFunction = selectedDevice.deviceType === 'iphone'
          ? window.api.getIOSPackages
          : window.api.getAndroidPackages

        const response = await fetchFunction(selectedDevice.id)

        if (response.success) {
          setApplications(response.packages)
          setApplicationsListToStore(response.packages)
        }
        else {
          setError(response.error || `Failed to load apps for ${selectedDevice.model}`)
          setApplications([])
          setApplicationsListToStore([])
        }
      }
      catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred')
        setApplications([])
        setApplicationsListToStore([])
      }
      finally {
        setIsLoading(false)
      }
    }

    fetchApplications()
  }, [selectedDevice, setApplicationsListToStore])

  return {
    applications,
    isLoading,
    error,
  }
}
