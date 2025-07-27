import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDatabaseFiles } from '../useDatabaseFiles'

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

interface Device {
  id: string
  deviceType: 'iphone' | 'android' | 'desktop' | 'iphone-device' | 'emulator' | 'simulator'
}

interface Application {
  bundleId: string
  name: string
}

beforeAll(() => {
  // Mock window.api
  globalThis.window.api = {
    getIOSDeviceDatabaseFiles: vi.fn(),
    getIOSSimulatorDatabaseFiles: vi.fn(),
    getAndroidDatabaseFiles: vi.fn(),
  } as any
})

describe('useDatabaseFiles hook', () => {
  let mockIOSDeviceDatabaseFiles: any
  let mockIOSSimulatorDatabaseFiles: any
  let mockAndroidDatabaseFiles: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockIOSDeviceDatabaseFiles = vi.mocked(globalThis.window.api.getIOSDeviceDatabaseFiles)
    mockIOSSimulatorDatabaseFiles = vi.mocked(globalThis.window.api.getIOSSimulatorDatabaseFiles)
    mockAndroidDatabaseFiles = vi.mocked(globalThis.window.api.getAndroidDatabaseFiles)
  })

  it('should not make API call when no device is selected', () => {
    const application: Application = { bundleId: 'com.test.app', name: 'Test App' }
    
    const { result } = renderHook(() => useDatabaseFiles(null, application), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(mockIOSDeviceDatabaseFiles).not.toHaveBeenCalled()
    expect(mockIOSSimulatorDatabaseFiles).not.toHaveBeenCalled()
    expect(mockAndroidDatabaseFiles).not.toHaveBeenCalled()
  })

  it('should not make API call when no application is selected', () => {
    const device: Device = { id: 'device-123', deviceType: 'android' }
    
    const { result } = renderHook(() => useDatabaseFiles(device, null), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(mockIOSDeviceDatabaseFiles).not.toHaveBeenCalled()
    expect(mockIOSSimulatorDatabaseFiles).not.toHaveBeenCalled()
    expect(mockAndroidDatabaseFiles).not.toHaveBeenCalled()
  })

  it('should use getIOSDeviceDatabaseFiles for physical iPhone device', async () => {
    const device: Device = { id: 'device-123', deviceType: 'iphone-device' }
    const application: Application = { bundleId: 'com.test.app', name: 'Test App' }

    const mockResponse = {
      success: true,
      files: [
        { 
          filename: 'app.db',
          path: '/path/to/app.db',
          device_type: 'iphone-device',
          package_name: 'com.test.app',
          remote_path: '/var/mobile/Containers/Data/Application/app.db',
        },
      ],
    }

    mockIOSDeviceDatabaseFiles.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useDatabaseFiles(device, application), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockIOSDeviceDatabaseFiles).toHaveBeenCalledWith('device-123', 'com.test.app')
    expect(result.current.data).toEqual([
      {
        filename: 'app.db',
        path: '/path/to/app.db',
        deviceType: 'iphone-device',
        packageName: 'com.test.app',
        remotePath: '/var/mobile/Containers/Data/Application/app.db',
      },
    ])
  })

  it('should use getIOSSimulatorDatabaseFiles for simulator device', async () => {
    const device: Device = { id: 'simulator-123', deviceType: 'simulator' }
    const application: Application = { bundleId: 'com.simulator.app', name: 'Simulator App' }

    const mockResponse = {
      success: true,
      files: [
        { 
          filename: 'simulator.db',
          path: '/path/to/simulator.db',
          device_type: 'simulator',
          package_name: 'com.simulator.app',
          remote_path: '/Users/username/Library/Developer/CoreSimulator/simulator.db',
        },
      ],
    }

    mockIOSSimulatorDatabaseFiles.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useDatabaseFiles(device, application), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockIOSSimulatorDatabaseFiles).toHaveBeenCalledWith('simulator-123', 'com.simulator.app')
    expect(result.current.data).toEqual([
      {
        filename: 'simulator.db',
        path: '/path/to/simulator.db',
        deviceType: 'simulator',
        packageName: 'com.simulator.app',
        remotePath: '/Users/username/Library/Developer/CoreSimulator/simulator.db',
      },
    ])
  })

  it('should use getAndroidDatabaseFiles for Android devices', async () => {
    const device: Device = { id: 'android-123', deviceType: 'android' }
    const application: Application = { bundleId: 'com.android.app', name: 'Android App' }

    const mockResponse = {
      success: true,
      files: [
        { 
          filename: 'android.db',
          path: '/path/to/android.db',
          device_type: 'android',
          package_name: 'com.android.app',
          remote_path: '/data/data/com.android.app/databases/android.db',
        },
      ],
    }

    mockAndroidDatabaseFiles.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useDatabaseFiles(device, application), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockAndroidDatabaseFiles).toHaveBeenCalledWith('android-123', 'com.android.app')
    expect(result.current.data).toEqual([
      {
        filename: 'android.db',
        path: '/path/to/android.db',
        deviceType: 'android',
        packageName: 'com.android.app',
        remotePath: '/data/data/com.android.app/databases/android.db',
      },
    ])
  })

  it('should use getAndroidDatabaseFiles for emulator devices', async () => {
    const device: Device = { id: 'emulator-456', deviceType: 'emulator' }
    const application: Application = { bundleId: 'com.emulator.app', name: 'Emulator App' }

    const mockResponse = {
      success: true,
      files: [
        { 
          filename: 'emulator.db',
          path: '/path/to/emulator.db',
          device_type: 'emulator',
          package_name: 'com.emulator.app',
          remote_path: '/data/data/com.emulator.app/databases/emulator.db',
        },
      ],
    }

    mockAndroidDatabaseFiles.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useDatabaseFiles(device, application), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockAndroidDatabaseFiles).toHaveBeenCalledWith('emulator-456', 'com.emulator.app')
    expect(result.current.data).toEqual([
      {
        filename: 'emulator.db',
        path: '/path/to/emulator.db',
        deviceType: 'emulator',
        packageName: 'com.emulator.app',
        remotePath: '/data/data/com.emulator.app/databases/emulator.db',
      },
    ])
  })

  it('should handle API errors gracefully', async () => {
    const device: Device = { id: 'error-device', deviceType: 'android' }
    const application: Application = { bundleId: 'com.error.app', name: 'Error App' }

    mockAndroidDatabaseFiles.mockResolvedValue({
      success: false,
      error: 'Failed to access device storage',
      files: [],
    })

    const { result } = renderHook(() => useDatabaseFiles(device, application), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    }, { timeout: 3000 })

    expect(result.current.error).toBeInstanceOf(Error)
    expect((result.current.error as Error).message).toBe('Failed to access device storage')
  })

  it('should handle API errors without error message', async () => {
    const device: Device = { id: 'error-device-2', deviceType: 'iphone-device' }
    const application: Application = { bundleId: 'com.error.app2', name: 'Error App 2' }

    mockIOSDeviceDatabaseFiles.mockResolvedValue({
      success: false,
      files: [],
    })

    const { result } = renderHook(() => useDatabaseFiles(device, application), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    }, { timeout: 3000 })

    expect(result.current.error).toBeInstanceOf(Error)
    expect((result.current.error as Error).message).toBe('Failed to fetch database files')
  })

  it('should refetch when device or application changes', async () => {
    const device1: Device = { id: 'device-1', deviceType: 'android' }
    const device2: Device = { id: 'device-2', deviceType: 'iphone-device' }
    const application1: Application = { bundleId: 'com.app1', name: 'App 1' }
    const application2: Application = { bundleId: 'com.app2', name: 'App 2' }

    mockAndroidDatabaseFiles.mockResolvedValue({
      success: true,
      files: [{ filename: 'android.db', path: '/android.db', device_type: 'android', package_name: 'com.app1', remote_path: '/android.db' }],
    })

    mockIOSDeviceDatabaseFiles.mockResolvedValue({
      success: true,
      files: [{ filename: 'ios.db', path: '/ios.db', device_type: 'iphone-device', package_name: 'com.app2', remote_path: '/ios.db' }],
    })

    const { result, rerender } = renderHook(
      ({ device, application }) => useDatabaseFiles(device, application),
      {
        wrapper: createWrapper(),
        initialProps: { device: device1, application: application1 },
      },
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockAndroidDatabaseFiles).toHaveBeenCalledWith('device-1', 'com.app1')
    expect(result.current.data).toEqual([
      { filename: 'android.db', path: '/android.db', deviceType: 'android', packageName: 'com.app1', remotePath: '/android.db' },
    ])

    // Change device and application
    rerender({ device: device2, application: application2 })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockIOSDeviceDatabaseFiles).toHaveBeenCalledWith('device-2', 'com.app2')
    expect(result.current.data).toEqual([
      { filename: 'ios.db', path: '/ios.db', deviceType: 'iphone-device', packageName: 'com.app2', remotePath: '/ios.db' },
    ])
  })

  it('should handle empty files response', async () => {
    const device: Device = { id: 'empty-device', deviceType: 'android' }
    const application: Application = { bundleId: 'com.empty.app', name: 'Empty App' }

    mockAndroidDatabaseFiles.mockResolvedValue({
      success: true,
      files: [],
    })

    const { result } = renderHook(() => useDatabaseFiles(device, application), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual([])
  })

  it('should handle multiple database files', async () => {
    const device: Device = { id: 'multi-device', deviceType: 'android' }
    const application: Application = { bundleId: 'com.multi.app', name: 'Multi App' }

    const mockResponse = {
      success: true,
      files: [
        { 
          filename: 'users.db',
          path: '/path/to/users.db',
          device_type: 'android',
          package_name: 'com.multi.app',
          remote_path: '/data/data/com.multi.app/databases/users.db',
        },
        { 
          filename: 'settings.db',
          path: '/path/to/settings.db',
          device_type: 'android',
          package_name: 'com.multi.app',
          remote_path: '/data/data/com.multi.app/databases/settings.db',
        },
      ],
    }

    mockAndroidDatabaseFiles.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useDatabaseFiles(device, application), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual([
      {
        filename: 'users.db',
        path: '/path/to/users.db',
        deviceType: 'android',
        packageName: 'com.multi.app',
        remotePath: '/data/data/com.multi.app/databases/users.db',
      },
      {
        filename: 'settings.db',
        path: '/path/to/settings.db',
        deviceType: 'android',
        packageName: 'com.multi.app',
        remotePath: '/data/data/com.multi.app/databases/settings.db',
      },
    ])
  })
}) 
