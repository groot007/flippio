// Add these inside your setupIpcADB function
// After the getIOsDevices function

import {
  exec,
  execFile,
  spawn,
} from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  promisify,
} from 'node:util'
import {
  ipcMain,
} from 'electron'

import log from 'electron-log'
import {
  getBinariesPath,
} from '../utils'

interface DatabaseFile {
  path: string
  packageName: string
  filename: string
  location: string
  remotePath?: string
  deviceType: 'android' | 'iphone' | 'desktop'
}

interface Device {
  id: string
  name: string
  model: string
  deviceType: string
}

const libdeviceToolsPath = path.join(getBinariesPath(), 'libimobiledevice', 'tools')

const dbLocations = ['Documents', 'Library', 'Library/Caches', 'Library/Preferences']
/**
 * Gets packages installed on a physical iOS device
 */
export async function getIOsDevicePackages(deviceId: string): Promise <{
  name: string
  bundleId: string
} []> {
  const binaryPath = `${libdeviceToolsPath}/ideviceinstaller`

  try {
    // Run ideviceinstaller to get user-installed apps
    const {
      stdout,
    } = await promisify(execFile)(binaryPath, ['-u', deviceId, '-l', '-o', 'list_user'])
    const lines = stdout.trim().split('\n')
    const packages = [] as {
      name: string
      bundleId: string
    } []

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
        const [bundleId, , appName] = match
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
    log.error('Error getting iOS device packages:', error)
    return [] // Return empty array on error
  }
}

/**
 * Get database files from an iOS app using afcclient
 */
