import { transformToCamelCase } from '@renderer/utils/caseTransformer'
import { useQuery } from '@tanstack/react-query'

export async function fetchDevices() {
  const response = await window.api.getDevices()
  if (!response.success) {
    throw new Error(response.error || 'Failed to load devices')
  }

  return transformToCamelCase(response.devices)
}

export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: fetchDevices,
    retry: 1,
    staleTime: 1000 * 60 * 5,
  })
}
