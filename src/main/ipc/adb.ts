import { exec } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { ipcMain } from 'electron'
import log from 'electron-log'
import { getIOsDevices, getIOsSimulators } from './ios'

interface DatabaseFile {
  path: string
  packageName: string
  filename: string
  location: string
  remotePath?: string
  deviceType: 'android' | 'iphone' | 'desktop'
}

const tempDirPath = path.join(os.tmpdir(), 'flippio-db-temp')

async function pullAndroidDBFiles(packageName, deviceId, remotePath, localPath = '', location) {
  try {
    const filename = path.basename(remotePath)

    if (fs.existsSync(tempDirPath)) {
      fs.rmSync(tempDirPath, { recursive: true, force: true })
      fs.mkdirSync(tempDirPath, { recursive: true })
    }

    if (!localPath) {
      localPath = path.join(tempDirPath, `${filename}`)
    }

    let callCmd = `adb -s ${deviceId} exec-out run-as ${packageName} cat ${remotePath} > ${localPath}`

    if (location.admin === false) {
      callCmd = `adb -s ${deviceId} pull ${remotePath} ${localPath}`
    }

    await new Promise<void>((resolve, reject) => {
      log.info(`Running command pull: ${callCmd}`)
      exec(callCmd, (error, _stdout, _stderr) => {
        if (error) {
          reject(error)
        }
        else {
          resolve()
        }
      })
    })

    // Store the origin information with the file
    const metadataPath = `${localPath}.meta.json`
    const metadata = {
      deviceId,
      packageName,
      remotePath,
      timestamp: new Date().toISOString(),
    }
    await fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))

    return {
      success: true,
      path: localPath,
      metadata: {
        deviceId,
        packageName,
        remotePath,
      },
    }
  }
  catch (error: any) {
    log.error('Error pulling android database file', error)
    return { success: false, error: error.message }
  }
}