async function getIOsDeviceDbFiles(deviceId: string, packageName: string): Promise <any[]> {
  const databaseFiles = [] as any[]
  const afcPath = `${libdeviceToolsPath}/afcclient`
  const tempDirPath = path.join(os.tmpdir(), 'flippio-db-temp')
  if (await fs.existsSync(tempDirPath)) {
    // remove the directory if it exists
    await fs.rmSync(tempDirPath, {
      recursive: true,
      force: true,
    })
    await fs.mkdirSync(tempDirPath, {
      recursive: true,
    })
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
        const {
          stdout: dirContents,
        } = await promisify(execFile)(
          afcPath,
          ['--documents', packageName, '-u', deviceId, 'ls', `/${location}`],
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

          log.info('Copying database file: ', ['--documents', packageName, '-u', deviceId, 'get', remotePath, localPath].join(' '))

          // Copy file from device to local
          await promisify(execFile)(
            afcPath,
            ['--documents', packageName, '-u', deviceId, 'get', remotePath, localPath],
          )

          // Add to results
          databaseFiles.push({
            path: localPath,
            packageName,
            filename: dbFile,
            remotePath,
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
    log.error(`Error getting database files for iOS app ${packageName}:`, error)
    return []
  }
}

async function uploadIOsDbFile(deviceId: string, localFilePath: string, packageName: string, remoteLocation: string): Promise <boolean> {
  const afcPath = `${libdeviceToolsPath}/afcclient`

  try {
    if (!fs.existsSync(localFilePath)) {
      throw new Error(`Local file ${localFilePath} does not exist`)
    }

    const remoteFileName = path.basename(localFilePath)

    const child = spawn(afcPath, ['--documents', packageName, '-u', deviceId])

    child.stdin.write('cd Documents\n')
    child.stdin.write(`rm ${remoteFileName}\n`)
    child.stdin.write('exit\n')
    child.stdin.end()

    await once(child, 'close')

    log.info(`Uploading ${localFilePath} to ${remoteLocation} on device ${deviceId}`)

    // Upload the file using afcclient
    await promisify(execFile)(
      afcPath,
      ['--documents', packageName, '-u', deviceId, 'put', localFilePath, remoteLocation],
    )

    return true
  }
  catch (error) {
    log.error(`Error uploading database file to iOS device:`, error)
    return false
  }
}

export async function getIOsSimulators() {
  try {
    // Get all simulators, not just booted ones
    const deviceList = await new Promise <string> ((resolve, reject) => {
      // Get all devices as JSON for easier parsing
      exec('xcrun simctl list devices --json', (error, stdout, stderr) => {
        if (error) {
          reject(error)
        }
        else if (stderr) {
          reject(new Error(stderr))
        }
        else {
          resolve(stdout)
        }
      })
    })

    try {
      // Parse the JSON output
      const simulatorsData = JSON.parse(deviceList)
      const devices: any[] = []

      // Process all runtime versions
      Object.entries(simulatorsData.devices).forEach(([runtimeName, runtimeDevices]: [string, any]) => {
        // Filter out the iOS version from the runtime name (e.g., "iOS 17.0")
        const iosVersion = runtimeName.includes('iOS-')
          ? runtimeName.split('iOS-')[1].replace(/-/g, '.')
          : 'Unknown'

        // Add each device with additional properties
        runtimeDevices.filter((device: any) => device.state === 'Booted').forEach((device: any) => {
          devices.push({
            name: device.name,
            udid: device.udid,
            deviceType: 'iphone',
            iosVersion,
            id: device.udid,
            model: device.name,
            runtime: runtimeName,
          })
        })
      })

      return devices
    }
    catch (parseError) {
      log.error('Error parsing simulator JSON data', parseError)
      return []
    }
  }
  catch (error: any) {
    log.error('Error getting iOS simulators', error)
    return []
  }
}

async function getIOsIds(): Promise <string[]> {
  const binaryPath = `${libdeviceToolsPath}/idevice_id`

  try {
    // Convert callback-based execFile to Promise
    const {
      stdout,
    } = await promisify(execFile)(binaryPath, ['-l'])
    const uuids = stdout.trim().split('\n').filter(id => id.length > 0)
    return uuids
  }
  catch (error) {
    log.error('Error listing iOS devices:', error)
    return [] // Return empty array on error
  }
}

export async function getIOsDevices(): Promise <Device[]> {
  const binaryPath = `${libdeviceToolsPath}/ideviceinfo`
  const uuids = await getIOsIds()
  const devices: Device[] = []

  if (uuids.length === 0) {
    return devices // Early return if no devices found
  }

  // Process each device sequentially with proper promise handling
  try {
    // Map each UUID to a Promise that resolves with device info
    const devicePromises = uuids.map(async (uuid) => {
      try {
        // IMPORTANT: Fix argument format (-u and uuid as separate items)
        const {
          stdout,
        } = await promisify(execFile)(binaryPath, ['-u', uuid])

        const deviceInfo: Record <string, string> = {
          id: uuid,
          deviceType: 'iphone-device',
        }

        stdout.split('\n').forEach((line) => {
          if (line.includes(':')) {
            const [key, value] = line.split(':').map(str => str.trim())
            deviceInfo[key] = value
          }
        })

        deviceInfo.model = deviceInfo.DeviceName || deviceInfo.Model || 'Unknown'

        return deviceInfo
      }
      catch (error) {
        log.error(`Error getting device info for ${uuid}:`, error)
        // Return partial info on error
        return {
          id: uuid,
          deviceType: 'iphone-device',
          error: (error as Error).message,
        }
      }
    })

    // Wait for all device info to be collected
    const deviceInfoResults = await Promise.all(devicePromises)
    // @ts-expect-error expanded deviceInfoResults
    return deviceInfoResults
  }
  catch (error) {
    log.error('Error processing iOS devices:', error)
    return devices
  }
}

export async function setupIOsDevice() {
  ipcMain.handle('device:getIOsDevices', async () => {
    return getIOsDevices()
  })

  ipcMain.handle('device:getIosPackages', async (_event, deviceId) => {
    try {
      const packages = await new Promise <string> ((resolve, reject) => {
        exec(`xcrun simctl listapps ${deviceId} | plutil -convert json -o - -- - | jq '[to_entries | .[] | {name: .value.CFBundleDisplayName, bundleId: .key}]'`, (error, stdout, stderr) => {
          if (error) {
            reject(error)
          }
          else if (stderr) {
            reject(new Error(stderr))
          }
          else {
            resolve(stdout)
          }
        })
      })

      const parsedPackages = JSON.parse(packages)

      return {
        success: true,
        packages: parsedPackages,
      }
    }
    catch (error: any) {
      log.error('Error getting IOs packages', error)
      return {
        success: false,
        error: error.message,
      }
    }
  })

  ipcMain.handle('device:getIosDevicePackages', async (_event, deviceId: string) => {
    try {
      const packages = await getIOsDevicePackages(deviceId)
      return {
        success: true,
        packages,
      }
    }
    catch (error: any) {
      log.error('Error getting iOS device packages:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  })

  ipcMain.handle('device:getIOSDeviceDatabaseFiles', async (_event, deviceId: string, packageName: string) => {
    try {
      const files = await getIOsDeviceDbFiles(deviceId, packageName)
      return {
        success: true,
        files,
      }
    }
    catch (error: any) {
      log.error('Error getting iOS device database files:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  })

  ipcMain.handle('adb:getIOSDatabaseFiles', async (_event, deviceId, packageName) => {
    try {
      const databaseFiles: DatabaseFile[] = []

      // Get the app's data container path
      const containerPathCmd = `xcrun simctl get_app_container ${deviceId} ${packageName} data`
      const containerPath = await new Promise <string> ((resolve, reject) => {
        exec(containerPathCmd, (error, stdout, stderr) => {
          if (error) {
            reject(error)
          }
          else if (stderr) {
            reject(new Error(stderr))
          }
          else {
            resolve(stdout.trim())
          }
        })
      })

      // Search for database files
      const fileExtensions = ['db', 'sqlite', 'sqlite3', 'sqlitedb']
      const findPattern = fileExtensions.map(ext => `-name "*.${ext}"`).join(' -o ')
      const findCmd = `find "${containerPath}" ${findPattern} 2>/dev/null`

      const filesOutput = await new Promise <string> ((resolve, reject) => {
        exec(findCmd, (error, stdout, _stderr) => {
          if (error) {
            reject(error)
          }
          else {
            // We don't reject on stderr since 'find' might have permission warnings
            resolve(stdout)
          }
        })
      })

      // Process found files
      const filePaths = filesOutput.split('\n').filter(line => line.trim().length > 0)

      filePaths.forEach((filePath) => {
        const filename = path.basename(filePath)
        // Determine relative location from container path
        const relativePath = filePath.replace(containerPath, '').split('/').filter(p => p).shift() || 'root'

        databaseFiles.push({
          path: filePath,
          packageName,
          filename,
          remotePath: filePath,
          location: relativePath,
          deviceType: 'iphone',
        })
      })

      return {
        success: true,
        files: databaseFiles,
      }
    }
    catch (error: any) {
      log.error('Error getting iOS database files', error)
      return {
        success: false,
        error: error.message,
      }
    }
  })

  ipcMain.handle('device:checkAppExistence', async (_event, deviceId: string, packageName: string) => {
    const afcPath = `${libdeviceToolsPath}/afcclient`
    try {
      await promisify(execFile)(
        afcPath,
        ['--container', packageName, '-u', deviceId, 'ls', `/Documents`],
      )
      return {
        success: true,
      }
    }
    catch (error: any) {
      log.error('Error getting iOS device database files:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  })

  // Add this new IPC handler for uploading database files
  ipcMain.handle('device:uploadIOSDbFile', async (_event, deviceId: string, packageName: string, localFilePath: string, remoteLocation: string) => {
    try {
      const success = await uploadIOsDbFile(deviceId, packageName, localFilePath, remoteLocation)
      if (success) {
        return {
          success: true,
        }
      }
      else {
        return {
          success: false,
          error: 'Failed to upload database',
        }
      }
    }
    catch (error: any) {
      log.error('Error uploading iOS database file:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  })
}
