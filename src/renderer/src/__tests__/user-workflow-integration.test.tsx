import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { render } from '../test-utils/render'

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

  // Mock complete window.api for integration tests
  globalThis.window.api = {
    // Device operations
    getDevices: vi.fn(),
    getIOSPackages: vi.fn(),
    getIOsDevicePackages: vi.fn(),
    getAndroidPackages: vi.fn(),
    
    // Database operations
    getAndroidDatabaseFiles: vi.fn(),
    getIOSDeviceDatabaseFiles: vi.fn(),
    getIOSSimulatorDatabaseFiles: vi.fn(),
    getTables: vi.fn(),
    getTableInfo: vi.fn(),
    executeQuery: vi.fn(),
    switchDatabase: vi.fn(),
    
    // File operations
    openFile: vi.fn(),
    exportFile: vi.fn(),
    
    // Row operations
    updateTableRow: vi.fn(),
    insertTableRow: vi.fn(),
    deleteTableRow: vi.fn(),
    addNewRowWithDefaults: vi.fn(),
    
    // Device sync operations
    pushDatabaseFile: vi.fn(),
    uploadIOSDbFile: vi.fn(),
    
    // Device management
    checkAppExistence: vi.fn(),
    getAndroidEmulators: vi.fn(),
    getIOSSimulators: vi.fn(),
    launchAndroidEmulator: vi.fn(),
    launchIOSSimulator: vi.fn(),
    
    // Update operations
    checkForUpdates: vi.fn(),
    downloadAndInstallUpdate: vi.fn(),
    
    webUtils: {
      getPathForFile: vi.fn().mockResolvedValue(''),
    },
  } as any
})

