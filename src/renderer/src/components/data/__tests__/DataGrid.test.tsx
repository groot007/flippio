import { screen } from '@testing-library/react'
import React from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render } from '../../../test-utils/render'
import { DataGrid } from '../DataGrid'

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
    data: {
      rows: [{ id: 1, name: 'John Doe', email: 'john@example.com' }],
      columns: [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT' },
        { name: 'email', type: 'TEXT' },
      ],
    },
    error: null,
    refetch: vi.fn(),
  }),
}))

vi.mock('@renderer/store/useRowEditingStore', () => ({
  useRowEditingStore: () => ({ setSelectedRow: vi.fn() }),
}))

vi.mock('@renderer/store', () => ({
  useCurrentDeviceSelection: () => ({
    selectedDevice: { id: 'device1', name: 'Test Device' },
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
  useTableData: () => ({
    isLoadingTableData: false,
    setIsLoadingTableData: vi.fn(),
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
    setTableData: vi.fn(),
  }),
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
})
