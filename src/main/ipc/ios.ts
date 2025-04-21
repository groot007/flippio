// Add these inside your setupIpcADB function
// After the getIOsDevices function

import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { ipcMain } from 'electron'

import { getBinariesPath } from '../utils'

const dbLocations = ['Documents', 'Library', 'Library/Caches', 'Library/Preferences']
/**
 * Gets packages installed on a physical iOS device
 */
async function getIOsDevicePackages(deviceId: string): Promise<{ name: string, bundleId: string }[]> {
  const binaryPath = `${getBinariesPath()}/ideviceinstaller`

  try {
    // Run ideviceinstaller to get user-installed apps
    const { stdout } = await promisify(execFile)(binaryPath, ['-u', deviceId, '-l', '-o', 'list_user'])
    const lines = stdout.trim().split('\n')
    const packages = [] as { name: string, bundleId: string }[]

    // Skip first line (header) if present
    const startIndex = lines[0].includes('CFBundleIdentifier') ? 1 : 0

    // Parse list of packages
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line)
        continue

      // Extract bundle ID - expecting format: "com.example.app - App Name"
      const match = line.split(',').map(item => item.trim())

      if (match) {
        const [bundleId,,appName] = match
        packages.push({
          name: `${appName.trim().replace(/"/g, '')}(${bundleId})`,
          bundleId: bundleId.trim(),
        })
      }
      else {
        // Fallback parsing if format is different
        const bundleId = line.split(' ')[0].replace('"', '')
        packages.push({
          name: bundleId.split('.').pop() || bundleId,
          bundleId,
        })
      }
    }

    return packages
  }
  catch (error) {
    console.error('Error getting iOS device packages:', error)
    return [] // Return empty array on error
  }
}

/**
 * Get database files from an iOS app using afcclient
 */
async function getIOsDeviceDbFiles(deviceId: string, packageName: string): Promise<any[]> {
  const databaseFiles = [] as any[]
  const afcPath = `${getBinariesPath()}/afcclient`
  const tempDirPath = path.join(os.tmpdir(), 'flippio-db-temp')
  if (!fs.existsSync(tempDirPath)) {
    fs.mkdirSync(tempDirPath, { recursive: true })
  }

  try {
    // Get list of app directories
    // const { stdout } = await promisify(execFile)(afcPath, ['--container', packageName, '-u', deviceId, 'ls', '/'])
    // const directories = stdout.trim().split('\n')

    // Common locations for database files

    // Look in each common location for database files
    for (const location of dbLocations) {
      try {
        // List files in the directory
        const { stdout: dirContents } = await promisify(execFile)(
          afcPath,
          ['--container', packageName, '-u', deviceId, 'ls', `/${location}`],
        )

        // Filter for database file extensions
        const files = dirContents.trim().split('\n')
        const dbFiles = files.filter(file =>
          file.endsWith('.db')
          || file.endsWith('.sqlite')
          || file.endsWith('.sqlite3')
          || file.endsWith('.sqlitedb'),
        )

        // Copy each found database to local temp directory
        for (const dbFile of dbFiles) {
          const remotePath = `/${location}/${dbFile}`
          const localPath = path.join(tempDirPath, dbFile)

          // Copy file from device to local
          await promisify(execFile)(
            afcPath,
            ['--container', packageName, '-u', deviceId, 'get', remotePath, localPath],
          )

          // Add to results
          databaseFiles.push({
            path: localPath,
            packageName,
            filename: dbFile,
            location,
            deviceType: 'iphone-device',
          })
        }
      }
      catch (locError) {
        // Continue if a directory can't be accessed
        console.warn(`Could not access ${location} in ${packageName}:`, locError)
      }
    }

    return databaseFiles
  }
  catch (error) {
    console.error(`Error getting database files for iOS app ${packageName}:`, error)
    return []
  }
}

export async function setupIOsDevice() {
// Add IPC handlers for the new methods
  ipcMain.handle('device:getIosDevicePackages', async (_event, deviceId: string) => {
    try {
      const packages = await getIOsDevicePackages(deviceId)
      return { success: true, packages }
    }
    catch (error: any) {
      console.error('Error getting iOS device packages:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('device:getIOSDeviceDatabaseFiles', async (_event, deviceId: string, packageName: string) => {
    try {
      const files = await getIOsDeviceDbFiles(deviceId, packageName)
      return { success: true, files }
    }
    catch (error: any) {
      console.error('Error getting iOS device database files:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('device:checkAppExistence', async (_event, deviceId: string, packageName: string) => {
    const afcPath = `${getBinariesPath()}/afcclient`
    try {
      await promisify(execFile)(
        afcPath,
        ['--container', packageName, '-u', deviceId, 'ls', `/Documents`],
      )
      return { success: true }
    }
    catch (error: any) {
      console.error('Error getting iOS device database files:', error)
      return { success: false, error: error.message }
    }
  })
}
