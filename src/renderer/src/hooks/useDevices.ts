import { useQuery } from '@tanstack/react-query'

export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const response = await window.api.getDevices()
      if (!response.success) {
        throw new Error(response.error || 'Failed to load devices')
      }
      return response.devices
    },
    retry: 1,
    staleTime: 1000 * 60 * 5,
  })
}
