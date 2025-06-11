import { api } from '@renderer/lib/api-adapter'
import { useQuery } from '@tanstack/react-query'

export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      console.error('[useDevices] Calling api.getDevices()')
      const response = await api.getDevices()
      console.error('[useDevices] API response:', response)
      if (!response.success) {
        throw new Error(response.error || 'Failed to load devices')
      }
      console.error('[useDevices] Returning devices:', response.devices)
      return response.devices
    },
    retry: 1,
    staleTime: 1000 * 60 * 5,
  })
}
