import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '../../../test-utils/render'
import AppHeader from '../AppHeader'

vi.mock('../../common/FLSelect', () => ({
  default: ({ label, options = [], value, onChange, isDisabled }: any) => (
    <div data-testid={`select-${label}`} data-disabled={isDisabled ? 'true' : 'false'}>
      <span>{label}</span>
      <span data-testid={`value-${label}`}>{value?.label ?? value?.name ?? 'None'}</span>
      {options.map((option: any) => (
        <button
          key={`${label}-${option.value ?? option.id ?? option.bundleId}`}
          type="button"
          data-testid={`${label}-${option.value ?? option.id ?? option.bundleId}`}
          disabled={isDisabled}
          onClick={() => onChange(option)}
        >
          {option.label ?? option.name}
        </button>
      ))}
    </div>
  ),
}))

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
    cancelIOSDeviceDatabaseScan: vi.fn(),
    getIOSSimulatorDatabaseFiles: vi.fn(),
  } as any
})

const mockRefreshDevices = vi.fn()
const mockSetSelectedDevice = vi.fn()
const mockSetSelectedApplication = vi.fn()
const mockSetSelectedDatabaseFile = vi.fn()
const mockSetSelectedDatabaseTable = vi.fn()
const mockClearTableData = vi.fn()
const mockSetSelectedRow = vi.fn()
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
  useTableData: (selector) => {
    const state = {
      clearTableData: mockClearTableData,
    }
    return selector(state)
  },
}))

vi.mock('@renderer/store/useRowEditingStore', () => ({
  useRowEditingStore: (selector) => {
    const state = {
      setSelectedRow: mockSetSelectedRow,
    }
    return selector(state)
  },
}))

vi.mock('@renderer/ui/toaster', () => ({
  toaster: {
    create: vi.fn(),
  },
}))

function SelectionSnapshot() {
  return (
    <div>
      <span data-testid="snapshot-device">{mockSelectedDevice?.label ?? mockSelectedDevice?.name ?? 'None'}</span>
      <span data-testid="snapshot-app">{mockSelectedApplication?.name ?? 'None'}</span>
      <span data-testid="snapshot-db">{mockSelectedDatabaseFile?.path ?? 'None'}</span>
    </div>
  )
}

