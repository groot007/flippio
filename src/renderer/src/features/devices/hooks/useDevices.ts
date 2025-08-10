/**
 * Device Management Hooks
 * 
 * Custom React hooks for device operations with clean abstractions
 * over the device service layer.
 */

import type { VirtualDevice } from '../types.js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { deviceService } from '../services/deviceService.js'
import { deviceQueryKeys } from './queryKeys.js'

/**
 * Additional device query keys for virtual devices
 */
const virtualDeviceQueryKeys = {
  androidEmulators: () => [...deviceQueryKeys.all, 'android-emulators'] as const,
  iosSimulators: () => [...deviceQueryKeys.all, 'ios-simulators'] as const,
} as const

/**
 * Hook for fetching all connected devices
 * 
 * @returns Query result with device list and loading states
 */
export function useDevices() {
  return useQuery({
    queryKey: deviceQueryKeys.lists(),
    queryFn: async () => {
      const result = await deviceService.getDevices()
      if (!result.success) {
        throw new Error(result.error || 'Failed to load devices')
      }
      return result.data || []
    },
    retry: (failureCount, error) => {
      // Retry up to 2 times for network-related errors
      if (failureCount < 2 && error.message.includes('network')) {
        return true
      }
      return false
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  })
}

/**
 * Hook for fetching Android emulators
 * 
 * @returns Query result with emulator list
 */
export function useAndroidEmulators() {
  return useQuery({
    queryKey: virtualDeviceQueryKeys.androidEmulators(),
    queryFn: async () => {
      const result = await deviceService.getAndroidEmulators()
      if (!result.success) {
        throw new Error(result.error || 'Failed to load Android emulators')
      }
      return result.data || []
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
}

/**
 * Hook for fetching iOS simulators
 * 
 * @returns Query result with simulator list
 */
export function useIOSSimulators() {
  return useQuery({
    queryKey: virtualDeviceQueryKeys.iosSimulators(),
    queryFn: async () => {
      const result = await deviceService.getIOSSimulators()
      if (!result.success) {
        throw new Error(result.error || 'Failed to load iOS simulators')
      }
      return result.data || []
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
}

/**
 * Hook for refreshing device list
 * 
 * @returns Mutation for triggering device refresh
 */
export function useRefreshDevices() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => deviceService.refreshDevices(),
    onSuccess: (result) => {
      if (result.success && result.data) {
        // Update the devices cache with fresh data
        queryClient.setQueryData(deviceQueryKeys.lists(), result.data)
      }
      // Invalidate related queries to ensure consistency
      queryClient.invalidateQueries({ queryKey: deviceQueryKeys.all })
    },
    onError: (error) => {
      console.error('Failed to refresh devices:', error)
      // Invalidate queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: deviceQueryKeys.lists() })
    },
  })
}

/**
 * Hook for launching Android emulator
 * 
 * @returns Mutation for launching emulator
 */
export function useLaunchAndroidEmulator() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (emulatorName: string) => 
      deviceService.launchAndroidEmulator(emulatorName),
    onSuccess: () => {
      // Refresh device list after launching emulator
      // Delay to allow emulator to start up
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: deviceQueryKeys.lists() })
      }, 3000)
    },
  })
}

/**
 * Hook for launching iOS simulator
 * 
 * @returns Mutation for launching simulator
 */
export function useLaunchIOSSimulator() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (simulatorId: string) => 
      deviceService.launchIOSSimulator(simulatorId),
    onSuccess: () => {
      // Refresh device list after launching simulator
      // Delay to allow simulator to start up
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: deviceQueryKeys.lists() })
      }, 3000)
    },
  })
}

/**
 * Combined hook for virtual device operations
 * 
 * @returns Object with emulators, simulators, and launch functions
 */
export function useVirtualDevices() {
  const androidEmulators = useAndroidEmulators()
  const iosSimulators = useIOSSimulators()
  const launchAndroid = useLaunchAndroidEmulator()
  const launchIOS = useLaunchIOSSimulator()

  const launchVirtualDevice = useCallback((device: VirtualDevice) => {
    if (device.platform === 'android') {
      return launchAndroid.mutateAsync(device.id)
    }
    else if (device.platform === 'ios') {
      return launchIOS.mutateAsync(device.id)
    }
    else {
      return Promise.reject(new Error('Unsupported platform'))
    }
  }, [launchAndroid, launchIOS])

  return {
    androidEmulators: androidEmulators.data || [],
    iosSimulators: iosSimulators.data || [],
    isLoadingEmulators: androidEmulators.isLoading,
    isLoadingSimulators: iosSimulators.isLoading,
    launchVirtualDevice,
    isLaunching: launchAndroid.isPending || launchIOS.isPending,
  }
}
