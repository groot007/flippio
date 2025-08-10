/**
 * Query key factories for device-related queries
 * Provides consistent query keys and type safety for React Query
 */
export const deviceQueryKeys = {
  all: ['devices'] as const,
  lists: () => [...deviceQueryKeys.all, 'list'] as const,
  list: (platform?: string) => [...deviceQueryKeys.lists(), platform] as const,
  details: () => [...deviceQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...deviceQueryKeys.details(), id] as const,
  applications: (deviceId: string) => [...deviceQueryKeys.detail(deviceId), 'applications'] as const,
} as const

export type DeviceQueryKeys = typeof deviceQueryKeys