export function setupIpcADB() {
  if (!fs.existsSync(tempDirPath)) {
    fs.mkdirSync(tempDirPath, { recursive: true })
  }

  // find "$(xcrun simctl get_app_container booted com.abbott.adc.polaris.dev data)" -name "*.db"

  // ADB operations
  ipcMain.handle('adb:getDevices', async () => {
    try {
      const deviceList = await new Promise<string>((resolve, reject) => {
        exec('adb devices -l', (error, stdout, stderr) => {
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

      // Parse device list output
      const lines = deviceList.split('\n').filter(line => line.trim().length > 0)
      const devices: Array<{ id: string, name: string, model: string, deviceType: string }> = []

      // Skip the first line (header) and parse each device
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        const parts = line.split(' ').filter(part => part.trim().length > 0)

        if (parts.length >= 2) {
          const id = parts[0]

          // Extract device info
          let model = 'Unknown'
          let name = 'Android Device'

          parts.forEach((part) => {
            if (part.startsWith('model:')) {
              model = part.split(':')[1]
            }
            else if (part.startsWith('device:')) {
              name = part.split(':')[1]
            }
          })

          devices.push({ id, name, model, deviceType: 'android' })
        }
      }

      const iosEmulators = await getIOsSimulators()

      const iosDevices = await getIOsDevices()

      const allDevices = devices.concat(iosEmulators).concat(iosDevices)

      return { success: true, devices: allDevices }
    }
    catch (error: any) {
      log.error('Error getting Android devices', error)
      return { success: false, error: error.message }
    }
  })

  // Get list of packages on a device
  ipcMain.handle('adb:getPackages', async (_event, deviceId) => {
    try {
      // Get a list of all packages
      const installedApps = await new Promise<string>((resolve, reject) => {
        exec(`adb -s ${deviceId} shell pm list packages -3`, (error, stdout, stderr) => { // -3 lists only user-installed apps
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

      // Parse the list of installed packages
      const apps = installedApps.split('\n').filter(line => line.trim().length > 0)
      const userApps = apps.map(app => app.replace('package:', '').trim())

      const packages = userApps.sort((a, b) => a.localeCompare(b)).map((pkg) => {
        // const parts = pkg.split('.')
        // const name = parts[parts.length - 1].replace(/_/g, ' ').replace(/-/g, ' ')
        return {
          name: pkg,
          bundleId: pkg,
        }
      })

      return { success: true, packages }
    }
    catch (error: any) {
      log.error('Error getting Android packages', error)
      return { success: false, error: error.message }
    }
  })

  // Get database files for a specific package
  ipcMain.handle('adb:getAndroidDatabaseFiles', async (_event, deviceId, packageName) => {
    try {
      const databaseFiles: DatabaseFile[] = []

      // Try to list database files in various common locations
      const locations = {
        '/data/data/': {
          admin: true, // This location requires root or run-as access
        },
        '/sdcard/Android/data/': {
          admin: false,
        },
      }

      await Promise.all(Object.entries(locations).map(async ([location, options]) => {
        try {
          // Use run-as to list files in the package's data directory
          const adminCmd = options.admin ? `run-as ${packageName}` : ''
          const cmd = `adb -s ${deviceId} shell ${adminCmd} find ${location}${packageName}/ -name "*.db" -o -name "*.sqlite" -o -name "*.sqlite3" 2>/dev/null`

          log.info(`Running command: ${cmd}`)

          const filesOutput = await new Promise<string>((resolve, _reject) => {
            exec(cmd, (_error, stdout, _stderr) => {
              // We don't reject here because some errors are expected
              // (e.g., app not debuggable, directory doesn't exist)
              resolve(stdout || '')
            })
          })

          // Process found files
          const filePaths = filesOutput.split('\n').filter(line => line.trim().length > 0)

          const pulledFiles = await Promise.all(
            filePaths.map(async (filePath) => {
              const filename = path.basename(filePath)

              const pulledFileData = await pullAndroidDBFiles(packageName, deviceId, filePath, '', location)

              return {
                path: pulledFileData.path || filePath,
                packageName,
                filename,
                location,
                remotePath: filePath,
                deviceType: 'android',
              } as DatabaseFile
            }),
          )

          databaseFiles.push(...pulledFiles)
        }
        catch (err) {
          // Silently fail for individual locations - we'll still try others
          log.error(`Could not access ${location} for ${packageName}:`, err)
        }
      }))

      return { success: true, files: databaseFiles }
    }
    catch (error: any) {
      log.error('Error getting database files', error)
      return { success: false, error: error.message }
    }
  })

  // New handler to push database back to device
  ipcMain.handle('adb:pushDatabaseFile', async (_event, deviceId, localPath, packageName, remotePath) => {
    try {
      // First, push to /data/local/tmp which is accessible via adb
      const filename = path.basename(localPath)
      const tmpPath = `/data/local/tmp/${filename}`

      if (remotePath.includes('sdcard') || remotePath.includes('external')) {
        await new Promise<void>((resolve, reject) => {
          exec(`adb -s ${deviceId} push ${localPath} ${remotePath}`, (error, _stdout, _stderr) => {
            if (error) {
              reject(error)
            }
            else {
              resolve()
            }
          })
        })

        return
      }

      // Push the file to device tmp directory
      await new Promise<void>((resolve, reject) => {
        exec(`adb -s ${deviceId} push "${localPath}" ${tmpPath}`, (error, _stdout, stderr) => {
          if (error) {
            reject(error)
          }
          else if (stderr && !stderr.includes('pushed') && !stderr.includes('100%')) {
            reject(new Error(stderr))
          }
          else {
            resolve()
          }
        })
      })

      // Then use run-as to copy from tmp to app's data dir
      await new Promise<void>((resolve, reject) => {
        const cmd = `adb -s ${deviceId} shell run-as ${packageName} cp ${tmpPath} ${remotePath}`
        exec(cmd, (error, _stdout, stderr) => {
          if (error) {
            reject(error)
          }
          else if (stderr) {
            reject(new Error(stderr))
          }
          else {
            resolve()
          }
        })
      })

      // Clean up the temp file on the device
      exec(`adb -s ${deviceId} shell rm ${tmpPath}`)

      return {
        success: true,
        message: `Database successfully pushed to ${remotePath}`,
      }
    }
    catch (error: any) {
      log.error('Error pushing database file', error)
      return {
        success: false,
        error: error.message,
        instructions: `
    1. Try manually with these commands:
       adb -s ${deviceId} push "${localPath}" /data/local/tmp/${path.basename(localPath)}
       adb -s ${deviceId} shell run-as ${packageName} cp /data/local/tmp/${path.basename(localPath)} ${remotePath}
    
    2. If that fails, check permissions or try with root:
       adb -s ${deviceId} shell "su -c 'cp /data/local/tmp/${path.basename(localPath)} ${remotePath}'"
    `,
      }
    }
  })
}
