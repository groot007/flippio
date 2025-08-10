import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DataGridContainer } from '../DataGridContainer'

// Mock all the hooks
vi.mock('@renderer/features/change-history/hooks', () => ({
  useChangeHistoryRefresh: () => ({
    refreshChangeHistory: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@renderer/features/database/hooks', () => ({
  useTableDataQuery: () => ({
    data: {
      rows: [{ id: 1, name: 'Test Row' }],
      columns: [{ name: 'id', type: 'INTEGER' }, { name: 'name', type: 'TEXT' }],
    },
    isLoading: false,
    error: null,
    refetch: vi.fn().mockResolvedValue({}),
  }),
}))

vi.mock('@renderer/features/database/stores', () => ({
  useCurrentDatabaseSelection: () => ({
    selectedDatabaseTable: { name: 'test_table' },
    selectedDatabaseFile: { path: '/test/path.db' },
  }),
  useRowEditingStore: () => ({
    setSelectedRow: vi.fn(),
  }),
  useTableData: () => ({
    isLoadingTableData: false,
    setIsLoadingTableData: vi.fn(),
    tableData: {
      rows: [{ id: 1, name: 'Test Row' }],
      columns: [{ name: 'id', type: 'INTEGER' }, { name: 'name', type: 'TEXT' }],
    },
    setTableData: vi.fn(),
  }),
}))

vi.mock('@renderer/features/devices/stores', () => ({
  useCurrentDeviceSelection: () => ({
    selectedDevice: { id: 'test-device', name: 'Test Device' },
    selectedApplication: { bundleId: 'com.test.app', name: 'Test App' },
  }),
}))

vi.mock('@renderer/ui/color-mode', () => ({
  useColorMode: () => ({ colorMode: 'light' }),
}))

vi.mock('@renderer/ui/toaster', () => ({
  toaster: {
    create: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock DataGridPresenter
vi.mock('../DataGridPresenter', () => ({
  DataGridPresenter: (props: any) => (
    <div data-testid="data-grid-presenter">
      <button 
        data-testid="add-row-button" 
        onClick={props.onAddRow}
        disabled={props.isAddingRow}
      >
        {props.isAddingRow ? 'Adding...' : 'Add Row'}
      </button>
      <div data-testid="table-data">
        {props.tableData?.rows?.length > 0 ? 'Has Data' : 'No Data'}
      </div>
    </div>
  ),
}))

// Mock window.api
const mockApi = {
  addNewRowWithDefaults: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.window.api = mockApi as any
})

describe('dataGridContainer', () => {
  it('should render the DataGrid with data', () => {
    render(<DataGridContainer />)
    
    expect(screen.getByTestId('data-grid-presenter')).toBeInTheDocument()
    expect(screen.getByTestId('table-data')).toHaveTextContent('Has Data')
  })

  it('should handle add row functionality', async () => {
    mockApi.addNewRowWithDefaults.mockResolvedValue({ success: true })
    
    render(<DataGridContainer />)
    
    const addButton = screen.getByTestId('add-row-button')
    expect(addButton).toHaveTextContent('Add Row')
    
    await act(async () => {
      fireEvent.click(addButton)
    })
    
    await waitFor(() => {
      expect(mockApi.addNewRowWithDefaults).toHaveBeenCalledWith(
        'test_table',
        '/test/path.db',
        'test-device',
        'Test Device',
        undefined, // deviceType
        'com.test.app',
        'Test App',
      )
    })
  })

  it('should show loading state when adding row', async () => {
    // Create a promise that we can control
    let resolveAddRow: (value: any) => void
    const addRowPromise = new Promise((resolve) => {
      resolveAddRow = resolve
    })
    
    mockApi.addNewRowWithDefaults.mockReturnValue(addRowPromise)
    
    render(<DataGridContainer />)
    
    const addButton = screen.getByTestId('add-row-button')
    
    await act(async () => {
      fireEvent.click(addButton)
    })
    
    // Should show loading state
    expect(addButton).toHaveTextContent('Adding...')
    expect(addButton).toBeDisabled()
    
    // Resolve the promise
    await act(async () => {
      resolveAddRow!({ success: true })
    })
    
    await waitFor(() => {
      expect(addButton).toHaveTextContent('Add Row')
      expect(addButton).not.toBeDisabled()
    })
  })

  it('should handle add row error', async () => {
    mockApi.addNewRowWithDefaults.mockResolvedValue({ 
      success: false, 
      error: 'Test error', 
    })
    
    render(<DataGridContainer />)
    
    const addButton = screen.getByTestId('add-row-button')
    
    await act(async () => {
      fireEvent.click(addButton)
    })
    
    await waitFor(() => {
      expect(mockApi.addNewRowWithDefaults).toHaveBeenCalled()
    })
  })

  it('should handle error when API fails', async () => {
    mockApi.addNewRowWithDefaults.mockRejectedValue(new Error('Network error'))
    
    render(<DataGridContainer />)
    
    const addButton = screen.getByTestId('add-row-button')
    
    await act(async () => {
      fireEvent.click(addButton)
    })
    
    await waitFor(() => {
      expect(mockApi.addNewRowWithDefaults).toHaveBeenCalled()
      // Button should return to normal state after error
      expect(addButton).toHaveTextContent('Add Row')
      expect(addButton).not.toBeDisabled()
    })
  })
})
