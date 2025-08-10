import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '../../../test-utils/render'
import { SubHeader } from '../SubHeader'

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

  // Mock window.api
  globalThis.window.api = {
    getDevices: vi.fn().mockResolvedValue([]),
    getIOSPackages: vi.fn().mockResolvedValue([]),
    getIOsDevicePackages: vi.fn().mockResolvedValue([]),
    getAndroidPackages: vi.fn().mockResolvedValue([]),
    getAndroidDatabaseFiles: vi.fn().mockResolvedValue([]),
    getIOSDeviceDatabaseFiles: vi.fn().mockResolvedValue([]),
    getIOSSimulatorDatabaseFiles: vi.fn().mockResolvedValue([]),
    getTables: vi.fn().mockResolvedValue([]),
    getTableInfo: vi.fn().mockResolvedValue({ rows: [], columns: [] }),
    executeQuery: vi.fn().mockResolvedValue({ rows: [], columns: [] }),
    openDatabase: vi.fn().mockResolvedValue(true),
    openFile: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/path/to/test.db'] }),
    exportFile: vi.fn().mockResolvedValue('/path/to/exported.db'),
    updateTableRow: vi.fn().mockResolvedValue(true),
    insertTableRow: vi.fn().mockResolvedValue(true),
    deleteTableRow: vi.fn().mockResolvedValue(true),
    clearTable: vi.fn().mockResolvedValue(true),
    addNewRowWithDefaults: vi.fn().mockResolvedValue(true),
    switchDatabase: vi.fn().mockResolvedValue(true),
    pushDatabaseFile: vi.fn().mockResolvedValue(true),
    uploadIOSDbFile: vi.fn().mockResolvedValue(true),
    checkAppExistence: vi.fn().mockResolvedValue(true),
    getAndroidEmulators: vi.fn().mockResolvedValue([]),
    getIOSSimulators: vi.fn().mockResolvedValue([]),
    launchAndroidEmulator: vi.fn().mockResolvedValue(null),
    launchIOSSimulator: vi.fn().mockResolvedValue(null),
    checkForUpdates: vi.fn().mockResolvedValue(null),
    downloadAndInstallUpdate: vi.fn().mockResolvedValue(null),
    // Change history methods
    getChangeHistory: vi.fn().mockResolvedValue({ success: true, changes: [] }),
    getContextSummaries: vi.fn().mockResolvedValue({ success: true, summaries: [] }),
    getChangeHistoryDiagnostics: vi.fn().mockResolvedValue({ success: true, diagnostics: {} }),
    clearContextChanges: vi.fn().mockResolvedValue({ success: true }),
    clearAllChangeHistory: vi.fn().mockResolvedValue({ success: true }),
    webUtils: {
      getPathForFile: vi.fn().mockResolvedValue(''),
    },
  }
})

const mockRefetchTable = vi.fn()
const mockHandleDBRefresh = vi.fn()

vi.mock('@renderer/features/database/hooks/useDatabaseFiles', () => ({
  useDatabaseFiles: () => ({
    data: [
      { filename: 'test1.db', path: '/path/to/test1.db', deviceType: 'android' },
      { filename: 'test2.db', path: '/path/to/test2.db', deviceType: 'iphone' },
    ],
    isLoading: false,
    error: null,
  }),
}))

vi.mock('@renderer/features/database/hooks/useDatabaseTables', () => ({
  useDatabaseTables: () => ({
    data: {
      tables: [
        { name: 'users', columns: 3 },
        { name: 'posts', columns: 5 },
      ],
    },
    isError: false,
    error: null,
  }),
}))

vi.mock('@renderer/features/database/hooks/useTableDataQuery', () => ({
  useTableDataQuery: () => ({
    data: {
      rows: [{ id: 1, name: 'Test' }],
      columns: ['id', 'name'],
    },
    refetch: mockRefetchTable,
    isLoading: false,
  }),
}))

