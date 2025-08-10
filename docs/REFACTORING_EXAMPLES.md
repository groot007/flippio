// Complete refactored examples for demonstration

// ==================== Device Service Example ====================
/**
 * Device Service - Clean API abstraction
 */
class DeviceService {
  async getDevices(): Promise<ServiceResponse<DeviceInfo[]>> {
    try {
      const response = await window.api.getDevices()
      if (!response.success) {
        return { success: false, error: response.error, data: null }
      }
      return { success: true, data: transformToCamelCase(response.devices), error: null }
    } catch (error) {
      return { success: false, error: error.message, data: null }
    }
  }
}

export const deviceService = new DeviceService()

// ==================== Custom Hook Example ====================
/**
 * Device Hook - Clean React Query integration
 */
export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const result = await deviceService.getDevices()
      if (!result.success) throw new Error(result.error)
      return result.data || []
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  })
}
