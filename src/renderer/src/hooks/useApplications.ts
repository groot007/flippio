import { useQuery } from '@tanstack/react-query'

export interface Device {
  id: string
  model: string
  deviceType: 'iphone' | 'android' | 'desktop' | 'iphone-device'
}

interface Application {
  name: string
  bundleId: string
}

interface ApplicationsResponse {
  success: boolean
  packages: Application[]
  error?: string
}

export function useApplications(selectedDevice: Device | null) {
  return useQuery({
    queryKey: ['applications', selectedDevice?.id, selectedDevice?.deviceType],
    queryFn: async () => {
      if (!selectedDevice?.id) {
        throw new Error('No device selected')
      }

      let fetchFunction: (deviceId: string) => Promise<ApplicationsResponse>

      if (selectedDevice.deviceType === 'iphone') {
        fetchFunction = window.api.getIOSPackages
      }
      else if (selectedDevice.deviceType === 'iphone-device') {
        fetchFunction = window.api.getIOsDevicePackages
      }
      else {
        fetchFunction = window.api.getAndroidPackages
      }

      const response = await fetchFunction(selectedDevice.id)

      if (!response.success) {
        throw new Error(response.error || `Failed to load apps for ${selectedDevice.model}`)
      }

      return response.packages
    },
    enabled: !!selectedDevice?.id,
    gcTime: 1000 * 60 * 5, // 5 minutes
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 1,
  })
}
