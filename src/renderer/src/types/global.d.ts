// import type { WebUtils } from 'electron' // Not used in Tauri

export {}

declare global {
  // Vite injected constants
  const __APP_VERSION__: string

  interface Window {
    env: any
    // electron: Electron // Not used in Tauri
    api: {
      // Device operations
      getDevices: () => Promise<any>
      getIOSPackages: (id: string) => Promise<any>
      getIOsDevicePackages: (id: string) => Promise<any>
      getAndroidPackages: (id: string) => Promise<any>
      getAndroidDatabaseFiles: (deviceId: string, applicationId: string) => Promise<any>
      getIOSDeviceDatabaseFiles: (deviceId: string, applicationId: string) => Promise<any>
      getIOSSimulatorDatabaseFiles: (deviceId: string, applicationId: string) => Promise<any>
      checkAppExistence: (deviceId: string, applicationId: string) => Promise<any>
      uploadIOSDbFile: (deviceId: string, packageName: string, localFilePath: string, remoteLocation: string) => Promise<any>
      pushDatabaseFile: (deviceId: string, localPath: string, packageName: string, remotePath: string, deviceType?: string) => Promise<any>

      // Database methods
      getTables: (dbPath?: string) => Promise<any>
      openDatabase: (filePath: string) => Promise<any>
      getTableInfo: (tableName: string, dbPath?: string) => Promise<any>
      updateTableRow: (tableName: string, row: any, condition: any, dbPath?: string) => Promise<any>
      executeQuery: (query: string, dbPath: string) => Promise<any>
      insertTableRow: (table: string, row: any, dbPath?: string) => Promise<any>
      addNewRowWithDefaults: (table: string, dbPath?: string) => Promise<any>
      deleteTableRow: (table: string, condition: any, dbPath?: string) => Promise<any>
      switchDatabase: (filePath: string) => Promise<any>

      // File dialog methods
      openFile: () => Promise<any>
      exportFile: (options: {
        dbFilePath: string
        defaultPath: string
        filters: Array<{
          name: string
          extensions: string[]
        }>
      }) => Promise<any>
      webUtils: any // Changed from WebUtils to any

      // Virtual device methods
      getAndroidEmulators: () => Promise<{
        success: boolean
        emulators?: Array<{
          name: string
          id: string
          platform: 'android'
          state?: string
        }>
        error?: string
      }>

      getIOSSimulators: () => Promise<{
        success: boolean
        simulators?: Array<{
          name: string
          id: string
          platform: 'ios'
          state?: string
        }>
        error?: string
      }>

      launchAndroidEmulator: (emulatorId: string) => Promise<{
        success: boolean
        error?: string
      }>

      launchIOSSimulator: (simulatorId: string) => Promise<{
        success: boolean
        error?: string
      }>

      // Auto-updater methods
      checkForUpdates: () => Promise<{
        success: boolean
        updateAvailable: boolean
        version?: string
        releaseNotes?: string
        releaseDate?: string
        error?: string
      }>

      downloadAndInstallUpdate: () => Promise<{
        success: boolean
        error?: string
      }>
    }
  }
}