describe('appHeader component', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockSelectedDevice = null
    mockSelectedApplication = null
    mockSelectedDatabaseFile = null

    mockSetSelectedDevice.mockImplementation((value) => {
      mockSelectedDevice = value
    })
    mockSetSelectedApplication.mockImplementation((value) => {
      mockSelectedApplication = value
    })
    mockSetSelectedDatabaseFile.mockImplementation((value) => {
      mockSelectedDatabaseFile = value
    })
    mockSetSelectedDatabaseTable.mockImplementation(() => {})

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
      isPending: true,
      isFetched: false,
    }

    render(<AppHeader />)

    expect(screen.getByTestId('select-Select Device')).toHaveAttribute('data-disabled', 'true')
    expect(screen.getByTestId('Select Device-device1')).toBeDisabled()
    expect(screen.getByTestId('Select Device-device2')).toBeDisabled()
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

    const view = render(
      <>
        <AppHeader />
        <SelectionSnapshot />
      </>,
    )

    fireEvent.click(screen.getByTestId('refresh-devices'))

    await waitFor(() => {
      expect(globalThis.window.api.getAndroidPackages).toHaveBeenCalledWith('device1')
    })

    await waitFor(() => {
      expect(globalThis.window.api.getAndroidDatabaseFiles).toHaveBeenCalledWith('device1', 'com.test.app1')
    })

    view.rerender(
      <>
        <AppHeader />
        <SelectionSnapshot />
      </>,
    )

    expect(screen.getByTestId('value-Select Device')).toHaveTextContent('Android Device')
    expect(screen.getByTestId('value-Select App')).toHaveTextContent('Test App 1')
    expect(screen.getByTestId('snapshot-device')).toHaveTextContent('Android Device')
    expect(screen.getByTestId('snapshot-app')).toHaveTextContent('Test App 1')
    expect(screen.getByTestId('snapshot-db')).toHaveTextContent('/tmp/test.db')
  })

  it('clears downstream selection when refreshed app is missing', async () => {
    mockSelectedDevice = { id: 'device1', name: 'Old Device', deviceType: 'android', label: 'Old Device' }
    mockSelectedApplication = { name: 'Old App', bundleId: 'com.missing.app' }
    mockSelectedDatabaseFile = { path: '/tmp/test.db', deviceType: 'android' }
    vi.mocked(globalThis.window.api.getAndroidPackages).mockResolvedValue({
      success: true,
      packages: [{ name: 'Test App 1', bundleId: 'com.test.app1' }],
    })

    const view = render(
      <>
        <AppHeader />
        <SelectionSnapshot />
      </>,
    )

    fireEvent.click(screen.getByTestId('refresh-devices'))

    await waitFor(() => {
      expect(globalThis.window.api.getAndroidPackages).toHaveBeenCalledWith('device1')
    })

    view.rerender(
      <>
        <AppHeader />
        <SelectionSnapshot />
      </>,
    )

    expect(screen.getByTestId('value-Select Device')).toHaveTextContent('Android Device')
    expect(screen.getByTestId('value-Select App')).toHaveTextContent('None')
    expect(screen.getByTestId('snapshot-app')).toHaveTextContent('None')
    expect(screen.getByTestId('snapshot-db')).toHaveTextContent('None')
  })

  it('clears DB selection when refreshed DB file is missing', async () => {
    mockSelectedDevice = { id: 'device1', name: 'Old Device', deviceType: 'android', label: 'Old Device' }
    mockSelectedApplication = { name: 'Old App', bundleId: 'com.test.app1' }
    mockSelectedDatabaseFile = { path: '/tmp/missing.db', deviceType: 'android' }
    vi.mocked(globalThis.window.api.getAndroidDatabaseFiles).mockResolvedValue({
      success: true,
      files: [{ path: '/tmp/test.db', filename: 'test.db', deviceType: 'android' }],
    })

    const view = render(
      <>
        <AppHeader />
        <SelectionSnapshot />
      </>,
    )

    fireEvent.click(screen.getByTestId('refresh-devices'))

    await waitFor(() => {
      expect(globalThis.window.api.getAndroidDatabaseFiles).toHaveBeenCalledWith('device1', 'com.test.app1')
    })

    view.rerender(
      <>
        <AppHeader />
        <SelectionSnapshot />
      </>,
    )

    expect(screen.getByTestId('value-Select Device')).toHaveTextContent('Android Device')
    expect(screen.getByTestId('value-Select App')).toHaveTextContent('Test App 1')
    expect(screen.getByTestId('snapshot-app')).toHaveTextContent('Test App 1')
    expect(screen.getByTestId('snapshot-db')).toHaveTextContent('None')
  })

  it('selecting a device resets the app step and enables app selection for the new device', () => {
    mockSelectedApplication = { name: 'Stale App', bundleId: 'com.test.stale' }
    const view = render(<AppHeader />)

    fireEvent.click(screen.getByTestId('Select Device-device1'))

    view.rerender(<AppHeader />)

    expect(screen.getByTestId('value-Select Device')).toHaveTextContent('Android Device')
    expect(screen.getByTestId('value-Select App')).toHaveTextContent('None')
    expect(screen.getByTestId('select-Select App')).toHaveAttribute('data-disabled', 'false')
    expect(mockClearTableData).toHaveBeenCalled()
  })

  it('selecting an app updates the visible app selection and records the recent app for the chosen device', () => {
    mockSelectedDevice = { id: 'device1', name: 'Test Device 1', deviceType: 'android', label: 'Android Device' }
    const view = render(<AppHeader />)

    fireEvent.click(screen.getByTestId('Select App-com.test.app1'))
    view.rerender(<AppHeader />)

    expect(screen.getByTestId('value-Select App')).toHaveTextContent('Test App 1')
    expect(mockClearTableData).toHaveBeenCalledTimes(1)
    expect(mockAddRecentApp).toHaveBeenCalledWith(
      expect.objectContaining({ bundleId: 'com.test.app1', name: 'Test App 1' }),
      'device1',
      'Test Device 1',
    )
  })
})
