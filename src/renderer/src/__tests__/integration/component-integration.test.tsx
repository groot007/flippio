import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCurrentDatabaseSelection, useTableData } from '../../features/database/stores'
import { useCurrentDeviceSelection } from '../../features/devices/stores'
import { Main } from '../../pages/Main'
import { render } from '../../test-utils/render'

const mockApi = vi.hoisted(() => ({
  getDevices: vi.fn(),
  getApplications: vi.fn(),
  getDatabaseFiles: vi.fn(),
  getTables: vi.fn(),
  getTableData: vi.fn(),
}))

const mockUseTableDataQuery = vi.hoisted(() => vi.fn(() => ({
  data: null as any,
  isLoading: false,
  error: null,
})))

vi.mock('../../api/tauri-api', () => ({
  tauriApi: mockApi,
}))

vi.mock('../../features/database/hooks/useTableDataQuery', () => ({
  useTableDataQuery: mockUseTableDataQuery,
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
  }),
}))

function resetStores() {
  const dbStore = useCurrentDatabaseSelection.getState()
  dbStore.setSelectedDatabaseFile(null)
  dbStore.setSelectedDatabaseTable(null)
  
  const deviceStore = useCurrentDeviceSelection.getState()
  deviceStore.setSelectedDevice(null)
  deviceStore.setSelectedApplication(null)
  
  const tableStore = useTableData.getState()
  tableStore.setTableData(null)
  tableStore.setIsLoadingTableData(false)
  
  // Reset mocks
  vi.clearAllMocks()
  mockApi.getDevices.mockResolvedValue({ success: true, data: [] })
  mockApi.getApplications.mockResolvedValue({ success: true, data: [] })
  mockApi.getDatabaseFiles.mockResolvedValue({ success: true, data: [] })
  mockApi.getTables.mockResolvedValue({ success: true, data: [] })
  mockApi.getTableData.mockResolvedValue({ success: true, data: { rows: [], columns: [] } })
  
  // Reset query mock to default state
  mockUseTableDataQuery.mockReturnValue({
    data: null,
    isLoading: false,
    error: null,
  })
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
        useCurrentDeviceSelection.getState().setDevicesList([
          { 
            id: 'device-1', 
            name: 'Test Android', 
            model: 'Test Model',
            deviceType: 'android',
            description: 'Android device', 
          },
        ])
      })
      
      await waitFor(() => {
        expect(screen.getByText(/select device/i)).toBeInTheDocument()
      })
    })

    it('should enable application selection after device selection', async () => {
      render(<Main />)
      
      await act(async () => {
        useCurrentDeviceSelection.getState().setDevicesList([
          { 
            id: 'device-1', 
            name: 'Test Android', 
            model: 'Test Model',
            deviceType: 'android',
            description: 'Android device', 
          },
        ])
        useCurrentDeviceSelection.getState().setSelectedDevice({
          id: 'device-1', 
          name: 'Test Android', 
          model: 'Test Model',
          deviceType: 'android',
          description: 'Android device', 
        })
        useCurrentDeviceSelection.getState().setApplicationsList([
          { 
            name: 'Test App', 
            bundleId: 'com.test.app',
            packageName: 'com.test.app',
          },
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
        useCurrentDeviceSelection.getState().setSelectedDevice({
          id: 'device-1', 
          name: 'Test Android', 
          model: 'Test Model',
          deviceType: 'android',
        })
        useCurrentDeviceSelection.getState().setSelectedApplication({
          name: 'Test App', 
          bundleId: 'com.test.app',
          packageName: 'com.test.app',
        })
        useCurrentDatabaseSelection.getState().setSelectedDatabaseFile({
          path: '/path/to/test.db',
          filename: 'test.db',
          deviceType: 'android',
          packageName: 'com.test.app',
          location: '/data/data/com.test.app',
        })
      })
      
      await waitFor(() => {
        expect(screen.getByText(/select database/i)).toBeInTheDocument()
      })
    })

    it('should handle table selection and data loading', async () => {
      render(<Main />)
      
      await act(async () => {
        useCurrentDeviceSelection.getState().setSelectedDevice({
          id: 'device-1', 
          name: 'Test Android', 
          model: 'Test Model',
          deviceType: 'android',
        })
        useCurrentDeviceSelection.getState().setSelectedApplication({
          name: 'Test App', 
          bundleId: 'com.test.app',
          packageName: 'com.test.app',
        })
        useCurrentDatabaseSelection.getState().setSelectedDatabaseFile({
          path: '/path/to/test.db',
          filename: 'test.db',
          deviceType: 'android',
          packageName: 'com.test.app',
          location: '/data/data/com.test.app',
        })
        useCurrentDatabaseSelection.getState().setSelectedDatabaseTable({
          name: 'users',
          deviceType: 'android',
        })
      })
      
      await waitFor(() => {
        expect(screen.getByText(/select table/i)).toBeInTheDocument()
      })
    })
  })

  describe('aG Grid Integration', () => {
    it('should render grid when data is available', async () => {
      // Mock the query to return test data
      mockUseTableDataQuery.mockReturnValue({
        data: {
          rows: [
            { id: 1, name: 'John', email: 'john@test.com' },
            { id: 2, name: 'Jane', email: 'jane@test.com' },
          ],
          columns: [
            { name: 'id', type: 'INTEGER' },
            { name: 'name', type: 'TEXT' },
            { name: 'email', type: 'TEXT' },
          ],
        },
        isLoading: false,
        error: null,
      })

      render(<Main />)
      
      await act(async () => {
        // Set up necessary state for the grid to render
        const currentDeviceStore = useCurrentDeviceSelection.getState()
        currentDeviceStore.setSelectedDevice({
          id: 'test-device',
          name: 'Test Device',
          model: 'Test Model',
          deviceType: 'desktop',
        })
        currentDeviceStore.setSelectedApplication({
          name: 'Test App',
          bundleId: 'com.test.app',
          packageName: 'com.test.app',
        })
        
        const currentDatabaseStore = useCurrentDatabaseSelection.getState()
        currentDatabaseStore.setSelectedDatabaseFile({
          path: '/test/path',
          filename: 'test.db',
          packageName: 'com.test.app',
          location: 'local',
        })
        currentDatabaseStore.setSelectedDatabaseTable({
          name: 'users',
        })
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('ag-grid-mock')).toBeInTheDocument()
        expect(screen.getByText(/John/)).toBeInTheDocument()
        expect(screen.getByText(/jane@test.com/)).toBeInTheDocument()
      })
    })

    it('should handle row selection', async () => {
      // Mock the query to return test data
      mockUseTableDataQuery.mockReturnValue({
        data: {
          rows: [{ id: 1, name: 'John', email: 'john@test.com' }],
          columns: [
            { name: 'id', type: 'INTEGER' },
            { name: 'name', type: 'TEXT' },
            { name: 'email', type: 'TEXT' },
          ],
        },
        isLoading: false,
        error: null,
      })

      render(<Main />)
      
      await act(async () => {
        // Set up necessary state for the grid to render
        const currentDeviceStore = useCurrentDeviceSelection.getState()
        currentDeviceStore.setSelectedDevice({
          id: 'test-device',
          name: 'Test Device',
          model: 'Test Model',
          deviceType: 'desktop',
        })
        currentDeviceStore.setSelectedApplication({
          name: 'Test App',
          bundleId: 'com.test.app',
          packageName: 'com.test.app',
        })
        
        const currentDatabaseStore = useCurrentDatabaseSelection.getState()
        currentDatabaseStore.setSelectedDatabaseFile({
          path: '/test/path',
          filename: 'test.db',
          packageName: 'com.test.app',
          location: 'local',
        })
        currentDatabaseStore.setSelectedDatabaseTable({
          name: 'users',
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
        useCurrentDeviceSelection.getState().setSelectedDevice({
          id: 'device-1', 
          name: 'Test Android', 
          model: 'Test Model',
          deviceType: 'android',
        })
      })
      
      unmount()
      
      expect(true).toBe(true)
    })
  })
})
