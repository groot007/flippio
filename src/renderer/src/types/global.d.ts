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
    }
  }
}
