import { screen } from '@testing-library/react'
import React from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '../../../test-utils/render'
import { DataGrid } from '../DataGrid'

const mockSetSelectedRow = vi.hoisted(() => vi.fn())
const mockSetTableData = vi.hoisted(() => vi.fn())
const mockSetIsLoadingTableData = vi.hoisted(() => vi.fn())
const mockSetIsRefreshingTableData = vi.hoisted(() => vi.fn())
let mockIsRefreshingTableData = false
let mockQueryData: any = null

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
    addNewRowWithDefaults: vi.fn().mockResolvedValue({ success: true }),
    pushDatabaseFile: vi.fn().mockResolvedValue({ success: true }),
    webUtils: { getPathForFile: vi.fn().mockResolvedValue('') },
  } as any
})

// Mock the hooks with simple implementations
vi.mock('@renderer/hooks/useTableDataQuery', () => ({
  useTableDataQuery: () => ({
    data: mockQueryData,
    error: null,
    refetch: vi.fn(),
  }),
}))

vi.mock('@renderer/store/useRowEditingStore', () => ({
  useRowEditingStore: () => ({ setSelectedRow: mockSetSelectedRow }),
}))

vi.mock('@renderer/store', () => ({
  useCurrentDeviceSelection: () => ({
    selectedDevice: { id: 'device1', name: 'Test Device' },
    selectedApplication: { bundleId: 'com.test.app', name: 'Test App' },
  }),
  useCurrentDatabaseSelection: () => ({
    selectedDatabaseFile: { 
      filename: 'test.db', 
      path: '/path/to/test.db', 
      deviceType: 'android',
      packageName: 'com.test.app',
    },
    selectedDatabaseTable: { name: 'users', columns: 3 },
  }),
  useTableData: Object.assign(
    (selector?: any) => {
      const state = {
        isLoadingTableData: false,
        isRefreshingTableData: mockIsRefreshingTableData,
        setIsLoadingTableData: mockSetIsLoadingTableData,
        setIsRefreshingTableData: mockSetIsRefreshingTableData,
        tableData: {
          rows: [{ id: 1, name: 'John Doe', email: 'john@example.com' }],
          columns: [
            { name: 'id', type: 'INTEGER' },
            { name: 'name', type: 'TEXT' },
            { name: 'email', type: 'TEXT' },
          ],
          isCustomQuery: false,
          tableName: 'users',
        },
        setTableData: mockSetTableData,
      }
      return selector ? selector(state) : state
    },
    {
      getState: () => ({
        setIsRefreshingTableData: mockSetIsRefreshingTableData,
      }),
    },
  ),
}))

vi.mock('@renderer/ui/color-mode', () => ({
  useColorMode: () => ({ colorMode: 'light' }),
}))

vi.mock('@renderer/ui/toaster', () => ({
  toaster: { create: vi.fn() },
}))

// Mock AG Grid
vi.mock('ag-grid-react', () => ({
  AgGridReact: React.forwardRef(({ rowData }: any, ref: any) => (
    <div data-testid="ag-grid" ref={ref}>
      {rowData?.map((row: any, index: number) => (
        <div key={index} data-testid={`grid-row-${index}`}>
          {row.name}
        </div>
      ))}
    </div>
  )),
}))

// Mock TableFooter
vi.mock('../TableFooter', () => ({
  TableFooter: () => <div data-testid="table-footer">Footer</div>,
}))

describe('dataGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsRefreshingTableData = false
    mockQueryData = {
      rows: [{ id: 1, name: 'John Doe', email: 'john@example.com' }],
      columns: [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT' },
        { name: 'email', type: 'TEXT' },
      ],
    }
  })

  it('renders the DataGrid component', () => {
    render(<DataGrid />)

    expect(screen.getByTestId('ag-grid')).toBeInTheDocument()
  })

  it('renders table data', () => {
    render(<DataGrid />)

    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('renders table footer', () => {
    render(<DataGrid />)

    expect(screen.getByTestId('table-footer')).toBeInTheDocument()
  })

  it('shows add new row button when table is selected', () => {
    render(<DataGrid />)

    expect(screen.getByLabelText('Add new row')).toBeInTheDocument()
  })

  it('shows a bottom-right refresh status chip while table data is refreshing', () => {
    mockIsRefreshingTableData = true

    render(<DataGrid />)

    expect(screen.getByText('Syncing fresh rows')).toBeInTheDocument()
    expect(screen.getByText('Read only')).toBeInTheDocument()
  })

  it('clears the refreshing state after fresh rows are written into the grid store', () => {
    mockIsRefreshingTableData = true

    render(<DataGrid />)

    expect(mockSetIsRefreshingTableData).toHaveBeenCalledWith(false)
    expect(mockSetTableData).toHaveBeenCalledWith({
      rows: [{ id: 1, name: 'John Doe', email: 'john@example.com' }],
      columns: [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT' },
        { name: 'email', type: 'TEXT' },
      ],
      isCustomQuery: false,
      tableName: 'users',
    })
  })
})
