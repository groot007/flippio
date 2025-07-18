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
  'db:executeQuery': 'db_execute_query',

  // Common commands
  'dialog:selectFile': 'dialog_select_file',
  'dialog:saveFile': 'dialog_save_file',
}

// Helper function for commands that need to preserve Electron-style response structure
async function invokeCommandWithResponse<T>(electronCommand: string, dataFieldName: string, ...args: any[]): Promise<{ success: boolean, [key: string]: any }> {
  const tauriCommand = COMMAND_MAP[electronCommand as keyof typeof COMMAND_MAP]
  if (!tauriCommand) {
    throw new Error(`Command not found: ${electronCommand}`)
  }

  try {
    // Create proper parameter object based on command
    const parameters: Record<string, any> = {}
    const paramNames = getParameterNames(tauriCommand)

    for (let i = 0; i < args.length && i < paramNames.length; i++) {
      parameters[paramNames[i]] = args[i]
    }

    console.log(`Invoking ${tauriCommand} with parameters:`, parameters)
    const response = await invoke<DeviceResponse<T>>(tauriCommand, parameters)
    console.log(`Response from ${tauriCommand}:`, response)

    if (response.success) {
      return { success: true, [dataFieldName]: response.data }
    }
    else {
      return { success: false, error: response.error }
    }
  }
  catch (error) {
    console.error(`Error invoking ${tauriCommand}:`, error)
    return { success: false, error: (error as Error).message }
  }
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
    db_get_tables: [],
    db_get_table_data: ['tableName'],
    db_get_info: ['filePath'],
    db_update_table_row: ['tableName', 'row', 'condition'],
    db_insert_table_row: ['tableName', 'row'],
    db_add_new_row_with_defaults: ['tableName'],
    db_delete_table_row: ['tableName', 'condition'],
    db_execute_query: ['query', 'dbPath', 'params'],

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
  getTables: async () => {
    try {
      const response = await invoke<any>('db_get_tables')
      if (response.success && response.data) {
        return {
          success: true,
          tables: response.data,
        }
      }
      else {
        return { success: false, error: response.error }
      }
    }
    catch (error) {
      return { success: false, error: (error as Error).message }
    }
  },

  openDatabase: async (filePath: string) => {
    try {
      const response = await invoke<any>('db_open', { filePath })
      return {
        success: response.success,
        path: response.data,
        error: response.error,
      }
    }
    catch (error) {
      return { success: false, error: (error as Error).message }
    }
  },

  getTableInfo: async (tableName: string) => {
    try {
      const response = await invoke<DeviceResponse<any>>('db_get_table_data', { tableName })
      if (response.success && response.data) {
        // Transform to match Electron API structure
        return {
          success: true,
          columns: response.data.columns,
          rows: response.data.rows,
        }
      }
      else {
        return { success: false, error: response.error }
      }
    }
    catch (error) {
      return { success: false, error: (error as Error).message }
    }
  },

  updateTableRow: (tableName: string, row: any, condition: any) =>
    invokeCommandWithResponse('db:updateTableRow', 'result', tableName, row, condition),

  executeQuery: (query: string, dbPath: string) =>
    invokeCommandWithResponse('db:executeQuery', 'result', query, dbPath),

  insertTableRow: (tableName: string, row: any) =>
    invokeCommandWithResponse('db:insertTableRow', 'result', tableName, row),

  addNewRowWithDefaults: (tableName: string) =>
    invokeCommandWithResponse('db:addNewRowWithDefaults', 'result', tableName),

  deleteTableRow: (tableName: string, condition: any) =>
    invokeCommandWithResponse('db:deleteTableRow', 'result', tableName, condition),

  // File dialog methods
  openFile: async () => {
    try {
      const response = await invoke<any>('dialog_select_file')
      return {
        canceled: response.canceled || false,
        filePaths: response.file_paths || response.file_path || [],
      }
    }
    catch (error) {
      console.error('Error opening file:', error)
      return { canceled: true, filePaths: [] }
    }
  },

  exportFile: async (options: any) => {
    try {
      // Transform camelCase to snake_case for Rust
      const transformedOptions = {
        db_file_path: options.dbFilePath,
        default_path: options.defaultPath,
        filters: options.filters?.map((filter: any) => ({
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
    getPathForFile: (file: File) => {
      // In Tauri, we need to handle files differently
      // For now, return the file name as we can't get the full path for security reasons
      // The actual file handling would need to be done through Tauri's file system API
      return file.name
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
