import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Main } from '../../pages/Main'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection, useTableData } from '../../store'
import { useRowEditingStore } from '../../store/useRowEditingStore'
import { render } from '../../test-utils/render'

let mockTableDataResponse: { rows: Record<string, any>[], columns: { name: string, type: string }[] } | undefined
const mockRefetchTable = vi.fn()
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
    data: tableName ? mockTableDataResponse : undefined,
    error: null,
    refetch: mockRefetchTable,
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
    <div data-testid="ag-grid" ref={ref}>
      {rowData?.map((row: any, index: number) => (
        <button
          key={index}
          type="button"
          data-testid={`grid-row-${index}`}
          onClick={() => onRowClicked?.({ data: row })}
        >
          {row.name}
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

describe('main critical user flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStores()
    mockTableDataResponse = undefined
    vi.mocked(globalThis.window.api.updateTableRow).mockResolvedValue({ success: true })
    vi.mocked(globalThis.window.api.pushDatabaseFile).mockResolvedValue({ success: true })
  })

  afterEach(() => {
    resetStores()
  })

  it('loads device/app/db/table flow into grid and opens row details on row select', async () => {
    mockTableDataResponse = {
      columns: [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT' },
        { name: 'email', type: 'TEXT' },
      ],
      rows: [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
      ],
    }

    render(<Main />)

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

    await waitFor(() => {
      expect(screen.getByTestId('ag-grid')).toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByTestId('table-footer')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('grid-row-0'))

    await waitFor(() => {
      expect(screen.getByText('Row Details')).toBeInTheDocument()
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
  })

  it('edits a row, saves, pushes DB, and shows refreshed grid data', async () => {
    mockTableDataResponse = {
      columns: [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT' },
        { name: 'email', type: 'TEXT' },
      ],
      rows: [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
      ],
    }

    render(<Main />)

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

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('grid-row-0'))

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Edit'))
    fireEvent.change(screen.getByDisplayValue('John Doe'), {
      target: { value: 'Updated John' },
    })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(globalThis.window.api.updateTableRow).toHaveBeenCalledWith(
        'users',
        { id: 1, name: 'Updated John', email: 'john@example.com' },
        expect.stringContaining('id'),
        '/tmp/test.db',
        'device-1',
        'Pixel',
        'android',
        'com.test.app',
        'Test App',
      )
    })

    expect(globalThis.window.api.pushDatabaseFile).toHaveBeenCalledWith(
      'device-1',
      '/tmp/test.db',
      'com.test.app',
      '/data/data/com.test.app/databases/test.db',
      'android',
    )
    expect(mockRefetchTable).toHaveBeenCalled()

    await act(async () => {
      mockTableDataResponse = {
        ...mockTableDataResponse!,
        rows: [
          { id: 1, name: 'Updated John', email: 'john@example.com' },
        ],
      }
      useTableData.getState().setTableData({
        rows: mockTableDataResponse.rows,
        columns: mockTableDataResponse.columns,
        isCustomQuery: false,
        tableName: 'users',
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('grid-row-0')).toHaveTextContent('Updated John')
    })
  })
})
