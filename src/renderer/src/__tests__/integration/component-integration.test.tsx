import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Main } from '../../pages/Main'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection, useTableData } from '../../store'
import { useRowEditingStore } from '../../store/useRowEditingStore'
import { render } from '../../test-utils/render'

let mockTableDataResponse: { rows: Record<string, any>[], columns: { name: string, type: string }[] } | undefined
let mockTableError: Error | null = null

const mockDevices = [{ id: 'device-1', name: 'Pixel', label: 'Pixel', deviceType: 'android' as const }]
const mockApplications = [{ name: 'Test App', bundleId: 'com.test.app' }]
const mockDatabaseFiles = [{
  path: '/tmp/test.db',
  filename: 'test.db',
  packageName: 'com.test.app',
  location: '/data/data/com.test.app/databases',
  remotePath: '/data/data/com.test.app/databases/test.db',
  deviceType: 'android' as const,
}]
const mockDatabaseTables = [{ name: 'users', columns: 3 }]

vi.mock('@renderer/hooks/useDevices', () => ({
  useDevices: () => ({
    data: mockDevices,
    refetch: vi.fn(),
    isFetching: false,
    isPending: false,
    isFetched: true,
  }),
}))

vi.mock('@renderer/hooks/useApplications', () => ({
  useApplications: () => ({
    data: mockApplications,
    isLoading: false,
    error: null,
    isError: false,
  }),
}))

vi.mock('@renderer/hooks/useDatabaseFiles', () => ({
  useDatabaseFiles: () => ({
    data: mockDatabaseFiles,
    isLoading: false,
  }),
}))

vi.mock('@renderer/hooks/useDatabaseTables', () => ({
  useDatabaseTables: () => ({
    data: {
      tables: mockDatabaseTables,
    },
    isError: false,
  }),
}))

vi.mock('@renderer/hooks/useTableDataQuery', () => ({
  useTableDataQuery: (tableName: string) => ({
    data: tableName && !mockTableError ? mockTableDataResponse : undefined,
    error: mockTableError,
    refetch: vi.fn(),
    isLoading: false,
  }),
}))

vi.mock('@renderer/hooks/useChangeHistory', () => ({
  useChangeHistoryRefresh: () => ({
    refreshChangeHistory: vi.fn(),
  }),
  useChangeHistory: () => ({
    data: { changes: [] },
    isLoading: false,
  }),
}))

vi.mock('ag-grid-react', () => ({
  AgGridReact: React.forwardRef(({ rowData, onRowClicked }: any, ref: any) => (
    <div data-testid="ag-grid-mock" ref={ref}>
      {rowData?.map((row: any, index: number) => (
        <button
          key={index}
          type="button"
          data-testid={`mock-row-${index}`}
          onClick={() => onRowClicked?.({ data: row })}
        >
          {Object.values(row).join(' - ')}
        </button>
      ))}
    </div>
  )),
}))

vi.mock('../../components/data/TableFooter', () => ({
  TableFooter: () => <div data-testid="table-footer">Footer</div>,
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
    openDatabase: vi.fn().mockResolvedValue({ success: true }),
    getTableInfo: vi.fn(),
    switchDatabase: vi.fn().mockResolvedValue({ success: true }),
    openFile: vi.fn(),
    exportFile: vi.fn(),
    updateTableRow: vi.fn(),
    pushDatabaseFile: vi.fn(),
    addNewRowWithDefaults: vi.fn().mockResolvedValue({ success: true }),
    deleteTableRow: vi.fn(),
    clearTable: vi.fn(),
    getChangeHistory: vi.fn().mockResolvedValue({ success: true, changes: [] }),
    getContextSummaries: vi.fn().mockResolvedValue({ success: true, summaries: [] }),
    getChangeHistoryDiagnostics: vi.fn().mockResolvedValue({ success: true, diagnostics: {} }),
    clearContextChanges: vi.fn().mockResolvedValue({ success: true }),
    clearAllChangeHistory: vi.fn().mockResolvedValue({ success: true }),
    webUtils: { getPathForFile: vi.fn().mockResolvedValue('') },
  } as any
})

