import process from 'node:process'
import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'

// Custom APIs for renderer
const api = {
  getDevices: () => ipcRenderer.invoke('adb:getDevices'),
  getIOSPackages: (deviceId: string) => ipcRenderer.invoke('device:getIosPackages', deviceId),
  getAndroidPackages: (deviceId: string) =>
    ipcRenderer.invoke('adb:getPackages', deviceId),
  getAndroidDatabaseFiles: (deviceId: string, applicationId) =>
    ipcRenderer.invoke('adb:getAndroidDatabaseFiles', deviceId, applicationId),
  getIOSDatabaseFiles: (deviceId: string, applicationId) =>
    ipcRenderer.invoke('adb:getIOSDatabaseFiles', deviceId, applicationId),
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
  executeQuery: (query: string) =>
    ipcRenderer.invoke('db:executeQuery', query),
}

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
  // @ts-expect-error (define in dts)
  window.electron = electronAPI
  // @ts-expect-error (define in dts)
  window.api = api
}
