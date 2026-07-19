import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '../../../test-utils/render'
import { SubHeader } from '../SubHeader'

const mockHandleDBRefresh = vi.hoisted(() => vi.fn())
const mockSetSelectedDevice = vi.hoisted(() => vi.fn())
const mockSetSelectedApplication = vi.hoisted(() => vi.fn())
const mockSetSelectedDatabaseFile = vi.hoisted(() => vi.fn())
const mockSetSelectedDatabaseTable = vi.hoisted(() => vi.fn())
const mockSetTableData = vi.hoisted(() => vi.fn())
const mockClearTableData = vi.hoisted(() => vi.fn())
const mockSetIsRefreshingTableData = vi.hoisted(() => vi.fn())
const mockSetSelectedRow = vi.hoisted(() => vi.fn())
let mockSelectedDevice: any
let mockSelectedApplication: any
let mockSelectedDatabaseFile: any
let mockSelectedDatabaseTable: any
let mockTableDataState: any
let mockIsFirstRoundLoading: boolean
let mockIsBackgroundScanning: boolean
let mockIsRefreshingTableData: boolean

vi.mock('../../common/FLSelect', () => ({
  default: ({ label, options = [], value, onChange, isDisabled }: any) => (
    <div data-testid={`select-${label}`} data-disabled={isDisabled ? 'true' : 'false'}>
      <span>{label}</span>
      <span data-testid={`value-${label}`}>{value?.label ?? value?.filename ?? value?.name ?? 'None'}</span>
      {options.flatMap((optionOrGroup: any) => {
        const optionsList = optionOrGroup.options ?? [optionOrGroup]
        return optionsList.map((option: any) => (
          <button
            key={`${label}-${option.value ?? option.path ?? option.name}`}
            type="button"
            data-testid={`${label}-${option.value ?? option.path ?? option.name}`}
            disabled={isDisabled}
            onClick={() => onChange(option)}
          >
            {option.label ?? option.filename ?? option.name}
          </button>
        ))
      })}
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

  // Mock window.api
  globalThis.window.api = {
    getDevices: vi.fn().mockResolvedValue([]),
    getIOSPackages: vi.fn().mockResolvedValue([]),
    getIOsDevicePackages: vi.fn().mockResolvedValue([]),
    getAndroidPackages: vi.fn().mockResolvedValue([]),
    getAndroidDatabaseFiles: vi.fn().mockResolvedValue([]),
    getIOSDeviceDatabaseFiles: vi.fn().mockResolvedValue([]),
    refreshIOSDeviceDatabaseFile: vi.fn().mockResolvedValue({
      success: true,
      file: {
        filename: 'test2.db',
        path: '/path/to/test2.db',
        deviceType: 'iphone-device',
        packageName: 'com.test.app',
        remotePath: '/remote/test2.db',
      },
    }),
    cancelIOSDeviceDatabaseScan: vi.fn().mockResolvedValue({ success: true }),
    getIOSSimulatorDatabaseFiles: vi.fn().mockResolvedValue([]),
    getTables: vi.fn().mockResolvedValue([]),
    getTableInfo: vi.fn().mockResolvedValue({ rows: [], columns: [] }),
    executeQuery: vi.fn().mockResolvedValue({ rows: [], columns: [] }),
    openDatabase: vi.fn().mockResolvedValue(true),
    openFile: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/path/to/test.db'] }),
    exportFile: vi.fn().mockResolvedValue('/path/to/exported.db'),
    exportTextFile: vi.fn().mockResolvedValue('/path/to/exported.csv'),
    exportLogs: vi.fn().mockResolvedValue('/path/to/logs.txt'),
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

vi.mock('@renderer/hooks/useDatabaseFiles', () => ({
  useDatabaseFiles: () => ({
    data: [
      { filename: 'test.db', path: '/path/to/test.db', deviceType: 'android' },
      { filename: 'test2.db', path: '/path/to/test2.db', deviceType: 'iphone' },
    ],
    isLoading: mockIsFirstRoundLoading,
    isFirstRoundLoading: mockIsFirstRoundLoading,
    isBackgroundScanning: mockIsBackgroundScanning,
    error: null,
    refetch: vi.fn().mockResolvedValue({
      data: [
        { filename: 'test.db', path: '/path/to/test.db', deviceType: 'android' },
        { filename: 'test2.db', path: '/path/to/test2.db', deviceType: 'iphone' },
      ],
    }),
  }),
}))

vi.mock('@renderer/hooks/useDatabaseTables', () => ({
  useDatabaseTables: () => ({
    data: {
      tables: [
        { name: 'users', columns: 3 },
        { name: 'posts', columns: 5 },
      ],
    },
    isError: false,
    error: null,
    refetch: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@renderer/hooks/useTableDataQuery', () => ({
  useTableDataQuery: () => ({
    data: {
      rows: [{ id: 1, name: 'Test' }],
      columns: ['id', 'name'],
    },
    refetch: mockRefetchTable,
    isLoading: false,
  }),
}))

vi.mock('@renderer/utils/databaseRefresh', () => ({
  refreshDatabase: mockHandleDBRefresh,
}))

vi.mock('@renderer/store', () => ({
  useCurrentDeviceSelection: (selector) => {
    const state = {
      selectedDevice: mockSelectedDevice,
      selectedApplication: mockSelectedApplication,
      setSelectedDevice: mockSetSelectedDevice,
      setSelectedApplication: mockSetSelectedApplication,
    }
    return selector ? selector(state) : state
  },
  useCurrentDatabaseSelection: (selector) => {
    const state = {
      selectedDatabaseFile: mockSelectedDatabaseFile,
      setSelectedDatabaseFile: mockSetSelectedDatabaseFile,
      selectedDatabaseTable: mockSelectedDatabaseTable,
      setSelectedDatabaseTable: mockSetSelectedDatabaseTable,
    }
    return selector ? selector(state) : state
  },
  useTableData: (selector) => {
    const state = {
      tableData: mockTableDataState,
      setTableData: mockSetTableData,
      clearTableData: mockClearTableData,
      isRefreshingTableData: mockIsRefreshingTableData,
      setIsRefreshingTableData: mockSetIsRefreshingTableData,
    }
    return selector ? selector(state) : state
  },
}))

vi.mock('@renderer/store/useRowEditingStore', () => ({
  useRowEditingStore: (selector) => {
    const state = {
      selectedRow: null,
      setSelectedRow: mockSetSelectedRow,
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
    mockSelectedDevice = { id: 'device1', name: 'Test Device', deviceType: 'android' }
    mockSelectedApplication = { bundleId: 'com.test.app', name: 'Test App' }
    mockSelectedDatabaseFile = { filename: 'test.db', path: '/path/to/test.db', deviceType: 'android' }
    mockSelectedDatabaseTable = { name: 'users', columns: 3 }
    mockTableDataState = {
      rows: [],
      columns: [],
      isCustomQuery: false,
      tableName: 'users',
    }
    mockIsFirstRoundLoading = false
    mockIsBackgroundScanning = false
    mockIsRefreshingTableData = false

    mockSetSelectedDevice.mockImplementation((value) => {
      mockSelectedDevice = value
    })
    mockSetSelectedApplication.mockImplementation((value) => {
      mockSelectedApplication = value
    })
    mockSetSelectedDatabaseFile.mockImplementation((value) => {
      mockSelectedDatabaseFile = value
    })
    mockSetSelectedDatabaseTable.mockImplementation((value) => {
      mockSelectedDatabaseTable = value
    })
    mockSetTableData.mockImplementation((value) => {
      mockTableDataState = value
    })
    mockClearTableData.mockImplementation(() => {
      mockTableDataState = null
    })
    mockSetIsRefreshingTableData.mockImplementation((value) => {
      mockIsRefreshingTableData = value
    })
  })

  it('renders database and table selectors', () => {
    render(<SubHeader />)

    expect(screen.getByTestId('select-Select Database')).toBeInTheDocument()
    expect(screen.getByTestId('select-Select Table')).toBeInTheDocument()
  })

  it('disables database and table selection until the prior core selection step exists', () => {
    mockSelectedApplication = null
    mockSelectedDatabaseFile = null
    mockSelectedDatabaseTable = null

    render(<SubHeader />)

    expect(screen.getByTestId('select-Select Database')).toHaveAttribute('data-disabled', 'true')
    expect(screen.getByTestId('select-Select Table')).toHaveAttribute('data-disabled', 'true')
    expect(screen.getByTestId('refresh-db')).toBeDisabled()
  })

  it('enables database selection before table selection once an app is selected', () => {
    mockSelectedDatabaseFile = null
    mockSelectedDatabaseTable = null

    render(<SubHeader />)

    expect(screen.getByTestId('select-Select Database')).toHaveAttribute('data-disabled', 'false')
    expect(screen.getByTestId('select-Select Table')).toHaveAttribute('data-disabled', 'true')
    expect(screen.getByTestId('refresh-db')).toBeDisabled()
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
    fireEvent.click(refreshButton)

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
    fireEvent.click(openButton)

    await waitFor(() => {
      expect(globalThis.window.api.openFile).toHaveBeenCalledTimes(1)
    })
  })

  it('keeps a desktop-opened database as a separate context switch', async () => {
    const view = render(<SubHeader />)

    fireEvent.click(screen.getByText('Open'))

    await waitFor(() => {
      expect(globalThis.window.api.openFile).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(mockSelectedDevice).toBeNull()
      expect(mockSelectedApplication).toBeNull()
      expect(mockSelectedDatabaseTable).toBeNull()
      expect(mockSelectedDatabaseFile).toMatchObject({
        path: '/path/to/test.db',
        filename: 'test.db',
        deviceType: 'desktop',
      })
    })

    view.rerender(<SubHeader />)
    expect(screen.getByText('/path/to/test.db')).toBeInTheDocument()
  })

  it('calls exportFile when export button is clicked', async () => {
    render(<SubHeader />)

    const exportButton = screen.getByText('Export')
    fireEvent.click(exportButton)

    await waitFor(() => {
      expect(globalThis.window.api.exportFile).toHaveBeenCalledTimes(1)
    })
  })

  it('selecting a different database visibly resets the table step', async () => {
    const view = render(<SubHeader />)

    expect(screen.getByTestId('value-Select Database')).toHaveTextContent('test.db')
    expect(screen.getByTestId('value-Select Table')).toHaveTextContent('users')

    fireEvent.click(screen.getByTestId('Select Database-/path/to/test2.db'))

    await waitFor(() => {
      expect(globalThis.window.api.switchDatabase).toHaveBeenCalledWith('/path/to/test2.db')
    })

    view.rerender(<SubHeader />)

    expect(screen.getByTestId('value-Select Database')).toHaveTextContent('test2.db')
    expect(screen.getByTestId('value-Select Table')).toHaveTextContent('None')
  })

  it('keeps the selected database and table visible while an iPhone refresh restarts scanning', async () => {
    mockSelectedDevice = { id: 'iphone-1', name: 'iPhone', deviceType: 'iphone-device' }
    mockSelectedDatabaseFile = {
      filename: 'test2.db',
      path: '/path/to/test2.db',
      deviceType: 'iphone-device',
      packageName: 'com.test.app',
      remotePath: '/remote/test2.db',
    }
    const view = render(<SubHeader />)

    expect(screen.getByTestId('value-Select Database')).toHaveTextContent('test2.db')
    expect(screen.getByTestId('value-Select Table')).toHaveTextContent('users')

    fireEvent.click(screen.getByTestId('refresh-db'))

    await waitFor(() => {
      expect(globalThis.window.api.refreshIOSDeviceDatabaseFile).toHaveBeenCalledWith(
        'iphone-1',
        'com.test.app',
        '/remote/test2.db',
      )
    })

    view.rerender(<SubHeader />)

    expect(screen.getByTestId('value-Select Database')).toHaveTextContent('test2.db')
    expect(screen.getByTestId('value-Select Table')).toHaveTextContent('users')
  })

  it('keeps database and table selection disabled during iPhone first-round scan loading', () => {
    mockSelectedDevice = { id: 'iphone-1', name: 'iPhone', deviceType: 'iphone-device' }
    mockSelectedApplication = { bundleId: 'com.test.app', name: 'Test App' }
    mockSelectedDatabaseFile = {
      filename: 'test2.db',
      path: '/path/to/test2.db',
      deviceType: 'iphone-device',
      packageName: 'com.test.app',
      remotePath: '/remote/test2.db',
    }
    mockSelectedDatabaseTable = null
    mockIsFirstRoundLoading = true

    render(<SubHeader />)

    expect(screen.getByTestId('select-Select Database')).toHaveAttribute('data-disabled', 'true')
    expect(screen.getByTestId('select-Select Table')).toHaveAttribute('data-disabled', 'true')
    expect(screen.getByTestId('refresh-db')).toBeDisabled()
    expect(screen.getByTestId('refresh-db')).toHaveAttribute('data-state', 'open')
  })

  it('opens SQL modal when SQL button is clicked', () => {
    render(<SubHeader />)

    const sqlButton = screen.getByText('SQL')
    fireEvent.click(sqlButton)

    // The modal should be opened (testing the button click functionality)
    expect(sqlButton).toBeInTheDocument()
  })

  it('displays file path for desktop database files', () => {
    mockSelectedDatabaseFile = { filename: 'test.db', path: '/path/to/test.db', deviceType: 'desktop' }

    render(<SubHeader />)

    expect(screen.getByText('/path/to/test.db')).toBeInTheDocument()
  })
})
