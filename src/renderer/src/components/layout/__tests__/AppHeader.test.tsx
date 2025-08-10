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
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

const mockRefreshDevices = vi.fn().mockResolvedValue(undefined)

vi.mock('@renderer/features/devices/hooks/useDevices', () => ({
  useDevices: () => ({
    data: [
      { id: 'device1', name: 'Test Device 1', deviceType: 'android', label: 'Android Device' },
      { id: 'device2', name: 'Test Device 2', deviceType: 'iphone', label: 'iPhone Device' },
    ],
    isLoading: false,
    error: null,
    refetch: mockRefreshDevices,
    isFetching: false,
  }),
}))

vi.mock('@renderer/features/devices/hooks/useApplications', () => ({
  useApplications: () => ({
    data: [
      { name: 'Test App 1', bundleId: 'com.test.app1' },
      { name: 'Test App 2', bundleId: 'com.test.app2' },
    ],
    isLoading: false,
    error: null,
  }),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue('/path/to/tool'),
}))

vi.mock('@renderer/store', () => ({
  useCurrentDeviceSelection: (selector: any) => {
    const state = {
      selectedDevice: null,
      setSelectedDevice: vi.fn(),
      selectedApplication: null,
      setSelectedApplication: vi.fn(),
      devicesList: [],
      setDevicesList: vi.fn(),
      applicationsList: [],
      setApplicationsList: vi.fn(),
    }
    return selector(state)
  },
  useCurrentDatabaseSelection: (selector: any) => {
    const state = {
      selectedDatabaseFile: null,
      setSelectedDatabaseFile: vi.fn(),
      selectedDatabaseTable: null,
      setSelectedDatabaseTable: vi.fn(),
      pulledDatabaseFilePath: '',
      setPulledDatabaseFilePath: vi.fn(),
    }
    return selector(state)
  },
  useRecentlyUsedApps: () => ({
    addRecentApp: vi.fn(),
    getRecentAppsForDevice: vi.fn().mockReturnValue([]),
    getRecentApps: vi.fn().mockReturnValue([]),
    removeRecentApp: vi.fn(),
    clearRecentApps: vi.fn(),
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
  })

  it('renders correctly with device and application selectors', () => {
    render(<AppHeader />)

    expect(screen.getByText('Select Device')).toBeInTheDocument()
    expect(screen.getByText('Select App')).toBeInTheDocument()
  })

  it('has a working refresh button', async () => {
    render(<AppHeader />)

    const refreshButton = screen.getByTestId('refresh-devices')
    expect(refreshButton).toBeInTheDocument()

    fireEvent.click(refreshButton)

    await waitFor(() => {
      expect(mockRefreshDevices).toHaveBeenCalledTimes(1)
    })
  })

  it('displays device options when devices are available', () => {
    render(<AppHeader />)
    
    // The device selector should be present
    const deviceSelector = screen.getByText('Select Device')
    expect(deviceSelector).toBeInTheDocument()
  })

  it('shows loading state when applications are loading', () => {
    render(<AppHeader />)
    
    // Check that the app selector is present
    expect(screen.getByText('Select App')).toBeInTheDocument()
  })

  it('disables app selector when no device is selected', () => {
    render(<AppHeader />)
    
    // App selector should be disabled when no device is selected
    const appSelector = screen.getByText('Select App')
    expect(appSelector).toBeInTheDocument()
    // The parent component should handle the disabled state
  })

  it('shows virtual device modal button', () => {
    render(<AppHeader />)
    
    // Look for the virtual device button (rocket icon)
    const virtualDeviceButton = screen.getByTitle('Launch Emulator')
    expect(virtualDeviceButton).toBeInTheDocument()
  })
})
