// import type { WebUtils } from 'electron' // Not used in Tauri

export {}

declare global {
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
      getIOSDatabaseFiles: (deviceId: string, applicationId: string) => Promise<any>
      getIOSDeviceDatabaseFiles: (deviceId: string, applicationId: string) => Promise<any>
      checkAppExistence: (deviceId: string, applicationId: string) => Promise<any>
      uploadIOSDbFile: (deviceId: string, packageName: string, localFilePath: string, remoteLocation: string) => Promise<any>
      pushDatabaseFile: (deviceId: string, localPath: string, packageName: string, remotePath: string, deviceType?: string) => Promise<any>

      // Database methods
      getTables: () => Promise<any>
      openDatabase: (filePath: string) => Promise<any>
      getTableInfo: (tableName: string) => Promise<any>
      updateTableRow: (tableName: string, row: any, condition: any) => Promise<any>
      executeQuery: (query: string, dbPath: string) => Promise<any>
      insertTableRow: (table: string, row: any) => Promise<any>
      addNewRowWithDefaults: (table: string) => Promise<any>
      deleteTableRow: (table: string, condition: any) => Promise<any>

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
          status?: 'running' | 'stopped'
        }>
        error?: string
      }>

      getIOSSimulators: () => Promise<{
        success: boolean
        simulators?: Array<{
          name: string
          id: string
          platform: 'ios'
          status?: 'running' | 'stopped'
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
