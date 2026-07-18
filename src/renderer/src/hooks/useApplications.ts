import type { ApplicationSelection, DeviceInfo } from '@renderer/types'
import { transformToCamelCase } from '@renderer/utils/caseTransformer'
import { useQuery } from '@tanstack/react-query'

export type Device = Pick<DeviceInfo, 'deviceType' | 'id' | 'model' | 'platform'>

interface ApplicationsResponse {
  success: boolean
  packages: ApplicationSelection[]
  error?: string
}

export async function fetchApplicationsForDevice(selectedDevice: Device) {
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
    fetchFunction = window.api.getAndroidPackages
  }

  const response = await fetchFunction(selectedDevice.id)

  console.log('Applications response:', response)

  if (!response.success) {
    throw new Error(response.error || `Failed to load apps for ${selectedDevice.model}`)
  }

  return transformToCamelCase(response.packages)
}

export function useApplications(selectedDevice: Device | null) {
  return useQuery({
    queryKey: ['applications', selectedDevice?.id, selectedDevice?.deviceType],
    queryFn: () => fetchApplicationsForDevice(selectedDevice as Device),
    enabled: !!selectedDevice?.id,
    gcTime: 1000 * 60 * 5, // 5 minutes
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 1,
  })
}
