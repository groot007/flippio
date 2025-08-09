// Tauri API wrapper - provides the same interface as Electron preload API
// This allows the frontend to work unchanged between Electron and Tauri

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

// Initialize event system early
async function initializeEventSystem() {
  try {
    // Test basic event functionality to ensure the plugin internals are loaded
    const unlisten = await listen('tauri://test-event', () => {})
    await unlisten()
    console.log('Event system initialized successfully')
  }
  catch (error) {
    console.warn('Event system initialization failed:', error)
  }
}

// Initialize events immediately
initializeEventSystem()

// Types to match the Electron API
interface DeviceResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// Validation utilities for API responses and inputs
class APIValidationError extends Error {
  constructor(message: string, public code: string, public context?: Record<string, any>) {
    super(message)
    this.name = 'APIValidationError'
  }
}

// Validate DeviceResponse structure
function validateDeviceResponse<T>(response: any): DeviceResponse<T> {
  if (!response || typeof response !== 'object') {
    throw new APIValidationError(
      'Invalid API response format: response must be an object',
      'INVALID_RESPONSE_FORMAT',
      { response }
    )
  }
  
  if (typeof response.success !== 'boolean') {
    throw new APIValidationError(
      'Invalid API response: missing or invalid success field',
      'MISSING_SUCCESS_FIELD',
      { response }
    )
  }
  
  // Validate that error responses don't have data
  if (response.success === false && response.data !== undefined) {
    console.warn('API response has both error and data fields:', response)
  }
  
  // Validate that successful responses have appropriate data
  if (response.success === true && response.data === undefined && response.error) {
    console.warn('API response marked as successful but contains error:', response)
  }
  
  return response as DeviceResponse<T>
}

// Validate input parameters
function validateInput(value: any, fieldName: string, options: {
  required?: boolean
  type?: 'string' | 'number' | 'boolean' | 'object'
  pattern?: RegExp
  maxLength?: number
} = {}): void {
  const { required = false, type, pattern, maxLength } = options
  
  if (required && (value === undefined || value === null)) {
    throw new APIValidationError(
      `Required field '${fieldName}' is missing`,
      'MISSING_REQUIRED_FIELD',
      { fieldName, value }
    )
  }
  
  if (value !== undefined && value !== null) {
    if (type && typeof value !== type) {
      throw new APIValidationError(
        `Field '${fieldName}' must be of type ${type}, got ${typeof value}`,
        'INVALID_FIELD_TYPE',
        { fieldName, expectedType: type, actualType: typeof value, value }
      )
    }
    
    if (pattern && typeof value === 'string' && !pattern.test(value)) {
      throw new APIValidationError(
        `Field '${fieldName}' does not match required pattern`,
        'PATTERN_MISMATCH',
        { fieldName, pattern: pattern.toString(), value }
      )
    }
    
    if (maxLength && typeof value === 'string' && value.length > maxLength) {
      throw new APIValidationError(
        `Field '${fieldName}' exceeds maximum length of ${maxLength}`,
        'FIELD_TOO_LONG',
        { fieldName, maxLength, actualLength: value.length }
      )
    }
  }
}

