import { join } from 'node:path'
import process from 'node:process'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import * as Sentry from '@sentry/electron/main'
import { app, BrowserWindow, shell } from 'electron'
import { autoUpdater } from 'electron-updater'

import { setupIpcADB } from './ipcADB'
import { setupIpcCommon } from './ipcCommon'
import { setupIpcDatabase } from './ipcDatabase'
import { registerVirtualDeviceHandlers } from './ipcVirtualDevices'
import './autoUpdaterEvents'

Sentry.init({
  dsn: 'https://561d196b910f78c86856522f199f9ef6@o4509048883970048.ingest.de.sentry.io/4509048886132816',
});

(async () => {
  const { default: fixPath } = await import('fix-path')
  fixPath()
})()

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    minWidth: 500,
    minHeight: 600,
    show: true,
    autoHideMenuBar: true,
    backgroundColor: '#1a202c',
    title: 'Flipio - database explorer for iOS and Android',
    // ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    // mainWindow.webContents.openDevTools();
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  }
  else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  setupIpcADB()
  setupIpcCommon()
  setupIpcDatabase()
  registerVirtualDeviceHandlers() // Add this line to register virtual device handlers

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0)
      createWindow()
  })

  autoUpdater.checkForUpdatesAndNotify()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  app.quit()
})
