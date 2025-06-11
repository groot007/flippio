// Platform detection and API adapter
let isElectron = false
let isTauri = false

// Check if running in Electron
if (typeof window !== 'undefined') {
  isElectron = !!(window as any).electron
  isTauri = !!(window as any).__TAURI__
}

// For Electron, we'll just proxy to window.api
// For Tauri, we'll use the Tauri API
// For development, we'll provide mock implementations

// Simple synchronous API that wraps async operations when needed
export const api = {
  // Device management
  getDevices: () => {
    console.error('🔍 DEBUG: getDevices called, isElectron:', isElectron, 'isTauri:', isTauri)
    if (isElectron)
      return (window as any).api.getDevices()
    if (isTauri)
      return import('./tauri-api').then(m => m.api.getDevices())
    return Promise.resolve([])
  },

  getIOSPackages: (deviceId: string) => {
    if (isElectron)
      return (window as any).api.getIOSPackages(deviceId)
    if (isTauri)
      return import('./tauri-api').then(m => m.api.getIOSPackages(deviceId))
    return Promise.resolve({ success: false, packages: [] })
  },

  getAndroidPackages: (deviceId: string) => {
    if (isElectron)
      return (window as any).api.getAndroidPackages(deviceId)
    if (isTauri)
      return import('./tauri-api').then(m => m.api.getAndroidPackages(deviceId))
    return Promise.resolve({ success: false, packages: [] })
  },

  getIOsDevicePackages: (deviceId: string) => {
    if (isElectron)
      return (window as any).api.getIOsDevicePackages(deviceId)
    if (isTauri)
      return import('./tauri-api').then(m => m.api.getIOsDevicePackages(deviceId))
    return Promise.resolve({ success: false, packages: [] })
  },

  getAndroidDatabaseFiles: (deviceId: string, applicationId: string) => {
    if (isElectron)
      return (window as any).api.getAndroidDatabaseFiles(deviceId, applicationId)
    if (isTauri)
      return import('./tauri-api').then(m => m.api.getAndroidDatabaseFiles(deviceId, applicationId))
    return Promise.resolve({ success: false, files: [] })
  },

  checkAppExistence: (deviceId: string, applicationId: string) => {
    if (isElectron)
      return (window as any).api.checkAppExistence(deviceId, applicationId)
    if (isTauri)
      return import('./tauri-api').then(m => m.api.checkAppExistence(deviceId, applicationId))
    return Promise.resolve({ success: false })
  },

  getIOSDatabaseFiles: (deviceId: string, applicationId: string) => {
    if (isElectron)
      return (window as any).api.getIOSDatabaseFiles(deviceId, applicationId)
    if (isTauri)
      return import('./tauri-api').then(m => m.api.getIOSDatabaseFiles(deviceId, applicationId))
    return Promise.resolve([])
  },

  getIOSDeviceDatabaseFiles: (deviceId: string, applicationId: string) => {
    if (isElectron)
      return (window as any).api.getIOSDeviceDatabaseFiles(deviceId, applicationId)
    if (isTauri)
      return import('./tauri-api').then(m => m.api.getIOSDeviceDatabaseFiles(deviceId, applicationId))
    return Promise.resolve([])
  },

  uploadIOSDbFile: (deviceId: string, packageName: string, localFilePath: string, remoteLocation: string) => {
    if (isElectron)
      return (window as any).api.uploadIOSDbFile(deviceId, packageName, localFilePath, remoteLocation)
    if (isTauri)
      return import('./tauri-api').then(m => m.api.uploadIOSDbFile(deviceId, packageName, localFilePath, remoteLocation))
    return Promise.resolve({ success: false })
  },

  pushDatabaseFile: (deviceId: string, localPath: string, packageName: string, remotePath: string) => {
    if (isElectron)
      return (window as any).api.pushDatabaseFile(deviceId, localPath, packageName, remotePath)
    if (isTauri)
      return import('./tauri-api').then(m => m.api.pushDatabaseFile(deviceId, localPath, packageName, remotePath))
    return Promise.resolve({ success: false })
  },

  // Database operations
  getTables: () => {
    if (isElectron)
      return (window as any).api.getTables()
    if (isTauri)
      return import('./tauri-api').then(m => m.api.getTables())
    return Promise.resolve([])
  },

  openDatabase: (filePath: string) => {
    if (isElectron)
      return (window as any).api.openDatabase(filePath)
    if (isTauri)
      return import('./tauri-api').then(m => m.api.openDatabase(filePath))
    return Promise.resolve({ success: true })
  },

  getTableInfo: (tableName: string, limit?: number, offset?: number) => {
    if (isElectron)
      return (window as any).api.getTableInfo(tableName)
    if (isTauri)
      return import('./tauri-api').then(m => m.api.getTableInfo(tableName, limit, offset))
    return Promise.resolve({ columns: [], rows: [], total_count: 0 })
  },

  updateTableRow: (tableName: string, rowData: any, condition: any) => {
    if (isElectron)
      return (window as any).api.updateTableRow(tableName, rowData, condition)
    if (isTauri)
      return import('./tauri-api').then(m => m.api.updateTableRow(tableName, rowData, condition))
    return Promise.resolve({ success: true })
  },

  deleteTableRow: (tableName: string, condition: any) => {
    if (isElectron)
      return (window as any).api.deleteTableRow(tableName, condition)
    if (isTauri)
      return import('./tauri-api').then(m => m.api.deleteTableRow(tableName, condition))
    return Promise.resolve({ success: true })
  },

  insertTableRow: (tableName: string, row: any) => {
    if (isElectron)
      return (window as any).api.insertTableRow(tableName, row)
    if (isTauri)
      return import('./tauri-api').then(m => m.api.insertTableRow(tableName, row))
    return Promise.resolve({ success: true })
  },

  executeQuery: (query: string, dbPath: string) => {
    if (isElectron)
      return (window as any).api.executeQuery(query, dbPath)
    if (isTauri)
      return import('./tauri-api').then(m => m.api.executeQuery(query, dbPath))
    return Promise.resolve({ success: false, rows: [], columns: [] })
  },

  // File operations
  openFile: () => {
    if (isElectron)
      return (window as any).api.openFile()
    if (isTauri)
      return import('./tauri-api').then(m => m.api.openFile())
    return Promise.resolve({ canceled: true })
  },

  exportFile: (options: any) => {
    if (isElectron)
      return (window as any).api.exportFile(options)
    if (isTauri)
      return import('./tauri-api').then(m => m.api.exportFile(options))
    return Promise.resolve(null)
  },

  // Virtual device operations
  getAndroidEmulators: () => {
    if (isElectron)
      return (window as any).api.getAndroidEmulators()
    if (isTauri)
      return import('./tauri-api').then(m => m.api.getAndroidEmulators())
    return Promise.resolve({ success: false, emulators: [] })
  },

  getIOSSimulators: () => {
    if (isElectron)
      return (window as any).api.getIOSSimulators()
    if (isTauri)
      return import('./tauri-api').then(m => m.api.getIOSSimulators())
    return Promise.resolve({ success: false, simulators: [] })
  },

  launchAndroidEmulator: (emulatorId: string) => {
    if (isElectron)
      return (window as any).api.launchAndroidEmulator(emulatorId)
    if (isTauri)
      return import('./tauri-api').then(m => m.api.launchAndroidEmulator(emulatorId))
    return Promise.resolve({ success: false })
  },

  launchIOSSimulator: (simulatorId: string) => {
    if (isElectron)
      return (window as any).api.launchIOSSimulator(simulatorId)
    if (isTauri)
      return import('./tauri-api').then(m => m.api.launchIOSSimulator(simulatorId))
    return Promise.resolve({ success: false })
  },

  // Web utilities
  webUtils: {
    getPathForFile: (file: File) => {
      if (isElectron)
        return (window as any).api.webUtils?.getPathForFile(file)
      return (file as any).path || file.name
    },
  },
}

// Export platform detection
export const platform = isTauri ? 'tauri' : isElectron ? 'electron' : 'unknown'
