import type { DatabaseFile } from '@renderer/types'
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
      if (!selectedDevice?.id || !selectedApplication?.bundleId) {
        throw new Error('Device or application not selected')
      }

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

      return response.files
    },
    enabled: !!selectedDevice?.id && !!selectedApplication?.bundleId,
    gcTime: 1000 * 60 * 5, // 5 minutes cache retention
    staleTime: 1000 * 60, // 1 minute before refetch
    retry: 1,
  })
}
