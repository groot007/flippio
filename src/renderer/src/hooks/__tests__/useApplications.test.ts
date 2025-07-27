import type { ReactNode } from 'react'
import type { Device } from '../useApplications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useApplications } from '../useApplications'

// Create a test wrapper for React Query
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  })
  
  return function TestWrapper({ children }: { children: ReactNode }) {
    return QueryClientProvider({ client: queryClient, children })
  }
}

beforeAll(() => {
  // Mock window.api
  globalThis.window.api = {
    getIOSPackages: vi.fn(),
    getIOsDevicePackages: vi.fn(),
    getAndroidPackages: vi.fn(),
  } as any
})

describe('useApplications hook', () => {
  let mockIOSPackages: any
  let mockIOsDevicePackages: any
  let mockAndroidPackages: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockIOSPackages = vi.mocked(globalThis.window.api.getIOSPackages)
    mockIOsDevicePackages = vi.mocked(globalThis.window.api.getIOsDevicePackages)
    mockAndroidPackages = vi.mocked(globalThis.window.api.getAndroidPackages)
  })

  it('should not make API call when no device is selected', () => {
    const { result } = renderHook(() => useApplications(null), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(mockIOSPackages).not.toHaveBeenCalled()
    expect(mockIOsDevicePackages).not.toHaveBeenCalled()
    expect(mockAndroidPackages).not.toHaveBeenCalled()
  })

  it('should use getIOSPackages for iPhone simulator', async () => {
    const device: Device = {
      id: 'sim-123',
      model: 'iPhone 15',
      deviceType: 'iphone',
    }

    const mockResponse = {
      success: true,
      packages: [
        { name: 'Test App', bundle_id: 'com.test.app' },
        { name: 'Another App', bundle_id: 'com.another.app' },
      ],
    }

    mockIOSPackages.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useApplications(device), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockIOSPackages).toHaveBeenCalledWith('sim-123')
    expect(result.current.data).toEqual([
      { name: 'Test App', bundleId: 'com.test.app' },
      { name: 'Another App', bundleId: 'com.another.app' },
    ])
  })

  it('should use getIOSPackages for simulator device type', async () => {
    const device: Device = {
      id: 'sim-456',
      model: 'iPhone 15 Pro',
      deviceType: 'simulator',
    }

    const mockResponse = {
      success: true,
      packages: [{ name: 'Simulator App', bundle_id: 'com.simulator.app' }],
    }

    mockIOSPackages.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useApplications(device), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockIOSPackages).toHaveBeenCalledWith('sim-456')
    expect(result.current.data).toEqual([
      { name: 'Simulator App', bundleId: 'com.simulator.app' },
    ])
  })

  it('should use getIOsDevicePackages for physical iPhone device', async () => {
    const device: Device = {
      id: 'device-789',
      model: 'iPhone 14',
      deviceType: 'iphone-device',
    }

    const mockResponse = {
      success: true,
      packages: [{ name: 'Device App', bundle_id: 'com.device.app' }],
    }

    mockIOsDevicePackages.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useApplications(device), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockIOsDevicePackages).toHaveBeenCalledWith('device-789')
    expect(result.current.data).toEqual([
      { name: 'Device App', bundleId: 'com.device.app' },
    ])
  })

  it('should use getAndroidPackages for Android devices', async () => {
    const device: Device = {
      id: 'android-123',
      model: 'Pixel 7',
      deviceType: 'android',
    }

    const mockResponse = {
      success: true,
      packages: [
        { name: 'Android App', bundle_id: 'com.android.app' },
        { name: 'Google App', bundle_id: 'com.google.app' },
      ],
    }

    mockAndroidPackages.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useApplications(device), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockAndroidPackages).toHaveBeenCalledWith('android-123')
    expect(result.current.data).toEqual([
      { name: 'Android App', bundleId: 'com.android.app' },
      { name: 'Google App', bundleId: 'com.google.app' },
    ])
  })

  it('should use getAndroidPackages for emulator devices', async () => {
    const device: Device = {
      id: 'emulator-456',
      model: 'Android Emulator',
      deviceType: 'emulator',
    }

    const mockResponse = {
      success: true,
      packages: [{ name: 'Emulator App', bundle_id: 'com.emulator.app' }],
    }

    mockAndroidPackages.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useApplications(device), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockAndroidPackages).toHaveBeenCalledWith('emulator-456')
    expect(result.current.data).toEqual([
      { name: 'Emulator App', bundleId: 'com.emulator.app' },
    ])
  })

  it('should handle API errors gracefully', async () => {
    const device: Device = {
      id: 'error-device',
      model: 'Error Device',
      deviceType: 'android',
    }

    mockAndroidPackages.mockResolvedValue({
      success: false,
      error: 'Failed to connect to device',
      packages: [],
    })

    const { result } = renderHook(() => useApplications(device), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    }, { timeout: 3000 })

    expect(result.current.error).toBeInstanceOf(Error)
    expect((result.current.error as Error).message).toBe('Failed to connect to device')
  })

  it('should handle API errors without error message', async () => {
    const device: Device = {
      id: 'error-device-2',
      model: 'Error Device 2',
      deviceType: 'iphone',
    }

    mockIOSPackages.mockResolvedValue({
      success: false,
      packages: [],
    })

    const { result } = renderHook(() => useApplications(device), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    }, { timeout: 3000 })

    expect(result.current.error).toBeInstanceOf(Error)
    expect((result.current.error as Error).message).toBe('Failed to load apps for Error Device 2')
  })

  it('should handle device without ID', () => {
    const device: Device = {
      id: '',
      model: 'No ID Device',
      deviceType: 'android',
    }

    const { result } = renderHook(() => useApplications(device), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(mockAndroidPackages).not.toHaveBeenCalled()
  })

  it('should refetch when device changes', async () => {
    const device1: Device = {
      id: 'device-1',
      model: 'Device 1',
      deviceType: 'android',
    }

    const device2: Device = {
      id: 'device-2',
      model: 'Device 2',
      deviceType: 'iphone',
    }

    mockAndroidPackages.mockResolvedValue({
      success: true,
      packages: [{ name: 'Android App', bundle_id: 'com.android.app' }],
    })

    mockIOSPackages.mockResolvedValue({
      success: true,
      packages: [{ name: 'iOS App', bundle_id: 'com.ios.app' }],
    })

    const { result, rerender } = renderHook(
      ({ device }) => useApplications(device),
      {
        wrapper: createWrapper(),
        initialProps: { device: device1 },
      },
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockAndroidPackages).toHaveBeenCalledWith('device-1')
    expect(result.current.data).toEqual([
      { name: 'Android App', bundleId: 'com.android.app' },
    ])

    // Change device
    rerender({ device: device2 })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockIOSPackages).toHaveBeenCalledWith('device-2')
    expect(result.current.data).toEqual([
      { name: 'iOS App', bundleId: 'com.ios.app' },
    ])
  })

  it('should handle empty packages response', async () => {
    const device: Device = {
      id: 'empty-device',
      model: 'Empty Device',
      deviceType: 'android',
    }

    mockAndroidPackages.mockResolvedValue({
      success: true,
      packages: [],
    })

    const { result } = renderHook(() => useApplications(device), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual([])
  })
}) 