// Retry logic for critical commands
async function withRetry<T>(
  fn: () => Promise<T>, 
  options: {
    maxRetries?: number
    baseDelay?: number
    maxDelay?: number
    retryOn?: (error: Error) => boolean
  } = {}
): Promise<T> {
  const { 
    maxRetries = 3, 
    baseDelay = 1000, 
    maxDelay = 10000,
    retryOn = () => true 
  } = options
  
  let lastError: Error
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      if (attempt === maxRetries || !retryOn(lastError)) {
        break
      }
      
      const delay = Math.min(baseDelay * (2 ** attempt), maxDelay)
      console.warn(`API call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, lastError.message)
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw new APIValidationError(
    `API call failed after ${maxRetries + 1} attempts: ${lastError.message}`,
    'MAX_RETRIES_EXCEEDED',
    { maxRetries, lastError: lastError.message }
  )
}

// Command name mapping - Tauri uses snake_case, Electron uses camelCase
const COMMAND_MAP = {
  // Device commands
  'adb:getDevices': 'adb_get_devices',
  'adb:getPackages': 'adb_get_packages',
  'adb:getAndroidDatabaseFiles': 'adb_get_android_database_files',
  'adb:pushDatabaseFile': 'adb_push_database_file',
  'device:getIOsDevices': 'device_get_ios_devices',
  'device:getIosPackages': 'device_get_ios_packages',
  'device:getIosDevicePackages': 'device_get_ios_device_packages',
  'device:checkAppExistence': 'device_check_app_existence',
  'device:pushIOSDbFile': 'device_push_ios_database_file',
  'device:getIOSDeviceDatabaseFiles': 'get_ios_device_database_files',
  'simulator:getIOSSimulatorDatabaseFiles': 'get_ios_simulator_database_files',
  'simulator:uploadSimulatorIOSDbFile': 'upload_simulator_ios_db_file',

  // Virtual device commands
  'getAndroidEmulators': 'get_android_emulators',
  'getIOSSimulators': 'get_ios_simulators',
  'launchAndroidEmulator': 'launch_android_emulator',
  'launchIOSSimulator': 'launch_ios_simulator',

  // Database commands
  'db:open': 'db_open',
  'db:getTables': 'db_get_tables',
  'db:getTableData': 'db_get_table_data',
  'db:getInfo': 'db_get_info',
  'db:updateTableRow': 'db_update_table_row',
  'db:insertTableRow': 'db_insert_table_row',
  'db:addNewRowWithDefaults': 'db_add_new_row_with_defaults',
  'db:deleteTableRow': 'db_delete_table_row',
  'db:clearTable': 'db_clear_table',
  'db:executeQuery': 'db_execute_query',
  'db:switchDatabase': 'db_switch_database',

  // Change history commands
  'db:getChangeHistory': 'get_database_change_history',
  'db:getContextSummaries': 'get_all_context_summaries',
  'db:getChangeHistoryDiagnostics': 'get_change_history_diagnostics',
  'db:clearContextChanges': 'clear_context_changes',
  'db:clearAllChangeHistory': 'clear_all_change_history',
  'db:generateCustomFileContextKey': 'generate_custom_file_context_key_command',

  // Common commands
  'dialog:selectFile': 'dialog_select_file',
  'dialog:saveFile': 'dialog_save_file',
}

// Helper function for commands that need to preserve Electron-style response structure
async function invokeCommandWithResponse<T>(electronCommand: string, dataFieldName: string, ...args: any[]): Promise<{ success: boolean, [key: string]: any }> {
  console.log('🔍 [invokeCommandWithResponse] Called with:', { electronCommand, dataFieldName, args })
  
  // Validate inputs
  validateInput(electronCommand, 'electronCommand', { required: true, type: 'string', maxLength: 100 })
  validateInput(dataFieldName, 'dataFieldName', { required: true, type: 'string', maxLength: 50 })
  
  const tauriCommand = COMMAND_MAP[electronCommand as keyof typeof COMMAND_MAP]
  if (!tauriCommand) {
    console.error('🔍 [invokeCommandWithResponse] Command not found:', electronCommand)
    throw new APIValidationError(
      `Command not found: ${electronCommand}`,
      'COMMAND_NOT_FOUND',
      { electronCommand, availableCommands: Object.keys(COMMAND_MAP) }
    )
  }

  console.log('🔍 [invokeCommandWithResponse] Mapped to Tauri command:', tauriCommand)

  // Use retry logic for critical device communication commands
  const isDeviceCommand = electronCommand.includes('device:') || electronCommand.includes('adb:')
  const retryOptions = isDeviceCommand ? {
    maxRetries: 2,
    baseDelay: 500,
    retryOn: (error: Error) => {
      // Retry on network errors but not on validation errors
      return !error.message.includes('validation') && 
             !error.message.includes('unauthorized') &&
             !error.message.includes('not found')
    }
  } : { maxRetries: 0 }

  return await withRetry(async () => {
    try {
      // Create proper parameter object based on command
      const parameters: Record<string, any> = {}
      const paramNames = getParameterNames(tauriCommand)
      console.log('🔍 [invokeCommandWithResponse] Parameter names:', paramNames)

      for (let i = 0; i < args.length && i < paramNames.length; i++) {
        if (args[i] !== undefined) {
          parameters[paramNames[i]] = args[i]
        }
      }

      console.log(`🔍 [invokeCommandWithResponse] Invoking ${tauriCommand} with parameters:`, parameters)
      const response = await invoke<DeviceResponse<T>>(tauriCommand, parameters)
      console.log(`🔍 [invokeCommandWithResponse] Raw response from ${tauriCommand}:`, response)

      // Validate the response structure
      const validatedResponse = validateDeviceResponse<T>(response)

      if (validatedResponse.success) {
        const result = { success: true, [dataFieldName]: validatedResponse.data }
        console.log(`🔍 [invokeCommandWithResponse] Formatted result:`, result)
        return result
      }
      else {
        console.error(`🔍 [invokeCommandWithResponse] Command failed:`, validatedResponse.error)
        return { success: false, error: validatedResponse.error || 'Unknown error occurred' }
      }
    }
    catch (error) {
      console.error(`🔍 [invokeCommandWithResponse] Exception invoking ${tauriCommand}:`, error)
      
      // Re-throw APIValidationErrors as-is
      if (error instanceof APIValidationError) {
        throw error
      }
      
      // Wrap other errors
      throw new APIValidationError(
        `Failed to execute command ${tauriCommand}: ${(error as Error).message}`,
        'COMMAND_EXECUTION_FAILED',
        { tauriCommand, electronCommand, originalError: (error as Error).message }
      )
    }
  }, retryOptions)
}

// Parameter name mapping for Tauri commands (matches Rust function signatures)
function getParameterNames(command: string): string[] {
  const paramMap: Record<string, string[]> = {
    // Device commands
    adb_get_devices: [], // No parameters
    adb_get_packages: ['deviceId'],
    adb_get_android_database_files: ['deviceId', 'packageName'],
    adb_push_database_file: ['deviceId', 'localPath', 'packageName', 'remotePath'],
    device_push_ios_database_file: ['deviceId', 'localPath', 'packageName', 'remotePath'],
    device_get_ios_packages: ['deviceId'],
    device_get_ios_device_packages: ['deviceId'],
    get_ios_device_database_files: ['deviceId', 'packageName'],
    get_ios_simulator_database_files: ['deviceId', 'packageName'],
    device_check_app_existence: ['deviceId', 'packageName'],
    upload_simulator_ios_db_file: ['deviceId', 'localFilePath', 'packageName', 'remoteLocation'],
    launch_android_emulator: ['emulatorId'],
    launch_ios_simulator: ['simulatorId'],
    get_android_emulators: [],
    get_ios_simulators: [],

    // Database commands
    db_open: ['filePath'],
    db_get_tables: ['currentDbPath'],
    db_get_table_data: ['tableName', 'currentDbPath'],
    db_get_info: ['filePath'],
    db_update_table_row: ['tableName', 'row', 'condition', 'currentDbPath', 'deviceId', 'deviceName', 'deviceType', 'packageName', 'appName'],
    db_insert_table_row: ['tableName', 'row', 'currentDbPath', 'deviceId', 'deviceName', 'deviceType', 'packageName', 'appName'],
    db_add_new_row_with_defaults: ['tableName', 'currentDbPath', 'deviceId', 'deviceName', 'deviceType', 'packageName', 'appName'],
    db_delete_table_row: ['tableName', 'condition', 'currentDbPath', 'deviceId', 'deviceName', 'deviceType', 'packageName', 'appName'],
    db_clear_table: ['tableName', 'currentDbPath', 'deviceId', 'deviceName', 'deviceType', 'packageName', 'appName'],
    db_execute_query: ['query', 'dbPath', 'params'],
    db_switch_database: ['newDbPath'],

    // Change history commands
    get_database_change_history: ['contextKey', 'tableName'],
    get_all_context_summaries: [],
    get_change_history_diagnostics: [],
    clear_context_changes: ['contextKey'],
    clear_all_change_history: [],
    generate_custom_file_context_key_command: ['databasePath'],

    // Common commands
    get_app_path: [],
    open_external: ['url'],
    show_item_in_folder: ['path'],
    dialog_open_file: ['options'],
    dialog_save_file: ['options'],
  }
  return paramMap[command] || []
}

// API object that matches the Electron preload API exactly
export const api = {
  // Device methods
  // Returns all devices: Android, iOS simulators, iPhone devices, and running emulators
  getDevices: async () => {
    try {
      // Fetch physical Android devices
      const androidResp = await invokeCommandWithResponse('adb:getDevices', 'devices')
      // Fetch physical iOS devices (simulators and physical)
      const iosResp = await invokeCommandWithResponse('device:getIOsDevices', 'devices')
      // Fetch iOS simulators
      const iosSimulatorsResp = await invokeCommandWithResponse('getIOSSimulators', 'simulators')

      const allDevices = []

      // Add physical Android devices with labels
      if (androidResp.success && androidResp.devices) {
        androidResp.devices.forEach((device: any) => {
          allDevices.push({
            ...device,
            label: `${device.name || device.id}`,
            description: device.description || 'Android',
          })
        })
      }

      // Add physical iOS devices with labels
      if (iosResp.success && iosResp.devices) {
        iosResp.devices.forEach((device: any) => {
          allDevices.push({
            ...device,
            label: `${device.name || device.id}`,
            description: 'iPhone Device',
          })
        })
      }

      // Add iOS simulators (only booted ones)
      if (iosSimulatorsResp.success && iosSimulatorsResp.simulators) {
        iosSimulatorsResp.simulators
          .filter((simulator: any) => simulator.state === 'Booted')
          .forEach((simulator: any) => {
            allDevices.push({
              id: simulator.id,
              name: simulator.name,
              model: simulator.name, // Add model field for Device interface compatibility
              label: `${simulator.model}`,
              description: 'iPhone Simulator',
              platform: 'ios',
              deviceType: 'simulator',
            })
          })
      }

      return { success: true, devices: allDevices }
    }
    catch (error) {
      console.error('Error getting devices:', error)
      return { success: false, error: (error as Error).message }
    }
  },

  getIOSPackages: (deviceId: string) => {
    console.log('getIOSPackages called with deviceId:', deviceId)
    return invokeCommandWithResponse('device:getIosPackages', 'packages', deviceId)
  },

  getAndroidPackages: (deviceId: string) =>
    invokeCommandWithResponse('adb:getPackages', 'packages', deviceId),

  getIOsDevicePackages: (deviceId: string) =>
    invokeCommandWithResponse('device:getIosDevicePackages', 'packages', deviceId),

  getAndroidDatabaseFiles: (deviceId: string, applicationId: string) =>
    invokeCommandWithResponse('adb:getAndroidDatabaseFiles', 'files', deviceId, applicationId),

  checkAppExistence: (deviceId: string, applicationId: string) =>
    invokeCommandWithResponse('device:checkAppExistence', 'exists', deviceId, applicationId),

  getIOSDeviceDatabaseFiles: (deviceId: string, applicationId: string) =>
    invokeCommandWithResponse('device:getIOSDeviceDatabaseFiles', 'files', deviceId, applicationId),

  getIOSDeviceDatabaseFilesNew: (deviceId: string, applicationId: string) =>
    invokeCommandWithResponse('device:getIOSDeviceDatabaseFilesNew', 'files', deviceId, applicationId),

  getIOSSimulatorDatabaseFiles: (deviceId: string, applicationId: string) =>
    invokeCommandWithResponse('simulator:getIOSSimulatorDatabaseFiles', 'files', deviceId, applicationId),

  pushDatabaseFile: async (deviceId: string, localPath: string, packageName: string, remotePath: string, deviceType?: string) => {
    // Validate required parameters
    validateInput(deviceId, 'deviceId', { required: true, type: 'string', maxLength: 100 })
    validateInput(localPath, 'localPath', { required: true, type: 'string', maxLength: 500 })
    validateInput(packageName, 'packageName', { required: true, type: 'string', maxLength: 200 })
    validateInput(remotePath, 'remotePath', { required: true, type: 'string', maxLength: 500 })
    
    // Validate file paths for security
    const suspiciousPatterns = [
      /\.\./,                    // Directory traversal
      /[<>:"|?*]/,              // Windows forbidden chars
      // eslint-disable-next-line no-control-regex
      /[\x00-\x1F\x7F]/,        // Control characters
    ]
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(localPath) || pattern.test(remotePath)) {
        throw new APIValidationError(
          'File paths contain potentially dangerous characters',
          'SUSPICIOUS_FILE_PATH',
          { localPath, remotePath }
        )
      }
    }

    // Determine device type if not provided
    if (!deviceType) {
      if (deviceId.match(/^[A-F0-9-]{36,40}$/i)) {
        deviceType = 'iphone-device' 
      }
      else if (deviceId.match(/^[A-F0-9-]{8,}$/i)) {
        deviceType = 'simulator' 
      }
      else {
        deviceType = 'android' 
      }
    }
    console.log('DEVICE TYPE:', deviceType)

    // Use appropriate command based on device type
    if (deviceType === 'android') {
      return invokeCommandWithResponse('adb:pushDatabaseFile', 'result', deviceId, localPath, packageName, remotePath)
    }
    else if (deviceType.includes('simulator')) {
      return invokeCommandWithResponse('simulator:uploadSimulatorIOSDbFile', 'result', deviceId, localPath, packageName, remotePath)
    }
    else {
      return invokeCommandWithResponse('device:pushIOSDbFile', 'result', deviceId, localPath, packageName, remotePath)
    }
  },

  // Database methods
  getTables: async (dbPath?: string) => {
    if (dbPath) {
      validateInput(dbPath, 'dbPath', { type: 'string', maxLength: 500 })
    }
    
    try {
      const response = await invoke<any>('db_get_tables', { 
        currentDbPath: dbPath, 
      })
      
      const validatedResponse = validateDeviceResponse(response)
      
      if (validatedResponse.success && validatedResponse.data) {
        return {
          success: true,
          tables: validatedResponse.data,
        }
      }
      else {
        return { success: false, error: validatedResponse.error || 'Failed to get tables' }
      }
    }
    catch (error) {
      if (error instanceof APIValidationError) {
        throw error
      }
      return { success: false, error: (error as Error).message }
    }
  },

  openDatabase: async (filePath: string) => {
    validateInput(filePath, 'filePath', { required: true, type: 'string', maxLength: 500 })
    
    // Additional file path validation
    if (!filePath.match(/\.(db|sqlite|sqlite3)$/i)) {
      throw new APIValidationError(
        'Invalid database file extension. Expected .db, .sqlite, or .sqlite3',
        'INVALID_FILE_EXTENSION',
        { filePath }
      )
    }
    
    try {
      const response = await invoke<any>('db_open', { filePath })
      const validatedResponse = validateDeviceResponse(response)
      
      return {
        success: validatedResponse.success,
        path: validatedResponse.data,
        error: validatedResponse.error,
      }
    }
    catch (error) {
      if (error instanceof APIValidationError) {
        throw error
      }
      return { success: false, error: (error as Error).message }
    }
  },

  getTableInfo: async (tableName: string, dbPath?: string) => {
    validateInput(tableName, 'tableName', { required: true, type: 'string', maxLength: 100 })
    if (dbPath) {
      validateInput(dbPath, 'dbPath', { type: 'string', maxLength: 500 })
    }
    
    // Validate table name for SQL injection
    if (!/^[a-z_]\w*$/i.test(tableName)) {
      throw new APIValidationError(
        'Invalid table name. Must start with letter or underscore and contain only alphanumeric characters and underscores',
        'INVALID_TABLE_NAME',
        { tableName }
      )
    }
    
    try {
      const response = await invoke<DeviceResponse<any>>('db_get_table_data', { 
        tableName,
        currentDbPath: dbPath, 
      })
      
      const validatedResponse = validateDeviceResponse(response)
      
      if (validatedResponse.success && validatedResponse.data) {
        const tableData = validatedResponse.data as { columns: any[], rows: any[] }
        // Transform to match Electron API structure
        return {
          success: true,
          columns: tableData.columns,
          rows: tableData.rows,
        }
      }
      else {
        return { success: false, error: validatedResponse.error || 'Failed to get table info' }
      }
    }
    catch (error) {
      if (error instanceof APIValidationError) {
        throw error
      }
      return { success: false, error: (error as Error).message }
    }
  },

  updateTableRow: (
    tableName: string, 
    row: any, 
    condition: any, 
    dbPath?: string,
    deviceId?: string,
    deviceName?: string,
    deviceType?: string,
    packageName?: string,
    appName?: string,
  ) =>
    invokeCommandWithResponse('db:updateTableRow', 'result', tableName, row, condition, dbPath, deviceId, deviceName, deviceType, packageName, appName),

  executeQuery: (query: string, dbPath: string) =>
    invokeCommandWithResponse('db:executeQuery', 'result', query, dbPath),

  insertTableRow: (
    tableName: string, 
    row: any, 
    dbPath?: string,
    deviceId?: string,
    deviceName?: string, 
    deviceType?: string,
    packageName?: string,
    appName?: string,
  ) =>
    invokeCommandWithResponse('db:insertTableRow', 'result', tableName, row, dbPath, deviceId, deviceName, deviceType, packageName, appName),

  addNewRowWithDefaults: (
    tableName: string, 
    dbPath?: string,
    deviceId?: string,
    deviceName?: string,
    deviceType?: string,
    packageName?: string,
    appName?: string,
  ) =>
    invokeCommandWithResponse('db:addNewRowWithDefaults', 'result', tableName, dbPath, deviceId, deviceName, deviceType, packageName, appName),

  deleteTableRow: (
    tableName: string, 
    condition: any, 
    dbPath?: string,
    deviceId?: string,
    deviceName?: string,
    deviceType?: string,
    packageName?: string,
    appName?: string,
  ) =>
    invokeCommandWithResponse('db:deleteTableRow', 'result', tableName, condition, dbPath, deviceId, deviceName, deviceType, packageName, appName),

  clearTable: (
    tableName: string,
    dbPath?: string,
    deviceId?: string,
    deviceName?: string,
    deviceType?: string,
    packageName?: string,
    appName?: string,
  ) =>
    invokeCommandWithResponse('db:clearTable', 'result', tableName, dbPath, deviceId, deviceName, deviceType, packageName, appName),

  switchDatabase: (filePath: string) =>
    invokeCommandWithResponse('db:switchDatabase', 'result', filePath),

  // Change history methods
  getChangeHistory: async (contextKey: string, tableName?: string) => {
    console.log('🔍 [API] getChangeHistory called with:', { contextKey, tableName })
    try {
      const result = await invokeCommandWithResponse('db:getChangeHistory', 'data', contextKey, tableName)
      console.log('🔍 [API] getChangeHistory result:', result)
      console.log('🔍 [API] getChangeHistory data type:', typeof result.data)
      console.log('🔍 [API] getChangeHistory data length:', Array.isArray(result.data) ? result.data.length : 'not an array')
      return result
    }
    catch (error) {
      console.error('🔍 [API] getChangeHistory error:', error)
      throw error
    }
  },

  getContextSummaries: () =>
    invokeCommandWithResponse('db:getContextSummaries', 'summaries'),

  getChangeHistoryDiagnostics: () =>
    invokeCommandWithResponse('db:getChangeHistoryDiagnostics', 'diagnostics'),

  clearContextChanges: (contextKey: string) =>
    invokeCommandWithResponse('db:clearContextChanges', 'result', contextKey),

  clearAllChangeHistory: () =>
    invokeCommandWithResponse('db:clearAllChangeHistory', 'result'),

  generateCustomFileContextKey: (databasePath: string) =>
    invokeCommandWithResponse('db:generateCustomFileContextKey', 'data', databasePath),

  // File dialog methods
  openFile: async () => {
    try {
      const response = await invoke<any>('dialog_select_file')
      const validatedResponse = validateDeviceResponse(response)
      const fileData = validatedResponse.data as { canceled?: boolean, file_paths?: string[], file_path?: string[] }
      
      return {
        canceled: fileData?.canceled || false,
        filePaths: fileData?.file_paths || fileData?.file_path || [],
      }
    }
    catch (error) {
      console.error('Error opening file:', error)
      return { canceled: true, filePaths: [] }
    }
  },

  exportFile: async (options: any) => {
    // Validate export options
    if (options) {
      validateInput(options.dbFilePath, 'dbFilePath', { type: 'string', maxLength: 500 })
      validateInput(options.defaultPath, 'defaultPath', { type: 'string', maxLength: 500 })
      
      if (options.filters && Array.isArray(options.filters)) {
        for (const filter of options.filters) {
          validateInput(filter.name, 'filter.name', { type: 'string', maxLength: 100 })
          if (filter.extensions && !Array.isArray(filter.extensions)) {
            throw new APIValidationError(
              'Filter extensions must be an array',
              'INVALID_FILTER_EXTENSIONS',
              { filter }
            )
          }
        }
      }
    }
    
    try {
      // Transform camelCase to snake_case for Rust
      const transformedOptions = {
        db_file_path: options?.dbFilePath,
        default_path: options?.defaultPath,
        filters: options?.filters?.map((filter: any) => ({
          name: filter.name,
          extensions: filter.extensions,
        })),
      }

      const response = await invoke<string | null>('dialog_save_file', { options: transformedOptions })
      return response
    }
    catch (error) {
      console.error('Error saving file:', error)
      return null
    }
  },

  // Virtual device methods
  getAndroidEmulators: () => invokeCommandWithResponse('getAndroidEmulators', 'emulators'),

  getIOSSimulators: () => invokeCommandWithResponse('getIOSSimulators', 'simulators'),

  launchAndroidEmulator: (emulatorId: string) =>
    invokeCommandWithResponse('launchAndroidEmulator', 'result', emulatorId),

  launchIOSSimulator: (simulatorId: string) =>
    invokeCommandWithResponse('launchIOSSimulator', 'result', simulatorId),

  // Auto-updater methods
  checkForUpdates: async () => {
    try {
      const response = await invoke<any>('check_for_updates')
      return {
        success: response.success,
        updateAvailable: response.data?.available || false,
        version: response.data?.version,
        releaseNotes: response.data?.notes,
        releaseDate: response.data?.date,
        error: response.error,
      }
    }
    catch (error) {
      console.error('Error checking for updates:', error)
      return { success: false, error: (error as Error).message, updateAvailable: false }
    }
  },

  downloadAndInstallUpdate: async () => {
    try {
      const response = await invoke<any>('download_and_install_update')
      return {
        success: response.success,
        error: response.error,
      }
    }
    catch (error) {
      console.error('Error downloading update:', error)
      return { success: false, error: (error as Error).message }
    }
  },

  // Add webUtils placeholder for compatibility
  webUtils: {
    getPathForFile: async (file: File) => {
      try {
        // Read the file content as array buffer
        const arrayBuffer = await file.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        
        // Call our Tauri command to save the dropped file content
        const filePath = await invoke<string>('save_dropped_file', {
          fileContent: Array.from(uint8Array),
          filename: file.name,
        })
        
        return filePath
      }
      catch (error) {
        console.error('Error saving dropped file:', error)
        throw error
      }
    },
  },
}

// Environment variables (matching Electron preload)
export const env = {
  NODE_ENV: import.meta.env.MODE,
  SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
}

// Default export for easier importing
export default api

// Function to initialize the global API
function initializeGlobalAPI() {
  if (typeof window !== 'undefined') {
    ;(window as any).api = api
    ;(window as any).env = env
  }
}

// Initialize immediately
initializeGlobalAPI()

// Also initialize when DOM is ready (if it isn't already)
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGlobalAPI)
  }
  else {
    // DOM is already ready
    initializeGlobalAPI()
  }
}
