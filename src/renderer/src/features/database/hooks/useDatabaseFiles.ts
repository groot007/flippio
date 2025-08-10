import type { DatabaseFile } from '@renderer/types'
import { transformToCamelCase } from '@renderer/shared/utils/caseTransformer'
import { useQuery } from '@tanstack/react-query'
import { databaseQueryKeys } from './queryKeys'

interface Device {
  id: string
  deviceType: 'iphone' | 'android' | 'desktop' | 'iphone-device' | 'emulator' | 'simulator'
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

/**
 * Hook for fetching database files from a selected device and application
 * @param selectedDevice - The device to search for database files
 * @param selectedApplication - The application to get database files from
 * @returns Query result with database files
 */
export function useDatabaseFiles(
  selectedDevice: Device | null,
  selectedApplication: Application | null,
) {
  return useQuery({
    queryKey: selectedDevice?.id && selectedApplication?.bundleId
      ? databaseQueryKeys.fileList(selectedDevice.id, selectedApplication.bundleId)
      : databaseQueryKeys.files(),
    queryFn: async () => {
      console.log('Fetching database files for device:', selectedDevice, 'and application:', selectedApplication)
      if (!selectedDevice?.id || !selectedApplication?.bundleId) {
        throw new Error('Device or application not selected')
      }

      console.log('Selected device:', selectedDevice)

      let fetchFunction: (deviceId: string, bundleId: string) => Promise<DatabaseFilesResponse>

      if (selectedDevice.deviceType === 'iphone-device') {
        fetchFunction = window.api.getIOSDeviceDatabaseFiles
      }
      else if (selectedDevice.deviceType.includes('simulator')) {
        console.log('Fetching iOS simulator database files_____')
        fetchFunction = window.api.getIOSSimulatorDatabaseFiles
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
