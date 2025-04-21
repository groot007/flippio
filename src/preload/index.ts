import process from 'node:process'
import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer, webUtils } from 'electron'

// Custom APIs for renderer
const api = {
  getDevices: () => ipcRenderer.invoke('adb:getDevices'),
  getIOSPackages: (deviceId: string) => ipcRenderer.invoke('device:getIosPackages', deviceId),
  getAndroidPackages: (deviceId: string) =>
    ipcRenderer.invoke('adb:getPackages', deviceId),
  getIOsDevicePackages: (deviceId: string) =>
    ipcRenderer.invoke('device:getIosDevicePackages', deviceId),
  getAndroidDatabaseFiles: (deviceId: string, applicationId) =>
    ipcRenderer.invoke('adb:getAndroidDatabaseFiles', deviceId, applicationId),
  checkAppExistence: (deviceId: string, applicationId: string) =>
    ipcRenderer.invoke('device:checkAppExistence', deviceId, applicationId),
  getIOSDatabaseFiles: (deviceId: string, applicationId) =>
    ipcRenderer.invoke('adb:getIOSDatabaseFiles', deviceId, applicationId),
  getIOSDeviceDatabaseFiles: (deviceId: string, applicationId) =>
    ipcRenderer.invoke('device:getIOSDeviceDatabaseFiles', deviceId, applicationId),
  pullDatabaseFile: (deviceId: string, remotePath: string, localPath: string = '') =>
    ipcRenderer.invoke('adb:pullDatabaseFile', deviceId, remotePath, localPath),
  pushDatabaseFile: (deviceId: string, localPath: string, packageName: string, remotePath: string) =>
    ipcRenderer.invoke('adb:pushDatabaseFile', deviceId, localPath, packageName, remotePath),
  getTables: () => ipcRenderer.invoke('db:getTables'),
  openDatabase: (filePath: string) => ipcRenderer.invoke('db:open', filePath),
  getTableInfo: (tableName: string) =>
    ipcRenderer.invoke('db:getTableData', tableName),
  updateTableRow: (tableName: string, row: any, condition: any) =>
    ipcRenderer.invoke('db:updateTableRow', tableName, row, condition),
  executeQuery: (query: string, dbPath: string) =>
    ipcRenderer.invoke('db:executeQuery', query, dbPath),
  insertTableRow: (tableName: string, row: any) =>
    ipcRenderer.invoke('db:insertTableRow', tableName, row),
  deleteTableRow: (tableName: string, condition: any) =>
    ipcRenderer.invoke('db:deleteTableRow', tableName, condition),

  openFile: () => ipcRenderer.invoke('dialog:selectFile'),
  exportFile: file => ipcRenderer.invoke('dialog:saveFile', file),
  webUtils,
  // Virtual device methods
  getAndroidEmulators: () => ipcRenderer.invoke('getAndroidEmulators'),
  getIOSSimulators: () => ipcRenderer.invoke('getIOSSimulators'),
  launchAndroidEmulator: (emulatorId: string) => ipcRenderer.invoke('launchAndroidEmulator', emulatorId),
  launchIOSSimulator: (simulatorId: string) => ipcRenderer.invoke('launchIOSSimulator', simulatorId),
}

contextBridge.exposeInMainWorld('env', {
  NODE_ENV: process.env.NODE_ENV,
  SENTRY_DSN: process.env.SENTRY_DSN,
})

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  }
  catch (error) {
    console.error(error)
  }
}
else {
  window.electron = electronAPI
  window.api = api
}
