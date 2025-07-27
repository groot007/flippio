import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCurrentDeviceSelection } from '../useCurrentDeviceSelection'

describe('useCurrentDeviceSelection store', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useCurrentDeviceSelection())
    act(() => {
      result.current.setSelectedDevice(null)
      result.current.setSelectedApplication(null)
      result.current.setDevicesList([])
      result.current.setApplicationsList([])
    })
  })

  it('initializes with null selectedDevice and selectedApplication', () => {
    const { result } = renderHook(() => useCurrentDeviceSelection())

    expect(result.current.selectedDevice).toBeNull()
    expect(result.current.selectedApplication).toBeNull()
    expect(result.current.devicesList).toEqual([])
    expect(result.current.applicationsList).toEqual([])
  })

  it('updates selectedDevice correctly', () => {
    const { result } = renderHook(() => useCurrentDeviceSelection())
    
    const testDevice = {
      id: 'device-123',
      name: 'Test Device',
      model: 'Test Model',
      deviceType: 'android' as const,
    }

    act(() => {
      result.current.setSelectedDevice(testDevice)
    })

    expect(result.current.selectedDevice).toEqual(testDevice)
  })

  it('updates selectedApplication correctly', () => {
    const { result } = renderHook(() => useCurrentDeviceSelection())
    
    const testApplication = {
      bundleId: 'com.test.app',
      name: 'Test App',
    }

    act(() => {
      result.current.setSelectedApplication(testApplication)
    })

    expect(result.current.selectedApplication).toEqual(testApplication)
  })

  it('updates devicesList correctly', () => {
    const { result } = renderHook(() => useCurrentDeviceSelection())
    
    const testDevices = [
      {
        id: 'device-1',
        name: 'Device 1',
        model: 'Model 1',
        deviceType: 'android' as const,
      },
      {
        id: 'device-2',
        name: 'Device 2',
        model: 'Model 2',
        deviceType: 'iphone' as const,
      },
    ]

    act(() => {
      result.current.setDevicesList(testDevices)
    })

    expect(result.current.devicesList).toEqual(testDevices)
  })

  it('updates applicationsList correctly', () => {
    const { result } = renderHook(() => useCurrentDeviceSelection())
    
    const testApplications = [
      { bundleId: 'com.app1', name: 'App 1' },
      { bundleId: 'com.app2', name: 'App 2' },
    ]

    act(() => {
      result.current.setApplicationsList(testApplications)
    })

    expect(result.current.applicationsList).toEqual(testApplications)
  })

  it('can clear selectedDevice by setting to null', () => {
    const { result } = renderHook(() => useCurrentDeviceSelection())
    
    const testDevice = {
      id: 'device-123',
      name: 'Test Device',
      model: 'Test Model',
      deviceType: 'android' as const,
    }

    act(() => {
      result.current.setSelectedDevice(testDevice)
    })

    expect(result.current.selectedDevice).toEqual(testDevice)

    act(() => {
      result.current.setSelectedDevice(null)
    })

    expect(result.current.selectedDevice).toBeNull()
  })

  it('can clear selectedApplication by setting to null', () => {
    const { result } = renderHook(() => useCurrentDeviceSelection())
    
    const testApplication = {
      bundleId: 'com.test.app',
      name: 'Test App',
    }

    act(() => {
      result.current.setSelectedApplication(testApplication)
    })

    expect(result.current.selectedApplication).toEqual(testApplication)

    act(() => {
      result.current.setSelectedApplication(null)
    })

    expect(result.current.selectedApplication).toBeNull()
  })

  it('maintains state across multiple hook calls', () => {
    const testDevice = {
      id: 'device-123',
      name: 'Test Device',
      model: 'Test Model',
      deviceType: 'android' as const,
    }

    // First hook instance
    const { result: result1 } = renderHook(() => useCurrentDeviceSelection())
    
    act(() => {
      result1.current.setSelectedDevice(testDevice)
    })

    // Second hook instance should have the same state
    const { result: result2 } = renderHook(() => useCurrentDeviceSelection())
    
    expect(result2.current.selectedDevice).toEqual(testDevice)
  })

  it('handles multiple state updates correctly', () => {
    const { result } = renderHook(() => useCurrentDeviceSelection())
    
    const device1 = {
      id: 'device-1',
      name: 'Device 1',
      model: 'Model 1',
      deviceType: 'android' as const,
    }
    
    const device2 = {
      id: 'device-2',
      name: 'Device 2',
      model: 'Model 2',
      deviceType: 'iphone' as const,
    }

    const app1 = { bundleId: 'com.app1', name: 'App 1' }
    const app2 = { bundleId: 'com.app2', name: 'App 2' }

    act(() => {
      result.current.setSelectedDevice(device1)
      result.current.setSelectedApplication(app1)
    })

    expect(result.current.selectedDevice).toEqual(device1)
    expect(result.current.selectedApplication).toEqual(app1)

    act(() => {
      result.current.setSelectedDevice(device2)
      result.current.setSelectedApplication(app2)
    })

    expect(result.current.selectedDevice).toEqual(device2)
    expect(result.current.selectedApplication).toEqual(app2)
  })

  it('supports different device types', () => {
    const { result } = renderHook(() => useCurrentDeviceSelection())
    
    const androidDevice = {
      id: 'android-1',
      name: 'Android Device',
      model: 'Pixel 7',
      deviceType: 'android' as const,
    }

    const iosDevice = {
      id: 'ios-1',
      name: 'iOS Device',
      model: 'iPhone 15',
      deviceType: 'iphone' as const,
    }

    const simulatorDevice = {
      id: 'sim-1',
      name: 'iOS Simulator',
      model: 'iPhone 15 Simulator',
      deviceType: 'simulator' as const,
    }

    const emulatorDevice = {
      id: 'emu-1',
      name: 'Android Emulator',
      model: 'Android Emulator',
      deviceType: 'emulator' as const,
    }

    // Test each device type
    act(() => {
      result.current.setSelectedDevice(androidDevice)
    })
    expect(result.current.selectedDevice).toEqual(androidDevice)

    act(() => {
      result.current.setSelectedDevice(iosDevice)
    })
    expect(result.current.selectedDevice).toEqual(iosDevice)

    act(() => {
      result.current.setSelectedDevice(simulatorDevice)
    })
    expect(result.current.selectedDevice).toEqual(simulatorDevice)

    act(() => {
      result.current.setSelectedDevice(emulatorDevice)
    })
    expect(result.current.selectedDevice).toEqual(emulatorDevice)
  })

  it('can clear lists by setting to empty array', () => {
    const { result } = renderHook(() => useCurrentDeviceSelection())
    
    const testDevices = [
      { id: 'device-1', name: 'Device 1', model: 'Model 1', deviceType: 'android' as const },
    ]
    const testApps = [
      { bundleId: 'com.app1', name: 'App 1' },
    ]

    act(() => {
      result.current.setDevicesList(testDevices)
      result.current.setApplicationsList(testApps)
    })

    expect(result.current.devicesList).toEqual(testDevices)
    expect(result.current.applicationsList).toEqual(testApps)

    act(() => {
      result.current.setDevicesList([])
      result.current.setApplicationsList([])
    })

    expect(result.current.devicesList).toEqual([])
    expect(result.current.applicationsList).toEqual([])
  })
}) 
