import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '../../test-utils/render'
import AppHeader from '../AppHeader'

beforeEach(() => {
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

vi.mock('@renderer/hooks/useDevices', () => ({
  useDevices: () => ({
    devices: [
      { id: 'device1', model: 'Test Device 1', deviceType: 'android' },
      { id: 'device2', model: 'Test Device 2', deviceType: 'iphone' },
    ],
    isLoading: false,
    error: null,
    refresh: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@renderer/hooks/useApplications', () => ({
  useApplications: () => ({
    applications: [
      { name: 'Test App 1', bundleId: 'com.test.app1' },
      { name: 'Test App 2', bundleId: 'com.test.app2' },
    ],
    isLoading: false,
    error: null,
  }),
}))

vi.mock('@renderer/store', () => ({
  useCurrentDeviceSelection: (selector) => {
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
  useCurrentDatabaseSelection: (selector) => {
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
}))

vi.mock('@renderer/ui/toaster', () => ({
  toaster: {
    create: vi.fn(),
  },
}))

describe('appHeader Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders correctly with device and application selectors', () => {
    render(
      <AppHeader />,
    )

    expect(screen.getByText('Select Device')).toBeInTheDocument()
    expect(screen.getByText('Select App')).toBeInTheDocument()
  })

  it('has a working refresh button', async () => {
    render(
      <AppHeader />,
    )

    const refreshButton = screen.getByTestId('refresh-devices')
    expect(refreshButton).toBeInTheDocument()

    fireEvent.click(refreshButton)

    expect(refreshButton).toBeInTheDocument()
  })
})