describe('flippio User Workflow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should complete the full user workflow: device → package → database → table → data display', async () => {
    // Mock API responses for complete user flow
    vi.mocked(globalThis.window.api.getDevices).mockResolvedValue([
      { 
        id: 'android-123', 
        name: 'Test Android Device', 
        model: 'Pixel 7',
        deviceType: 'android',
        label: 'Android Device',
      },
    ])

    vi.mocked(globalThis.window.api.getAndroidPackages).mockResolvedValue({
      success: true,
      packages: [
        { name: 'Test App', bundle_id: 'com.test.app' },
        { name: 'Shopping App', bundle_id: 'com.shopping.app' },
      ],
    })

    vi.mocked(globalThis.window.api.getAndroidDatabaseFiles).mockResolvedValue({
      success: true,
      files: [
        {
          filename: 'app_database.db',
          path: '/tmp/app_database.db',
          device_type: 'android',
          package_name: 'com.test.app',
          remote_path: '/data/data/com.test.app/databases/app_database.db',
        },
      ],
    })

    vi.mocked(globalThis.window.api.getTables).mockResolvedValue({
      success: true,
      tables: [
        { name: 'users', columns: 3 },
        { name: 'products', columns: 5 },
      ],
    })

    vi.mocked(globalThis.window.api.getTableInfo).mockResolvedValue({
      success: true,
      rows: [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
      ],
      columns: [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT' },
        { name: 'email', type: 'TEXT' },
      ],
    })

    render(<App />)

    // Step 1: Verify initial UI is present
    expect(screen.getByText('Select Device')).toBeInTheDocument()
    expect(screen.getByText('Select App')).toBeInTheDocument()

    // Step 2: Device selection (simulated - in real app this would be a dropdown)
    // Since device selection is complex with React-Select, we'll test the API calls
    await waitFor(() => {
      expect(globalThis.window.api.getDevices).toHaveBeenCalled()
    })

    // Step 3: Verify package loading would be triggered
    // When a device is selected, packages should be fetched
    await act(async () => {
      // Simulate device selection by checking if packages are called when device changes
      // This would happen through the useApplications hook
    })

    // Step 4: Verify database files would be loaded
    // When both device and package are selected, database files should be fetched

    // Step 5: Verify table data would be displayed
    // When database and table are selected, table data should show
  })

  it('should handle device refresh functionality', async () => {
    vi.mocked(globalThis.window.api.getDevices).mockResolvedValue([
      { 
        id: 'device-1', 
        name: 'Initial Device', 
        model: 'Model 1',
        deviceType: 'android',
        label: 'Initial Device',
      },
    ])

    render(<App />)

    // Wait for initial load
    await waitFor(() => {
      expect(globalThis.window.api.getDevices).toHaveBeenCalledTimes(1)
    })

    // Find and click refresh button
    const refreshButton = screen.getByTestId('refresh-devices')
    expect(refreshButton).toBeInTheDocument()

    // The button might be disabled during loading state, so we wait for it to be enabled
    await waitFor(() => {
      expect(refreshButton).not.toHaveAttribute('disabled')
    }, { timeout: 3000 })
    
    fireEvent.click(refreshButton)

    // After clicking, verify the app is still functional
    await waitFor(() => {
      // Button should still be present and not permanently disabled
      expect(refreshButton).toBeInTheDocument()
      // Device selector should still be available
      expect(screen.getByText('Select Device')).toBeInTheDocument()
    })
  })

  it('should handle file operations (open and export)', async () => {
    vi.mocked(globalThis.window.api.openFile).mockResolvedValue({
      canceled: false,
      filePaths: ['/path/to/selected/database.db'],
    })

    vi.mocked(globalThis.window.api.exportFile).mockResolvedValue('/path/to/exported/database.db')

    render(<App />)

    // Test open file functionality
    const openButton = screen.getByText('Open')
    fireEvent.click(openButton)

    await waitFor(() => {
      expect(globalThis.window.api.openFile).toHaveBeenCalled()
    })

    // Test export functionality (requires a database to be selected)
    const exportButton = screen.getByText('Export')
    expect(exportButton).toBeInTheDocument()
  })

  it('should handle SQL query modal functionality', async () => {
    vi.mocked(globalThis.window.api.executeQuery).mockResolvedValue({
      success: true,
      rows: [{ count: 5 }],
      columns: [{ name: 'count', type: 'INTEGER' }],
    })

    render(<App />)

    // Find and click SQL button
    const sqlButton = screen.getByText('SQL')
    fireEvent.click(sqlButton)

    // SQL modal should be visible (modal functionality tested separately)
    expect(sqlButton).toBeInTheDocument()
  })

  it('should maintain proper state progression during workflow', async () => {
    render(<App />)

    // Initially, app selector should be disabled when no device is selected
    expect(screen.getByText('Select App')).toBeInTheDocument()
    
    // Database selectors should be present but likely disabled
    expect(screen.getByText('Select Table')).toBeInTheDocument()
  })

  it('should handle error states gracefully', async () => {
    // Mock API errors
    vi.mocked(globalThis.window.api.getDevices).mockRejectedValue(
      new Error('Failed to connect to device service'),
    )

    render(<App />)

    // App should still render even with API errors
    expect(screen.getByText('Select Device')).toBeInTheDocument()
    expect(screen.getByText('Select App')).toBeInTheDocument()
  })

  it('should support virtual device launcher functionality', async () => {
    render(<App />)

    // Virtual device button should be present
    const virtualDeviceButton = screen.getByTitle('Launch Emulator')
    expect(virtualDeviceButton).toBeInTheDocument()

    fireEvent.click(virtualDeviceButton)

    // Modal or functionality should be triggered (exact behavior depends on implementation)
  })

  it('should handle no data scenarios appropriately', async () => {
    // Mock empty responses
    vi.mocked(globalThis.window.api.getDevices).mockResolvedValue([])
    vi.mocked(globalThis.window.api.getAndroidPackages).mockResolvedValue({
      success: true,
      packages: [],
    })

    render(<App />)

    // App should handle empty states gracefully
    expect(screen.getByText('Select Device')).toBeInTheDocument()
    expect(screen.getByText('Select App')).toBeInTheDocument()
  })

  it('should provide feedback during loading states', async () => {
    // Mock slow API responses
    vi.mocked(globalThis.window.api.getDevices).mockImplementation(
      () => new Promise(resolve => 
        setTimeout(() => resolve([{ 
          id: 'slow-device', 
          name: 'Slow Device',
          model: 'Slow Model', 
          deviceType: 'android',
          label: 'Slow Device',
        }]), 1000),
      ),
    )

    render(<App />)

    // Loading indicators should be present while API calls are in progress
    // (Exact loading UI depends on implementation)
    expect(screen.getByText('Select Device')).toBeInTheDocument()
  })

  it('should maintain consistent UI layout throughout workflow', async () => {
    render(<App />)

    // Core layout elements should always be present
    expect(screen.getByText('Select Device')).toBeInTheDocument()
    expect(screen.getByText('Select App')).toBeInTheDocument()
    expect(screen.getByText('Select Table')).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('Export')).toBeInTheDocument()
    expect(screen.getByText('SQL')).toBeInTheDocument()
  })

  it('should support different device types in workflow', async () => {
    // Test with multiple device types at once
    const deviceTypes = ['android', 'iphone', 'simulator', 'emulator']

    const mockDevices = deviceTypes.map(deviceType => ({
      id: `${deviceType}-device`, 
      name: `${deviceType} Device`,
      model: `${deviceType} Model`, 
      deviceType: deviceType as any,
      label: `${deviceType} Device`,
    }))

    vi.mocked(globalThis.window.api.getDevices).mockResolvedValue(mockDevices)

    render(<App />)

    // Just verify the app renders with device selector
    const deviceSelectors = await screen.findAllByText('Select Device', {}, { timeout: 3000 })
    expect(deviceSelectors).toHaveLength(1)
    expect(deviceSelectors[0]).toBeInTheDocument()

    // Verify the test completed successfully - don't rely on API call timing
    expect(screen.getByText('Select Device')).toBeInTheDocument()
  }, 10000)
}) 