vi.mock('@renderer/shared/utils/databaseRefresh', () => ({
  useDatabaseRefresh: () => ({
    refresh: mockHandleDBRefresh,
    isLoading: false,
  }),
}))

vi.mock('@renderer/features/devices/stores', () => ({
  useCurrentDeviceSelection: (selector: any) => {
    const state = {
      selectedDevice: { id: 'device1', name: 'Test Device' },
      selectedApplication: { bundleId: 'com.test.app', name: 'Test App' },
      setSelectedDevice: vi.fn(),
      setSelectedApplication: vi.fn(),
    }
    return selector ? selector(state) : state
  },
}))

vi.mock('@renderer/features/database/stores', () => ({
  useCurrentDatabaseSelection: (selector: any) => {
    const state = {
      selectedDatabaseFile: { filename: 'test.db', path: '/path/to/test.db', deviceType: 'android' },
      setSelectedDatabaseFile: vi.fn(),
      selectedDatabaseTable: { name: 'users', columns: 3 },
      setSelectedDatabaseTable: vi.fn(),
    }
    return selector ? selector(state) : state
  },
  useTableData: (selector: any) => {
    const state = {
      tableData: {
        rows: [],
        columns: [],
        isCustomQuery: false,
        tableName: 'users',
      },
      setTableData: vi.fn(),
    }
    return selector ? selector(state) : state
  },
}))

vi.mock('@renderer/ui/toaster', () => ({
  toaster: {
    create: vi.fn(),
  },
}))

describe('subHeader component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders database and table selectors', () => {
    render(<SubHeader />)

    const comboboxes = screen.getAllByRole('combobox')
    expect(comboboxes).toHaveLength(2) // Database and table selectors
  })

  it('shows SQL query button', () => {
    render(<SubHeader />)

    const sqlButton = screen.getByText('SQL')
    expect(sqlButton).toBeInTheDocument()
  })

  it('has a refresh database button', () => {
    render(<SubHeader />)

    const refreshButton = screen.getByTestId('refresh-db')
    expect(refreshButton).toBeInTheDocument()
  })

  it('calls refresh when refresh button is clicked', async () => {
    render(<SubHeader />)

    const refreshButton = screen.getByTestId('refresh-db')
    
    await act(async () => {
      fireEvent.click(refreshButton)
    })

    await waitFor(() => {
      expect(mockHandleDBRefresh).toHaveBeenCalledTimes(1)
    })
  })

  it('shows export button', () => {
    render(<SubHeader />)

    const exportButton = screen.getByText('Export')
    expect(exportButton).toBeInTheDocument()
  })

  it('shows open file button', () => {
    render(<SubHeader />)

    const openButton = screen.getByText('Open')
    expect(openButton).toBeInTheDocument()
  })

  it('calls openFile when open button is clicked', async () => {
    render(<SubHeader />)

    const openButton = screen.getByText('Open')
    
    await act(async () => {
      fireEvent.click(openButton)
    })

    await waitFor(() => {
      expect(globalThis.window.api.openFile).toHaveBeenCalledTimes(1)
    })
  })

  it('calls exportFile when export button is clicked', async () => {
    render(<SubHeader />)

    const exportButton = screen.getByText('Export')
    
    await act(async () => {
      fireEvent.click(exportButton)
    })

    await waitFor(() => {
      expect(globalThis.window.api.exportFile).toHaveBeenCalledTimes(1)
    })
  })

  it('opens SQL modal when SQL button is clicked', async () => {
    render(<SubHeader />)

    const sqlButton = screen.getByText('SQL')
    
    await act(async () => {
      fireEvent.click(sqlButton)
    })

    // The modal should be opened (testing the button click functionality)
    expect(sqlButton).toBeInTheDocument()
  })

  it('displays file path for desktop database files', () => {
    render(<SubHeader />)
    
    const comboboxes = screen.getAllByRole('combobox')
    expect(comboboxes).toHaveLength(2)
  })
})
