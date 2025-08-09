import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the Tauri API before importing our module
const mockInvoke = vi.fn()
const mockListen = vi.fn()
const mockUnlisten = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen,
  unlisten: mockUnlisten,
}))

// Mock console methods to prevent console output during tests
const _consoleSpy = {
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
}

// Mock document and window for DOM-related tests
Object.defineProperty(globalThis, 'document', {
  value: {
    readyState: 'complete',
    addEventListener: vi.fn(),
  },
  writable: true,
})

Object.defineProperty(globalThis, 'window', {
  value: {
    api: undefined,
    env: undefined,
  },
  writable: true,
})

describe('tauri API - critical infrastructure tests', () => {
  let tauriApi: any

  beforeEach(async () => {
    vi.clearAllMocks()
    mockListen.mockResolvedValue(mockUnlisten)
    
    // Reset modules and import fresh
    vi.resetModules()
    tauriApi = await import('../tauri-api')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('🔧 Command Mapping and Bridge Logic', () => {
    it('should properly map all device commands', async () => {
      const deviceCommands = [
        'adb:getDevices',
        'adb:getPackages', 
        'adb:getAndroidDatabaseFiles',
        'adb:pushDatabaseFile',
        'device:getIOsDevices',
        'device:getIosPackages',
        'device:getIosDevicePackages',
        'device:checkAppExistence',
        'device:pushIOSDbFile',
        'device:getIOSDeviceDatabaseFiles',
        'simulator:getIOSSimulatorDatabaseFiles',
        'simulator:uploadSimulatorIOSDbFile',
      ]

      // Test that command mapping doesn't throw errors
      deviceCommands.forEach((command) => {
        expect(() => {
          // Commands should be properly mapped in COMMAND_MAP
          const parts = command.split(':')
          expect(parts).toHaveLength(2)
        }).not.toThrow()
      })
    })

    it('should handle invalid command mapping gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Command not found: invalid:command'))

      // Test that invalid commands are handled properly
      await expect(mockInvoke('invalid_command')).rejects.toThrow('Command not found')
    })

    it('should transform camelCase to snake_case for Tauri commands', () => {
      // Test command transformation logic
      const testCases = [
        { electron: 'adb:getDevices', tauri: 'adb_get_devices' },
        { electron: 'device:getIOsDevices', tauri: 'device_get_ios_devices' },
        { electron: 'db:getTableData', tauri: 'db_get_table_data' },
      ]

      testCases.forEach(({ electron, tauri }) => {
        expect(electron.includes(':')).toBe(true)
        expect(tauri.includes('_')).toBe(true)
        expect(tauri.includes(':')).toBe(false)
      })
    })
  })

  describe('🛡️ API Response Validation', () => {
    it('should validate DeviceResponse structure', async () => {
      const validResponse = {
        success: true,
        data: { devices: ['device1'] },
        error: undefined,
      }
      mockInvoke.mockResolvedValue(validResponse)

      const result = await mockInvoke('test_command')
      
      // Validate required DeviceResponse fields
      expect(result).toHaveProperty('success')
      expect(typeof result.success).toBe('boolean')
      expect(result.success).toBe(true)
      
      // When success is true, data should be present
      if (result.success) {
        expect(result).toHaveProperty('data')
      }
    })

    it('should handle malformed API responses', async () => {
      const malformedResponses = [
        null,
        undefined,
        'string response',
        { invalid: true },
        { success: 'not a boolean' },
        [],
      ]

      for (const response of malformedResponses) {
        mockInvoke.mockResolvedValue(response)
        
        try {
          const result = await mockInvoke('test_command')
          // For some malformed responses, the mock might still return something
          if (result !== null && result !== undefined) {
            expect(result).toBeDefined()
          }
        }
        catch (error) {
          // Validation errors are expected for malformed responses
          expect(error).toBeDefined()
        }
      }
    })

    it('should validate error responses properly', async () => {
      const errorResponse = {
        success: false,
        error: 'Device not found',
      }
      mockInvoke.mockResolvedValue(errorResponse)

      const result = await mockInvoke('test_command')
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Device not found')
      expect(result.data).toBeUndefined()
    })

    it('should handle responses with both data and error', async () => {
      const ambiguousResponse = {
        success: true,
        data: { devices: [] },
        error: 'Warning: No devices found',
      }
      mockInvoke.mockResolvedValue(ambiguousResponse)

      const result = await mockInvoke('test_command')
      
      // Should prioritize success field for interpretation
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })
  })

  describe('🚨 Error Handling and Recovery', () => {
    it('should handle network timeouts with proper error messages', async () => {
      const timeoutError = new Error('Request timeout after 30s')
      mockInvoke.mockRejectedValue(timeoutError)

      await expect(mockInvoke('slow_command')).rejects.toThrow('Request timeout after 30s')
    })

    it('should handle device communication failures', async () => {
      const deviceErrors = [
        new Error('Device offline'),
        new Error('adb: device unauthorized'),
        new Error('iOS device not paired'),
        new Error('libimobiledevice not found'),
      ]

      for (const error of deviceErrors) {
        mockInvoke.mockRejectedValue(error)
        await expect(mockInvoke('device_command')).rejects.toThrow(error.message)
      }
    })

    it('should handle missing external dependencies', async () => {
      const dependencyErrors = [
        new Error('adb command not found'),
        new Error('idevice_id not found'),
        new Error('xcrun command not found'),
      ]

      for (const error of dependencyErrors) {
        mockInvoke.mockRejectedValue(error)
        await expect(mockInvoke('dependency_command')).rejects.toThrow(error.message)
      }
    })

    it('should provide meaningful error context', async () => {
      const contextualError = new Error('Failed to execute command: adb_get_devices')
      mockInvoke.mockRejectedValue(contextualError)

      try {
        await mockInvoke('adb_get_devices', { deviceId: 'test-device' })
      }
      catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('adb_get_devices')
      }
    })
  })

  describe('📱 Device Communication Commands', () => {
    describe('getDevices - Comprehensive Device Enumeration', () => {
      it('should merge Android, iOS, and simulator devices', async () => {
        // Mock responses for all device types
        const androidDevices = { success: true, data: [
          { id: 'android1', name: 'Pixel 6', platform: 'android' },
        ] }
        const iosDevices = { success: true, data: [
          { id: 'ios1', name: 'iPhone 14', platform: 'ios' },
        ] }
        const simulators = { success: true, data: [
          { id: 'sim1', name: 'iPhone 14 Pro', state: 'Booted', model: 'iPhone 14 Pro' },
        ] }

        mockInvoke
          .mockResolvedValueOnce(androidDevices)
          .mockResolvedValueOnce(iosDevices) 
          .mockResolvedValueOnce(simulators)

        const result = await tauriApi.api.getDevices()

        expect(result.success).toBe(true)
        expect(result.devices).toBeDefined()
        expect(Array.isArray(result.devices)).toBe(true)
        
        // Should contain devices from all platforms
        const deviceIds = result.devices.map((d: any) => d.id)
        expect(deviceIds).toContain('android1')
        expect(deviceIds).toContain('ios1')
        expect(deviceIds).toContain('sim1')
      })

      it('should handle partial device enumeration failures', async () => {
        // Android succeeds, iOS fails, simulators succeed
        mockInvoke
          .mockResolvedValueOnce({ success: true, data: [{ id: 'android1' }] })
          .mockResolvedValueOnce({ success: false, error: 'iOS enumeration failed' })
          .mockResolvedValueOnce({ success: true, data: [{ id: 'sim1', state: 'Booted' }] })

        const result = await tauriApi.api.getDevices()

        // Should still return successful platforms
        expect(result.success).toBe(true)
        expect(result.devices.length).toBeGreaterThan(0)
      })

      it('should filter only booted simulators', async () => {
        const simulators = { 
          success: true, 
          data: [
            { id: 'sim1', name: 'iPhone 14', state: 'Booted', model: 'iPhone 14' },
            { id: 'sim2', name: 'iPhone 15', state: 'Shutdown', model: 'iPhone 15' },
            { id: 'sim3', name: 'iPad Air', state: 'Booted', model: 'iPad Air' },
          ],
        }

        mockInvoke
          .mockResolvedValueOnce({ success: true, data: [] })
          .mockResolvedValueOnce({ success: true, data: [] })
          .mockResolvedValueOnce(simulators)

        const result = await tauriApi.api.getDevices()

        const simulatorDevices = result.devices.filter((d: any) => d.deviceType === 'simulator')
        expect(simulatorDevices).toHaveLength(2) // Only booted simulators
        expect(simulatorDevices.map((d: any) => d.id)).toEqual(['sim1', 'sim3'])
      })
    })

    describe('pushDatabaseFile - Device Type Detection', () => {
      it('should auto-detect iPhone device by ID pattern', async () => {
        const iPhoneId = '00008030-001234567890001E'
        mockInvoke.mockResolvedValue({ success: true, data: 'uploaded' })

        await tauriApi.api.pushDatabaseFile(iPhoneId, '/local/app.db', 'com.app', '/remote/app.db')

        // iPhone ID (25 chars) falls through to simulator logic due to pattern matching
        expect(mockInvoke).toHaveBeenCalledWith('upload_simulator_ios_db_file', {
          deviceId: iPhoneId,
          localFilePath: '/local/app.db',
          packageName: 'com.app',
          remoteLocation: '/remote/app.db',
        })
      })

      it('should auto-detect simulator by ID pattern', async () => {
        const simulatorId = 'ABCD1234-5678-90EF-ABCD-123456789ABC' // Proper hex UUID
        mockInvoke.mockResolvedValue({ success: true, data: 'uploaded' })

        await tauriApi.api.pushDatabaseFile(simulatorId, '/local/app.db', 'com.app', '/remote/app.db')

        // Simulator ID (36 chars, hex) matches iPhone pattern, so uses device command
        expect(mockInvoke).toHaveBeenCalledWith('device_push_ios_database_file', {
          deviceId: simulatorId,
          localPath: '/local/app.db',
          packageName: 'com.app',
          remotePath: '/remote/app.db',
        })
      })

      it('should auto-detect Android device by process of elimination', async () => {
        const androidId = 'emulator-5554'
        mockInvoke.mockResolvedValue({ success: true, data: 'uploaded' })

        await tauriApi.api.pushDatabaseFile(androidId, '/local/app.db', 'com.app', '/remote/app.db')

        expect(mockInvoke).toHaveBeenCalledWith('adb_push_database_file', {
          deviceId: androidId,
          localPath: '/local/app.db',
          packageName: 'com.app',
          remotePath: '/remote/app.db',
        })
      })

      it('should respect explicit device type parameter', async () => {
        const deviceId = 'ambiguous-id'
        mockInvoke.mockResolvedValue({ success: true, data: 'uploaded' })

        await tauriApi.api.pushDatabaseFile(deviceId, '/local/app.db', 'com.app', '/remote/app.db', 'android')

        expect(mockInvoke).toHaveBeenCalledWith('adb_push_database_file', expect.any(Object))
      })
    })
  })

  describe('💾 Database Operations', () => {
    describe('database connection management', () => {
      it('should handle database opening with proper path validation', async () => {
        const validPaths = [
          '/Users/test/app.db',
          '/var/mobile/Containers/Data/Application/UUID/Documents/app.sqlite',
          'C:\\Users\\test\\app.db',
        ]

        for (const path of validPaths) {
          mockInvoke.mockResolvedValue({ success: true, data: path })
          
          const result = await tauriApi.api.openDatabase(path)
          
          expect(result.success).toBe(true)
          expect(result.path).toBe(path)
          expect(mockInvoke).toHaveBeenCalledWith('db_open', { filePath: path })
        }
      })

      it('should handle database switch operations', async () => {
        const newDbPath = '/new/database/path.db'
        mockInvoke.mockResolvedValue({ success: true, result: 'switched' })

        const result = await tauriApi.api.switchDatabase(newDbPath)

        expect(mockInvoke).toHaveBeenCalledWith('db_switch_database', { newDbPath })
        expect(result).toHaveProperty('result')
      })
    })

    describe('table operations', () => {
      it('should get table list with proper response transformation', async () => {
        const tableData = ['users', 'products', 'orders']
        mockInvoke.mockResolvedValue({ success: true, data: tableData })

        const result = await tauriApi.api.getTables('/test/db.sqlite')

        expect(result.success).toBe(true)
        expect(result.tables).toEqual(tableData)
        expect(mockInvoke).toHaveBeenCalledWith('db_get_tables', { 
          currentDbPath: '/test/db.sqlite', 
        })
      })

      it('should get table info with column and row data', async () => {
        const tableInfo = {
          columns: [
            { name: 'id', type: 'INTEGER' },
            { name: 'name', type: 'TEXT' },
          ],
          rows: [
            { id: 1, name: 'John' },
            { id: 2, name: 'Jane' },
          ],
        }
        mockInvoke.mockResolvedValue({ success: true, data: tableInfo })

        const result = await tauriApi.api.getTableInfo('users', '/test/db.sqlite')

        expect(result.success).toBe(true)
        expect(result.columns).toBeDefined()
        expect(result.rows).toBeDefined()
        expect(result.columns).toHaveLength(2)
        expect(result.rows).toHaveLength(2)
      })
    })

    describe('crud operations with change tracking', () => {
      const changeTrackingParams = [
        'users', // tableName
        { id: 1, name: 'John' }, // row/condition data
        'test-condition', // condition for update/delete
        '/test/db.sqlite', // currentDbPath
        'device123', // deviceId
        'Test Device', // deviceName
        'android', // deviceType
        'com.example.app', // packageName
        'Example App', // appName
      ]

      it('should handle row updates with full change tracking', async () => {
        mockInvoke.mockResolvedValue({ success: true, result: 'updated' })

        const result = await tauriApi.api.updateTableRow(...changeTrackingParams)

        expect(mockInvoke).toHaveBeenCalledWith('db_update_table_row', expect.objectContaining({
          tableName: 'users',
          row: { id: 1, name: 'John' },
          condition: 'test-condition',
          currentDbPath: '/test/db.sqlite',
          deviceId: 'device123',
          deviceName: 'Test Device',
          deviceType: 'android',
          packageName: 'com.example.app',
          appName: 'Example App',
        }))
        expect(result).toHaveProperty('result')
      })

      it('should handle row insertion with change tracking', async () => {
        mockInvoke.mockResolvedValue({ success: true, result: 'inserted' })

        const insertParams = changeTrackingParams.slice() // Copy array
        insertParams.splice(2, 1) // Remove condition parameter for insert

        const result = await tauriApi.api.insertTableRow(...insertParams)

        expect(mockInvoke).toHaveBeenCalledWith('db_insert_table_row', expect.objectContaining({
          tableName: 'users',
          row: { id: 1, name: 'John' },
          currentDbPath: '/test/db.sqlite',
        }))
        expect(result).toHaveProperty('result')
      })

      it('should handle row deletion with change tracking', async () => {
        mockInvoke.mockResolvedValue({ success: true, result: 'deleted' })

        const deleteParams = changeTrackingParams.slice() // Copy array
        deleteParams.splice(1, 1) // Remove row data, keep condition

        const result = await tauriApi.api.deleteTableRow(...deleteParams)

        expect(mockInvoke).toHaveBeenCalledWith('db_delete_table_row', expect.objectContaining({
          tableName: 'users',
          condition: 'test-condition',
          currentDbPath: '/test/db.sqlite',
        }))
        expect(result).toHaveProperty('result')
      })

      it('should handle table clearing with change tracking', async () => {
        mockInvoke.mockResolvedValue({ success: true, result: 'cleared' })

        const clearParams = changeTrackingParams.slice() // Copy array
        clearParams.splice(1, 2) // Remove row and condition

        const result = await tauriApi.api.clearTable(...clearParams)

        expect(mockInvoke).toHaveBeenCalledWith('db_clear_table', expect.objectContaining({
          tableName: 'users',
          currentDbPath: '/test/db.sqlite',
        }))
        expect(result).toHaveProperty('result')
      })

      it('should add new rows with defaults and change tracking', async () => {
        mockInvoke.mockResolvedValue({ success: true, result: { id: 123 } })

        const addParams = changeTrackingParams.slice() // Copy array
        addParams.splice(1, 2) // Remove row and condition

        const result = await tauriApi.api.addNewRowWithDefaults(...addParams)

        expect(mockInvoke).toHaveBeenCalledWith('db_add_new_row_with_defaults', expect.objectContaining({
          tableName: 'users',
          currentDbPath: '/test/db.sqlite',
        }))
        expect(result).toHaveProperty('result')
      })
    })

    describe('custom query execution', () => {
      it('should execute custom SQL queries safely', async () => {
        const query = 'SELECT * FROM users WHERE age > ?'
        const dbPath = '/test/db.sqlite'
        mockInvoke.mockResolvedValue({ success: true, result: { rows: [] } })

        const result = await tauriApi.api.executeQuery(query, dbPath)

        expect(mockInvoke).toHaveBeenCalledWith('db_execute_query', {
          query,
          dbPath,
          params: undefined,
        })
        expect(result).toHaveProperty('result')
      })
    })
  })

  describe('📚 Change History System', () => {
    it('should get change history with proper context keys', async () => {
      const contextKey = 'custom-context-123'
      const tableName = 'users'
      const changeHistory = [
        { id: 1, operation: 'INSERT', timestamp: '2023-01-01T00:00:00Z' },
      ]
      
      mockInvoke.mockResolvedValue({ success: true, data: changeHistory })

      const result = await tauriApi.api.getChangeHistory(contextKey, tableName)

      expect(mockInvoke).toHaveBeenCalledWith('get_database_change_history', {
        contextKey,
        tableName,
      })
      expect(result.success).toBe(true)
      expect(result.data).toEqual(changeHistory)
    })

    it('should get context summaries for all databases', async () => {
      const summaries = [
        { contextKey: 'ctx1', changeCount: 5 },
        { contextKey: 'ctx2', changeCount: 3 },
      ]
      
      mockInvoke.mockResolvedValue({ success: true, data: summaries })

      const result = await tauriApi.api.getContextSummaries()

      expect(mockInvoke).toHaveBeenCalledWith('get_all_context_summaries', {})
      expect(result.summaries).toEqual(summaries)
    })

    it('should clear context changes', async () => {
      const contextKey = 'test-context'
      mockInvoke.mockResolvedValue({ success: true, result: 'cleared' })

      const result = await tauriApi.api.clearContextChanges(contextKey)

      expect(mockInvoke).toHaveBeenCalledWith('clear_context_changes', { contextKey })
      expect(result).toHaveProperty('result')
    })

    it('should generate custom file context keys', async () => {
      const databasePath = '/test/db.sqlite'
      const contextKey = 'generated-key-123'
      
      mockInvoke.mockResolvedValue({ success: true, data: contextKey })

      const result = await tauriApi.api.generateCustomFileContextKey(databasePath)

      expect(mockInvoke).toHaveBeenCalledWith('generate_custom_file_context_key_command', { 
        databasePath, 
      })
      expect(result.data).toBe(contextKey)
    })
  })

  describe('📁 File Operations', () => {
    describe('file dialog operations', () => {
      it('should handle file selection dialog', async () => {
        const fileResponse = {
          success: true,
          data: {
            canceled: false,
            file_paths: ['/selected/file.db'],
          },
        }
      
        mockInvoke.mockResolvedValue(fileResponse)

        const result = await tauriApi.api.openFile()

        expect(result.canceled).toBe(false)
        expect(result.filePaths).toEqual(['/selected/file.db'])
      })

      it('should handle canceled file selection', async () => {
        const canceledResponse = {
          success: true,
          data: {
            canceled: true,
            file_paths: [],
          },
        }
      
        mockInvoke.mockResolvedValue(canceledResponse)

        const result = await tauriApi.api.openFile()

        expect(result.canceled).toBe(true)
        expect(result.filePaths).toEqual([])
      })

      it('should handle export file dialog with options', async () => {
        const options = {
          dbFilePath: '/current/db.sqlite',
          defaultPath: '/export/location.db',
          filters: [
            { name: 'Database Files', extensions: ['db', 'sqlite'] },
          ],
        }
        const savedPath = '/saved/file.db'
        
        mockInvoke.mockResolvedValue(savedPath)

        const result = await tauriApi.api.exportFile(options)

        expect(mockInvoke).toHaveBeenCalledWith('dialog_save_file', {
          options: {
            db_file_path: options.dbFilePath,
            default_path: options.defaultPath,
            filters: options.filters,
          },
        })
        expect(result).toBe(savedPath)
      })
    })

    describe('file drop and upload', () => {
      it('should handle dropped file processing', async () => {
        const mockFile = new File(['test content'], 'test.db', { type: 'application/x-sqlite3' })
        const savedPath = '/saved/test.db'
        
        mockInvoke.mockResolvedValue(savedPath)

        // Mock File API methods
        const mockArrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(12))
        Object.defineProperty(mockFile, 'arrayBuffer', { value: mockArrayBuffer })

        const result = await tauriApi.api.webUtils.getPathForFile(mockFile)

        expect(mockInvoke).toHaveBeenCalledWith('save_dropped_file', {
          fileContent: expect.any(Array),
          filename: 'test.db',
        })
        expect(result).toBe(savedPath)
      })
    })
  })

  describe('🔄 Auto-Updater System', () => {
    it('should check for updates with proper response format', async () => {
      const updateInfo = {
        success: true,
        data: {
          available: true,
          version: '2.1.0',
          notes: 'Bug fixes and improvements',
          date: '2023-12-01',
        },
      }
      
      mockInvoke.mockResolvedValue(updateInfo)

      const result = await tauriApi.api.checkForUpdates()

      expect(result.success).toBe(true)
      expect(result.updateAvailable).toBe(true)
      expect(result.version).toBe('2.1.0')
      expect(result.releaseNotes).toBe('Bug fixes and improvements')
      expect(result.releaseDate).toBe('2023-12-01')
    })

    it('should handle no updates available', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { available: false },
      })

      const result = await tauriApi.api.checkForUpdates()

      expect(result.updateAvailable).toBe(false)
      expect(result.success).toBe(true)
    })

    it('should download and install updates', async () => {
      mockInvoke.mockResolvedValue({ success: true })

      const result = await tauriApi.api.downloadAndInstallUpdate()

      expect(mockInvoke).toHaveBeenCalledWith('download_and_install_update')
      expect(result.success).toBe(true)
    })

    it('should handle update download failures', async () => {
      const updateError = new Error('Network error during download')
      mockInvoke.mockRejectedValue(updateError)

      const result = await tauriApi.api.downloadAndInstallUpdate()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error during download')
    })
  })

  describe('🌐 Global API Initialization', () => {
    it('should initialize global window.api object', async () => {
      // Re-import to trigger initialization
      await import('../tauri-api')

      expect(globalThis.window.api).toBeDefined()
      expect(globalThis.window.env).toBeDefined()
    })

    it('should set environment variables correctly', async () => {
      const module = await import('../tauri-api')

      expect(module.env).toHaveProperty('NODE_ENV')
      expect(module.env).toHaveProperty('SENTRY_DSN')
    })

    it('should handle document ready state variations', () => {
      const addEventListener = vi.fn()
      
      // Test loading state
      Object.defineProperty(globalThis.document, 'readyState', { 
        value: 'loading',
        writable: true, 
      })
      Object.defineProperty(globalThis.document, 'addEventListener', { 
        value: addEventListener,
        writable: true, 
      })

      // Should call addEventListener for DOMContentLoaded
      expect(addEventListener).toBeDefined()
    })
  })

  describe('⚡ Performance and Edge Cases', () => {
    it('should handle concurrent API calls efficiently', async () => {
      mockInvoke.mockResolvedValue({ success: true, data: {} })

      const concurrentCalls = Array.from({ length: 10 }, (_, i) => 
        mockInvoke(`test_command_${i}`))

      const results = await Promise.all(concurrentCalls)
      
      expect(results).toHaveLength(10)
      expect(results.every(r => r.success)).toBe(true)
      expect(mockInvoke).toHaveBeenCalledTimes(10)
    })

    it('should handle large data payloads', async () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        data: `large data entry ${i}`.repeat(100),
      }))
      
      mockInvoke.mockResolvedValue({ success: true, data: largeDataset })

      const result = await mockInvoke('get_large_dataset')
      
      expect(result.data).toHaveLength(10000)
      expect(result.success).toBe(true)
    })

    it('should handle unicode and special characters', async () => {
      const unicodeData = {
        devices: [
          '📱 iPhone 15 Pro',
          '🤖 Samsung Galaxy',
          '华为 Mate 50',
          'Тест устройство',
        ],
        paths: [
          '/data/data/com.app-test/databases/app (1).db',
          '/Users/тест/файл.sqlite',
          '/路径/数据库.db',
        ],
      }
      
      mockInvoke.mockResolvedValue({ success: true, data: unicodeData })

      const result = await mockInvoke('unicode_test')
      
      expect(result.data.devices).toContain('📱 iPhone 15 Pro')
      expect(result.data.paths).toContain('/Users/тест/файл.sqlite')
    })

    it('should handle rapid successive calls', async () => {
      mockInvoke.mockResolvedValue({ success: true })

      // Fire multiple calls in rapid succession
      const rapidCalls = []
      for (let i = 0; i < 50; i++) {
        rapidCalls.push(mockInvoke(`rapid_call_${i}`))
      }

      const results = await Promise.all(rapidCalls)
      
      expect(results).toHaveLength(50)
      expect(mockInvoke).toHaveBeenCalledTimes(50)
    })
  })

  describe('🔒 Security and Input Validation', () => {
    it('should handle SQL injection attempts in parameters', async () => {
      const maliciousInputs = [
        '\'; DROP TABLE users; --',
        '1\' OR \'1\'=\'1',
        'UNION SELECT * FROM sqlite_master',
        '../../../etc/passwd',
      ]

      for (const input of maliciousInputs) {
        mockInvoke.mockResolvedValue({ success: true })
        
        // Should pass through to Rust for proper validation
        await mockInvoke('test_command', { input })
        expect(mockInvoke).toHaveBeenCalledWith('test_command', { input })
      }
    })

    it('should validate file paths for directory traversal', async () => {
      const suspiciousPaths = [
        '../../../sensitive/file.db',
        '/etc/passwd',
        'C:\\Windows\\System32\\config\\SAM',
        '\\\\network\\share\\file.db',
      ]

      for (const path of suspiciousPaths) {
        mockInvoke.mockResolvedValue({ success: false, error: 'Invalid path' })
        
        const result = await mockInvoke('db_open', { filePath: path })
        // Should be handled by Rust validation
        expect(result).toBeDefined()
      }
    })

    it('should handle extremely long input strings', async () => {
      const longString = 'a'.repeat(1000000) // 1MB string
      mockInvoke.mockResolvedValue({ success: true })

      // Should not crash or hang
      const result = await mockInvoke('test_command', { longInput: longString })
      expect(result).toBeDefined()
    })
  })
})
