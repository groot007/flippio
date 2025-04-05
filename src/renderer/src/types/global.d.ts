import type { WebUtils } from 'electron'

export {}

declare global {
  interface Window {
    env: any
    electron: Electron
    api: {
      // ADB operations
      getDevices: () => Promise<any>
      getIOSPackages: (id: string) => Promise<any>
      getAndroidPackages: (id: string) => Promise<any>
      getAndroidDatabaseFiles: (deviceId: string, applicationId) => Promise<any>
      getIOSDatabaseFiles: (deviceId: string, applicationId) => Promise<any>
      pullDatabaseFile: (deviceId: string, remotePath: string, localPath?: string) =>
      Promise<any>
      pushDatabaseFile: (deviceId: string, localPath: string, packageName: string, remotePath: string) =>
      Promise<any>
      getTables: () => Promise<any>
      openDatabase: (filePath: string) => Promise<any>
      getTableInfo: (tableName: string) => Promise<any>
      updateTableRow: (tableName: string, row: any, condition: any) => Promise<any>
      executeQuery: (query: string) => Promise<any>
      getDevices: () => Promise<any>
      getIOSPackages: (deviceId: string) => Promise<any>
      getAndroidPackages: (deviceId: string) => Promise<any>
      getAndroidDatabaseFiles: (deviceId: string, applicationId: string) => Promise<any>
      getIOSDatabaseFiles: (deviceId: string, applicationId: string) => Promise<any>
      pullDatabaseFile: (deviceId: string, remotePath: string, localPath?: string) => Promise<any>
      pushDatabaseFile: (deviceId: string, localPath: string, packageName: string, remotePath: string) => Promise<any>

      openFile: () => Promise<any>
      exportFile: (options: {
        dbFilePath: string
        defaultPath: string
        filters: Array<{
          name: string
          extensions: string[]
        }>
      }) => Promise<any>
      webUtils: WebUtils

      // Database methods
      getTables: () => Promise<any>
      openDatabase: (filePath: string) => Promise<any>
      getTableInfo: (tableName: string) => Promise<any>
      updateTableRow: (tableName: string, row: any, condition: any) => Promise<any>
      executeQuery: (query: string) => Promise<any>

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
    }
  }
}
