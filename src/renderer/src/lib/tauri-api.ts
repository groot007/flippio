import { invoke } from '@tauri-apps/api/tauri'

// Device management APIs
export const api = {
  getDevices: () => invoke('get_devices'),
  getIOSPackages: (deviceId: string) => invoke('get_ios_packages', { device_id: deviceId }),
  getAndroidPackages: (deviceId: string) => invoke('get_android_packages', { device_id: deviceId }),
  getIOsDevicePackages: (deviceId: string) => invoke('get_ios_device_packages', { device_id: deviceId }),
  getAndroidDatabaseFiles: (deviceId: string, applicationId: string) => 
    invoke('get_android_database_files', { device_id: deviceId, application_id: applicationId }),
  checkAppExistence: (deviceId: string, applicationId: string) => 
    invoke('check_app_existence', { device_id: deviceId, application_id: applicationId }),
  getIOSDatabaseFiles: (deviceId: string, applicationId: string) =>
    invoke('get_ios_database_files', { device_id: deviceId, application_id: applicationId }),
  getIOSDeviceDatabaseFiles: (deviceId: string, applicationId: string) =>
    invoke('get_ios_device_database_files', { device_id: deviceId, application_id: applicationId }),
  uploadIOSDbFile: (deviceId: string, packageName: string, localFilePath: string, remoteLocation: string) =>
    invoke('upload_ios_db_file', { device_id: deviceId, package_name: packageName, local_file_path: localFilePath, remote_location: remoteLocation }),
  pushDatabaseFile: (deviceId: string, localPath: string, packageName: string, remotePath: string) =>
    invoke('push_database_file', { device_id: deviceId, local_path: localPath, package_name: packageName, remote_path: remotePath }),
  
  // Database operations
  getTables: () => invoke('get_tables'),
  openDatabase: (filePath: string) => invoke('open_database', { file_path: filePath }),
  getTableInfo: (tableName: string, limit?: number, offset?: number) =>
    invoke('get_table_data', { table_name: tableName, limit, offset }),
  updateTableRow: (tableName: string, rowData: any, condition: any) =>
    invoke('update_table_row', { table_name: tableName, row_data: rowData, condition }),
  deleteTableRow: (tableName: string, condition: any) =>
    invoke('delete_table_row', { table_name: tableName, condition }),
  insertTableRow: (tableName: string, rowData: any) =>
    invoke('insert_table_row', { table_name: tableName, row_data: rowData }),
  executeQuery: (query: string, dbPath?: string) => invoke('execute_query', { query, db_path: dbPath }),
  
  // File operations
  selectFileDialog: (title?: string, filters?: Array<[string, string[]]>) =>
    invoke('select_file_dialog', { title, filters }),
  saveFileDialog: (title?: string, defaultName?: string) =>
    invoke('save_file_dialog', { title, defaultName }),
  
  // Virtual devices
  getVirtualDevices: () => invoke('get_virtual_devices'),
  launchVirtualDevice: (deviceId: string, deviceType: string) =>
    invoke('launch_virtual_device', { device_id: deviceId, device_type: deviceType }),
  closeVirtualDevice: (deviceId: string, deviceType: string) =>
    invoke('close_virtual_device', { device_id: deviceId, device_type: deviceType }),
  
  // Specific virtual device methods for compatibility with Electron API
  getAndroidEmulators: () => invoke('get_android_emulators'),
  getIOSSimulators: () => invoke('get_ios_simulators'),
  launchAndroidEmulator: (emulatorId: string) => invoke('launch_android_emulator', { emulator_id: emulatorId }),
  launchIOSSimulator: (simulatorId: string) => invoke('launch_ios_simulator', { simulator_id: simulatorId }),
  
  // File operations for compatibility
  openFile: () => invoke('select_file_dialog'),
  exportFile: (options: any) => invoke('save_file_dialog', options),
  webUtils: {
    getPathForFile: (file: File) => {
      // For Tauri, we handle files differently
      return (file as any).path || file.name
    }
  },
  
  // Additional database operations for compatibility
  deleteTableRows: (tableName: string, condition: any) =>
    invoke('delete_table_row', { table_name: tableName, condition }),
  insertTableRows: (tableName: string, rows: any[]) =>
    Promise.all(rows.map(row => invoke('insert_table_row', { table_name: tableName, row_data: row }))),
  
  // File operations for compatibility
  downloadDatabaseFile: async (_deviceId: string, _remotePath: string, _packageName: string) => {
    // This would need to be implemented based on the specific requirements
    throw new Error('downloadDatabaseFile not implemented yet')
  },
  
  // Path operations
  getAppDataPath: async () => {
    const { appDataDir } = await import('@tauri-apps/api/path')
    return appDataDir()
  },
  
  getTempPath: async () => {
    const { cacheDir } = await import('@tauri-apps/api/path')
    return await cacheDir()
  }
}

// For backward compatibility with existing code
export const electronAPI = {
  platform: navigator.platform.toLowerCase().includes('mac') ? 'darwin' : 
           navigator.platform.toLowerCase().includes('win') ? 'win32' : 'linux'
}