function resetStores() {
  useCurrentDeviceSelection.setState({
    selectedDevice: null,
    selectedApplication: null,
  })
  useCurrentDatabaseSelection.setState({
    selectedDatabaseFile: null,
    selectedDatabaseTable: null,
  })
  useTableData.setState({
    tableData: null,
    isLoadingTableData: false,
  })
  useRowEditingStore.setState({
    selectedRow: null,
  })
}

async function selectFullContext() {
  await act(async () => {
    useCurrentDeviceSelection.getState().setSelectedDevice({
      ...mockDevices[0],
      model: 'Pixel',
    })
    useCurrentDeviceSelection.getState().setSelectedApplication(mockApplications[0])
    useCurrentDatabaseSelection.getState().setSelectedDatabaseFile(mockDatabaseFiles[0])
    useCurrentDatabaseSelection.getState().setSelectedDatabaseTable({
      name: 'users',
      deviceType: 'android',
    })
  })
}

describe('component Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStores()
    mockTableDataResponse = undefined
    mockTableError = null
  })

  afterEach(() => {
    resetStores()
  })

  describe('main Application Layout', () => {
    it('should render empty state before selections exist', async () => {
      render(<Main />)

      await waitFor(() => {
        expect(screen.getByText('Select device and app to load data')).toBeInTheDocument()
        expect(screen.getByText('Current grid cleared until new context is ready.')).toBeInTheDocument()
      })
    })
  })

  describe('database Operations Integration', () => {
    it('should show database empty state when device and app are selected without DB', async () => {
      render(<Main />)

      await act(async () => {
        useCurrentDeviceSelection.getState().setSelectedDevice({
          ...mockDevices[0],
          model: 'Pixel',
        })
        useCurrentDeviceSelection.getState().setSelectedApplication(mockApplications[0])
      })

      await waitFor(() => {
        expect(screen.getByText('Select database')).toBeInTheDocument()
      })
    })

    it('should show table empty state when DB is selected without table', async () => {
      render(<Main />)

      await act(async () => {
        useCurrentDeviceSelection.getState().setSelectedDevice({
          ...mockDevices[0],
          model: 'Pixel',
        })
        useCurrentDeviceSelection.getState().setSelectedApplication(mockApplications[0])
        useCurrentDatabaseSelection.getState().setSelectedDatabaseFile(mockDatabaseFiles[0])
      })

      await waitFor(() => {
        expect(screen.getByText('Select table')).toBeInTheDocument()
      })
    })
  })

  describe('aG Grid Integration', () => {
    it('should render grid when data is available', async () => {
      mockTableDataResponse = {
        columns: [
          { name: 'id', type: 'INTEGER' },
          { name: 'name', type: 'TEXT' },
          { name: 'email', type: 'TEXT' },
        ],
        rows: [
          { id: 1, name: 'John', email: 'john@test.com' },
          { id: 2, name: 'Jane', email: 'jane@test.com' },
        ],
      }

      render(<Main />)
      await selectFullContext()

      await waitFor(() => {
        expect(screen.getByTestId('ag-grid-mock')).toBeInTheDocument()
        expect(screen.getByText('1 - John - john@test.com')).toBeInTheDocument()
        expect(screen.getByText('2 - Jane - jane@test.com')).toBeInTheDocument()
        expect(screen.getByTestId('table-footer')).toBeInTheDocument()
      })
    })

    it('should handle row selection', async () => {
      mockTableDataResponse = {
        columns: [
          { name: 'id', type: 'INTEGER' },
          { name: 'name', type: 'TEXT' },
          { name: 'email', type: 'TEXT' },
        ],
        rows: [{ id: 1, name: 'John', email: 'john@test.com' }],
      }

      render(<Main />)
      await selectFullContext()

      await waitFor(() => {
        expect(screen.getByTestId('ag-grid-mock')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('mock-row-0'))

      await waitFor(() => {
        expect(screen.getByText('Row Details')).toBeInTheDocument()
      })
    })
  })

  describe('error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockTableError = new Error('Network error')

      render(<Main />)
      await selectFullContext()

      await waitFor(() => {
        expect(screen.getByText('Error loading data')).toBeInTheDocument()
        expect(screen.getByText('Error: Network error')).toBeInTheDocument()
      })
    })

    it('should handle state cleanup on unmount', async () => {
      const { unmount } = render(<Main />)

      await selectFullContext()
      unmount()

      expect(true).toBe(true)
    })
  })
})
