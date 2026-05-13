import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '../../../test-utils/render'
import AppHeader from '../AppHeader'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  globalThis.window.api = {
    getIOSPackages: vi.fn(),
    getIOsDevicePackages: vi.fn(),
    getAndroidPackages: vi.fn(),
    getAndroidDatabaseFiles: vi.fn(),
    getIOSDeviceDatabaseFiles: vi.fn(),
    getIOSSimulatorDatabaseFiles: vi.fn(),
  } as any
})

const mockRefreshDevices = vi.fn()
const mockSetSelectedDevice = vi.fn()
const mockSetSelectedApplication = vi.fn()
const mockSetSelectedDatabaseFile = vi.fn()
const mockSetSelectedDatabaseTable = vi.fn()
const mockAddRecentApp = vi.fn()
const mockGetRecentAppsForDevice = vi.fn()

let mockDevicesHook: any
let mockApplicationsHook: any
let mockSelectedDevice: any
let mockSelectedApplication: any
let mockSelectedDatabaseFile: any

vi.mock('@renderer/hooks/useDevices', () => ({
  useDevices: () => mockDevicesHook,
}))

vi.mock('@renderer/hooks/useApplications', () => ({
  fetchApplicationsForDevice: async (device) => {
    const response = await globalThis.window.api.getAndroidPackages(device.id)
    return response.packages
  },
  useApplications: () => mockApplicationsHook,
}))

vi.mock('@renderer/hooks/useDatabaseFiles', () => ({
  fetchDatabaseFilesForSelection: async (device, app) => {
    const response = await globalThis.window.api.getAndroidDatabaseFiles(device.id, app.bundleId)
    return response.files
  },
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue('/path/to/tool'),
}))

vi.mock('@renderer/store', () => ({
  useCurrentDeviceSelection: (selector) => {
    const state = {
      selectedDevice: mockSelectedDevice,
      setSelectedDevice: mockSetSelectedDevice,
      selectedApplication: mockSelectedApplication,
      setSelectedApplication: mockSetSelectedApplication,
      devicesList: [],
      setDevicesList: vi.fn(),
      applicationsList: [],
      setApplicationsList: vi.fn(),
    }
    return selector(state)
  },
  useCurrentDatabaseSelection: (selector) => {
    const state = {
      selectedDatabaseFile: mockSelectedDatabaseFile,
      setSelectedDatabaseFile: mockSetSelectedDatabaseFile,
      selectedDatabaseTable: null,
      setSelectedDatabaseTable: mockSetSelectedDatabaseTable,
      pulledDatabaseFilePath: '',
      setPulledDatabaseFilePath: vi.fn(),
    }
    return selector(state)
  },
  useRecentlyUsedApps: () => ({
    addRecentApp: mockAddRecentApp,
    getRecentAppsForDevice: mockGetRecentAppsForDevice,
  }),
}))

vi.mock('@renderer/ui/toaster', () => ({
  toaster: {
    create: vi.fn(),
  },
}))

