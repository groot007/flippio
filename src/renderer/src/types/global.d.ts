import type { DatabaseApi, ExportFileOptions, OpenFileResult } from '@renderer/api/databases'
import type { CancelIOSDeviceDatabaseScanResult, DeviceApi, GetDevicesResult } from '@renderer/api/devices'

// import type { WebUtils } from 'electron' // Not used in Tauri

export {}

declare global {
  // Vite injected constants
  const __APP_VERSION__: string

  interface Window {
    env: any
    __FLIPPIO_E2E__?: {
      enabled: boolean
      getCommandHistory: () => Array<{
        command: string
        handled: boolean
        params: Record<string, unknown>
        timestamp: string
      }>
      getScenarioState: () => unknown
      loadScenario: (scenario: unknown) => void
      prepareScenario: (scenario: unknown) => Promise<void>
      resetScenario: () => void
    }
    // electron: Electron // Not used in Tauri
    api: DeviceApi & DatabaseApi & {
      // Device operations
      getDevices: () => Promise<GetDevicesResult>
      cancelIOSDeviceDatabaseScan: (scanKey: string) => Promise<CancelIOSDeviceDatabaseScanResult>
      refreshIOSDeviceDatabaseFile: (deviceId: string, packageName: string, remotePath: string) => Promise<any>
      uploadIOSDbFile: (deviceId: string, packageName: string, localFilePath: string, remoteLocation: string) => Promise<any>
      pushDatabaseFile: (deviceId: string, localPath: string, packageName: string, remotePath: string, deviceType?: string) => Promise<any>

      // Database methods
      updateTableRow: (
        tableName: string, 
        row: any, 
        condition: any, 
        dbPath?: string,
        deviceId?: string,
        deviceName?: string,
        deviceType?: string,
        packageName?: string,
        appName?: string
      ) => Promise<any>
      executeQuery: (query: string, dbPath: string) => Promise<any>
      insertTableRow: (
        table: string, 
        row: any, 
        dbPath?: string,
        deviceId?: string,
        deviceName?: string,
        deviceType?: string,
        packageName?: string,
        appName?: string
      ) => Promise<any>
      addNewRowWithDefaults: (
        table: string, 
        dbPath?: string,
        deviceId?: string,
        deviceName?: string,
        deviceType?: string,
        packageName?: string,
        appName?: string
      ) => Promise<any>
      deleteTableRow: (
        table: string, 
        condition: any, 
        dbPath?: string,
        deviceId?: string,
        deviceName?: string,
        deviceType?: string,
        packageName?: string,
        appName?: string
      ) => Promise<any>
      clearTable: (
        tableName: string,
        dbPath?: string,
        deviceId?: string,
        deviceName?: string,
        deviceType?: string,
        packageName?: string,
        appName?: string
      ) => Promise<any>

      // Change history methods
      getChangeHistory: (contextKey: string, tableName?: string) => Promise<any>
      getContextSummaries: () => Promise<any>
      getChangeHistoryDiagnostics: () => Promise<any>
      clearContextChanges: (contextKey: string) => Promise<any>
      clearAllChangeHistory: () => Promise<any>

      // File dialog methods
      openFile: () => Promise<OpenFileResult>
      exportFile: (options: ExportFileOptions) => Promise<string | null>
      exportTextFile: (options: {
        content: string
        defaultPath: string
        filters: Array<{
          name: string
          extensions: string[]
        }>
      }) => Promise<string | null>
      exportLogs: () => Promise<string | null>
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
