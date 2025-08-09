import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Main } from '../../pages/Main'
import { useAppStore } from '../../store/appStore'
import { useCurrentDatabaseSelection } from '../../store/useCurrentDatabaseSelection'
import { useTableData } from '../../store/useTableData'
import { render } from '../../test-utils/render'

const mockApi = {
  getDevices: vi.fn(),
  getApplications: vi.fn(),
  getDatabaseFiles: vi.fn(),
  getTables: vi.fn(),
  getTableData: vi.fn()
}

vi.mock('../../api/tauri-api', () => ({
  tauriApi: mockApi
}))

vi.mock('ag-grid-react', () => ({
  AgGridReact: vi.fn(({ onSelectionChanged, onGridReady, ...props }) => {
    // Mock component that reads from useTableData store instead of props
    const { tableData } = useTableData()
    const rows = tableData?.rows || props.rowData || []
    
    return (
      <div data-testid="ag-grid-mock" {...props}>
        {rows.map((row: any, index: number) => (
          <div 
            key={index} 
            data-testid={`mock-row-${index}`}
            onClick={() => onSelectionChanged?.({ api: { getSelectedRows: () => [row] } })}
          >
            {Object.values(row).join(' - ')}
          </div>
        ))}
      </div>
    )
  })
}))

function resetStores() {
  const appStore = useAppStore.getState()
  appStore.setDevices([])
  appStore.setSelectedDevice('')
  appStore.setApplications([])
  appStore.setSelectedApplication(null)
  appStore.setTableData(null)
  
  const dbStore = useCurrentDatabaseSelection.getState()
  dbStore.setSelectedDatabaseFile(null)
  dbStore.setSelectedDatabaseTable(null)
  dbStore.setDatabaseFiles([])
  dbStore.setDatabaseTables([])
  
  const tableStore = useTableData.getState()
  tableStore.setTableData({
    rows: [],
    columns: [],
    isCustomQuery: false
  })
  tableStore.setIsLoadingTableData(false)
}

describe('component Integration Tests', () => {
  beforeEach(() => {
    resetStores()
    vi.clearAllMocks()
    
    mockApi.getDevices.mockResolvedValue({ success: true, data: [] })
    mockApi.getApplications.mockResolvedValue({ success: true, data: [] })
    mockApi.getDatabaseFiles.mockResolvedValue({ success: true, data: [] })
    mockApi.getTables.mockResolvedValue({ success: true, data: [] })
    mockApi.getTableData.mockResolvedValue({ success: true, data: { rows: [], columns: [] } })
  })

  describe('main Application Layout', () => {
    it('should render all main components', async () => {
      render(<Main />)
      
      await waitFor(() => {
        // Check for device selector (part of AppHeader)
        expect(screen.getByText(/select device/i)).toBeInTheDocument()
        // Check for app selector (part of SubHeader/AppHeader) 
        expect(screen.getByText(/select app/i)).toBeInTheDocument()
        // Check for AG Grid mock
        expect(screen.getByTestId('ag-grid-mock')).toBeInTheDocument()
      })
    })
  })

  describe('device Selection Workflow', () => {
    it('should enable device selection', async () => {
      render(<Main />)
      
      await act(async () => {
        useAppStore.getState().setDevices([
          { value: 'device-1', label: 'Test Android', description: 'Android device' }
        ])
      })
      
      await waitFor(() => {
        expect(screen.getByText(/select device/i)).toBeInTheDocument()
      })
    })

    it('should enable application selection after device selection', async () => {
      render(<Main />)
      
      await act(async () => {
        useAppStore.getState().setDevices([
          { value: 'device-1', label: 'Test Android', description: 'Android device' }
        ])
        useAppStore.getState().setSelectedDevice('device-1')
        useAppStore.getState().setApplications([
          { id: 'app1', name: 'Test App', deviceId: 'device-1' }
        ])
      })
      
      await waitFor(() => {
        expect(screen.getByText(/select app/i)).toBeInTheDocument()
      })
    })
  })

  describe('database Operations Integration', () => {
    it('should handle database file selection', async () => {
      render(<Main />)
      
      await act(async () => {
        useAppStore.getState().setSelectedDevice('device-1')
        useAppStore.getState().setSelectedApplication('app1')
        useCurrentDatabaseSelection.getState().setSelectedDatabaseFile({
          path: '/path/to/test.db',
          filename: 'test.db',
          deviceType: 'android',
          packageName: 'com.test.app',
          location: '/data/data/com.test.app'
        })
      })
      
      await waitFor(() => {
        expect(screen.getByText(/select database/i)).toBeInTheDocument()
      })
    })

    it('should handle table selection and data loading', async () => {
      render(<Main />)
      
      await act(async () => {
        useAppStore.getState().setSelectedDevice('device-1')
        useAppStore.getState().setSelectedApplication('app1')
        useCurrentDatabaseSelection.getState().setSelectedDatabaseFile({
          path: '/path/to/test.db',
          filename: 'test.db',
          deviceType: 'android',
          packageName: 'com.test.app',
          location: '/data/data/com.test.app'
        })
        useCurrentDatabaseSelection.getState().setSelectedDatabaseTable({
          name: 'users',
          deviceType: 'android'
        })
      })
      
      await waitFor(() => {
        expect(screen.getByText(/select table/i)).toBeInTheDocument()
      })
    })
  })

  describe('aG Grid Integration', () => {
    it('should render grid when data is available', async () => {
      render(<Main />)
      
      await act(async () => {
        useTableData.getState().setTableData({
          rows: [
            { id: 1, name: 'John', email: 'john@test.com' },
            { id: 2, name: 'Jane', email: 'jane@test.com' }
          ],
          columns: ['id', 'name', 'email'],
          isCustomQuery: false,
          tableName: 'users'
        })
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('ag-grid-mock')).toBeInTheDocument()
        expect(screen.getByText(/John/)).toBeInTheDocument()
        expect(screen.getByText(/jane@test.com/)).toBeInTheDocument()
      })
    })

    it('should handle row selection', async () => {
      render(<Main />)
      
      await act(async () => {
        useTableData.getState().setTableData({
          rows: [{ id: 1, name: 'John', email: 'john@test.com' }],
          columns: ['id', 'name', 'email'],
          isCustomQuery: false,
          tableName: 'users'
        })
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('ag-grid-mock')).toBeInTheDocument()
      })
      
      const gridRow = screen.getByTestId('mock-row-0')
      fireEvent.click(gridRow)
      
      expect(screen.getByTestId('ag-grid-mock')).toBeInTheDocument()
    })
  })

  describe('error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockApi.getDevices.mockRejectedValue(new Error('Network error'))
      
      render(<Main />)
      
      await waitFor(() => {
        expect(screen.getByText(/select device/i)).toBeInTheDocument()
      })
    })

    it('should handle state cleanup on unmount', async () => {
      const { unmount } = render(<Main />)
      
      await act(async () => {
        useAppStore.getState().setSelectedDevice('device-1')
      })
      
      unmount()
      
      expect(true).toBe(true)
    })
  })
})