describe('appHeader component', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockSelectedDevice = null
    mockSelectedApplication = null
    mockSelectedDatabaseFile = null

    mockGetRecentAppsForDevice.mockReturnValue([])
    vi.mocked(globalThis.window.api.getAndroidPackages).mockResolvedValue({
      success: true,
      packages: [{ name: 'Test App 1', bundleId: 'com.test.app1' }],
    })
    vi.mocked(globalThis.window.api.getAndroidDatabaseFiles).mockResolvedValue({
      success: true,
      files: [{ path: '/tmp/test.db', filename: 'test.db', deviceType: 'android' }],
    })

    mockRefreshDevices.mockResolvedValue({
      data: [
        { id: 'device1', name: 'Test Device 1', deviceType: 'android', label: 'Android Device' },
        { id: 'device2', name: 'Test Device 2', deviceType: 'iphone', label: 'iPhone Device' },
      ],
    })

    mockDevicesHook = {
      data: [
        { id: 'device1', name: 'Test Device 1', deviceType: 'android', label: 'Android Device' },
        { id: 'device2', name: 'Test Device 2', deviceType: 'iphone', label: 'iPhone Device' },
      ],
      error: null,
      refetch: mockRefreshDevices,
      isFetching: false,
      isPending: false,
      isFetched: true,
    }

    mockApplicationsHook = {
      data: [
        { name: 'Test App 1', bundleId: 'com.test.app1' },
        { name: 'Test App 2', bundleId: 'com.test.app2' },
      ],
      isLoading: false,
      error: null,
      isError: false,
    }
  })

  it('renders selectors', () => {
    render(<AppHeader />)

    expect(screen.getByText('Select Device')).toBeInTheDocument()
    expect(screen.getByText('Select App')).toBeInTheDocument()
  })

  it('keeps device select disabled during initial sync', () => {
    mockDevicesHook = {
      ...mockDevicesHook,
      data: [],
      isPending: true,
      isFetched: false,
    }

    render(<AppHeader />)

    expect(document.querySelector('input[disabled]')).not.toBeNull()
  })

  it('refreshes devices on refresh click', async () => {
    render(<AppHeader />)

    fireEvent.click(screen.getByTestId('refresh-devices'))

    await waitFor(() => {
      expect(mockRefreshDevices).toHaveBeenCalledTimes(1)
    })
  })

  it('refetches apps and preserves matching selection on refresh', async () => {
    mockSelectedDevice = { id: 'device1', name: 'Old Device', deviceType: 'android', label: 'Old Device' }
    mockSelectedApplication = { name: 'Old App', bundleId: 'com.test.app1' }
    mockSelectedDatabaseFile = { path: '/tmp/test.db', deviceType: 'android' }

    render(<AppHeader />)

    fireEvent.click(screen.getByTestId('refresh-devices'))

    await waitFor(() => {
      expect(globalThis.window.api.getAndroidPackages).toHaveBeenCalledWith('device1')
    })

    expect(globalThis.window.api.getAndroidDatabaseFiles).toHaveBeenCalledWith('device1', 'com.test.app1')

    expect(mockSetSelectedDevice).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'device1' }),
    )
    expect(mockSetSelectedApplication).toHaveBeenCalledWith(
      expect.objectContaining({ bundleId: 'com.test.app1' }),
    )
    expect(mockSetSelectedDatabaseFile).not.toHaveBeenCalledWith(null)
  })

  it('clears downstream selection when refreshed app is missing', async () => {
    mockSelectedDevice = { id: 'device1', name: 'Old Device', deviceType: 'android', label: 'Old Device' }
    mockSelectedApplication = { name: 'Old App', bundleId: 'com.missing.app' }
    mockSelectedDatabaseFile = { path: '/tmp/test.db', deviceType: 'android' }
    vi.mocked(globalThis.window.api.getAndroidPackages).mockResolvedValue({
      success: true,
      packages: [{ name: 'Test App 1', bundleId: 'com.test.app1' }],
    })

    render(<AppHeader />)

    fireEvent.click(screen.getByTestId('refresh-devices'))

    await waitFor(() => {
      expect(globalThis.window.api.getAndroidPackages).toHaveBeenCalledWith('device1')
    })

    expect(mockSetSelectedApplication).toHaveBeenCalledWith(null)
    expect(mockSetSelectedDatabaseFile).toHaveBeenCalledWith(null)
    expect(mockSetSelectedDatabaseTable).toHaveBeenCalledWith(null)
  })

  it('clears DB selection when refreshed DB file is missing', async () => {
    mockSelectedDevice = { id: 'device1', name: 'Old Device', deviceType: 'android', label: 'Old Device' }
    mockSelectedApplication = { name: 'Old App', bundleId: 'com.test.app1' }
    mockSelectedDatabaseFile = { path: '/tmp/missing.db', deviceType: 'android' }
    vi.mocked(globalThis.window.api.getAndroidDatabaseFiles).mockResolvedValue({
      success: true,
      files: [{ path: '/tmp/test.db', filename: 'test.db', deviceType: 'android' }],
    })

    render(<AppHeader />)

    fireEvent.click(screen.getByTestId('refresh-devices'))

    await waitFor(() => {
      expect(globalThis.window.api.getAndroidDatabaseFiles).toHaveBeenCalledWith('device1', 'com.test.app1')
    })

    expect(mockSetSelectedDatabaseFile).toHaveBeenCalledWith(null)
    expect(mockSetSelectedDatabaseTable).toHaveBeenCalledWith(null)
  })
})
