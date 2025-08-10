import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '../../test-utils/render'
import { SidePanel } from '../SidePanel/SidePanel'

// Create mocks before any imports
const mockSetSelectedRow = vi.fn()
const mockClearTableMutation = vi.fn()
const mockDeleteRowMutation = vi.fn()

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

vi.mock('@renderer/hooks/useTableDataQuery', () => ({
  useTableDataQuery: () => ({
    data: [
      { id: 1, name: 'Test User', email: 'test@example.com' },
      { id: 2, name: 'Jane Doe', email: 'jane@example.com' },
    ],
    isLoading: false,
    error: null,
  }),
}))

vi.mock('@renderer/hooks/useTableMutations', () => ({
  useClearTableMutation: () => ({
    mutateAsync: mockClearTableMutation,
    isPending: false,
  }),
  useDeleteRowMutation: () => ({
    mutateAsync: mockDeleteRowMutation,
    isPending: false,
  }),
}))

vi.mock('@renderer/features/devices/stores', () => ({
  useCurrentDeviceSelection: () => ({
    selectedDevice: { id: 'device1', name: 'Test Device' },
    selectedApplication: { bundleId: 'com.test.app', name: 'Test App' },
  }),
}))

vi.mock('@renderer/features/database/stores', () => ({
  useCurrentDatabaseSelection: () => ({
    selectedDatabaseFile: { filename: 'test.db', path: '/path/to/test.db', deviceType: 'android' },
    selectedDatabaseTable: { name: 'users', columns: 3 },
  }),
  useTableData: () => ({
    tableData: {
      rows: [{ id: 1, name: 'Test User', email: 'test@example.com' }],
      columns: [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT' },
        { name: 'email', type: 'TEXT' },
      ],
      isCustomQuery: false,
      tableName: 'users',
    },
  }),
  useRowEditingStore: () => ({
    selectedRow: {
      rowData: { id: 1, name: 'Test User', email: 'test@example.com' },
      columnInfo: [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT' },
        { name: 'email', type: 'TEXT' },
      ],
    },
    setSelectedRow: mockSetSelectedRow,
  }),
}))

vi.mock('@renderer/ui/color-mode', () => ({
  useColorMode: () => ({
    colorMode: 'light',
  }),
}))

vi.mock('@renderer/ui/toaster', () => ({
  toaster: {
    create: vi.fn(),
  },
}))

describe('sidePanel component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    mockClearTableMutation.mockResolvedValue({})
    mockDeleteRowMutation.mockResolvedValue({})
  })

  it('renders row details when a row is selected', async () => {
    render(<SidePanel />)

    await waitFor(() => {
      expect(screen.getByText('Row Details')).toBeInTheDocument()
    })
  })

  it('shows remove row button', async () => {
    render(<SidePanel />)

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
  })

  it('shows clear table button', async () => {
    render(<SidePanel />)

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
  })

  it('calls setSelectedRow with null when close button is clicked', async () => {
    render(<SidePanel />)

    await waitFor(() => {
      const closeButton = screen.getByLabelText('Close panel')
      
      act(() => {
        fireEvent.click(closeButton)
      })
    })

    expect(mockSetSelectedRow).toHaveBeenCalledWith(null)
  })
})
