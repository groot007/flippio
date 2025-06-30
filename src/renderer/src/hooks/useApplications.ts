import { transformToCamelCase } from '@renderer/utils/caseTransformer'
import { useQuery } from '@tanstack/react-query'

export interface Device {
  id: string
  model: string
  deviceType: 'iphone' | 'android' | 'desktop' | 'iphone-device' | 'emulator' | 'simulator'
  platform?: string
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

      console.log('Getting applications for device:', selectedDevice)

      let fetchFunction: (deviceId: string) => Promise<ApplicationsResponse>

      if (selectedDevice.deviceType === 'iphone' || selectedDevice.deviceType === 'simulator') {
        console.log('Using getIOSPackages for simulator')
        fetchFunction = window.api.getIOSPackages
      }
      else if (selectedDevice.deviceType === 'iphone-device') {
        console.log('Using getIOsDevicePackages for physical iOS device')
        fetchFunction = window.api.getIOsDevicePackages
      }
      else {
        console.log('Using getAndroidPackages for Android device/emulator')
        // Handle Android devices and emulators
        fetchFunction = window.api.getAndroidPackages
      }

      const response = await fetchFunction(selectedDevice.id)

      console.log('Applications response:', response)

      if (!response.success) {
        throw new Error(response.error || `Failed to load apps for ${selectedDevice.model}`)
      }

      return transformToCamelCase(response.packages)
    },
    enabled: !!selectedDevice?.id,
    gcTime: 1000 * 60 * 5, // 5 minutes
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 1,
  })
}
