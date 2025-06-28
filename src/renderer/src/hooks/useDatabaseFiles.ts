import type { DatabaseFile } from '@renderer/types'
import { transformToCamelCase } from '@renderer/utils/caseTransformer'
import { useQuery } from '@tanstack/react-query'

interface Device {
  id: string
  deviceType: 'iphone' | 'android' | 'desktop' | 'iphone-device'
}

interface Application {
  bundleId: string
  name: string
}

interface DatabaseFilesResponse {
  success: boolean
  files: DatabaseFile[]
  error?: string
}

export function useDatabaseFiles(
  selectedDevice: Device | null,
  selectedApplication: Application | null,
) {
  return useQuery({
    queryKey: ['databaseFiles', selectedDevice?.id, selectedApplication?.bundleId],
    queryFn: async () => {
      console.log('Fetching database files for device:', selectedDevice, 'and application:', selectedApplication)
      if (!selectedDevice?.id || !selectedApplication?.bundleId) {
        throw new Error('Device or application not selected')
      }

      console.log('Selected device:', selectedDevice)

      let fetchFunction: (deviceId: string, bundleId: string) => Promise<DatabaseFilesResponse>

      if (selectedDevice.deviceType === 'iphone') {
        fetchFunction = window.api.getIOSDatabaseFiles
      }
      else if (selectedDevice.deviceType === 'iphone-device') {
        fetchFunction = window.api.getIOSDeviceDatabaseFiles
      }
      else {
        fetchFunction = window.api.getAndroidDatabaseFiles
      }

      const response = await fetchFunction(selectedDevice.id, selectedApplication.bundleId)

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch database files')
      }

      return transformToCamelCase(response.files)
    },
    enabled: !!selectedDevice?.id && !!selectedApplication?.bundleId,
    gcTime: 0,
    staleTime: 0,
    retry: 1,
  })
}
