import { exec } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ipcMain } from 'electron'
import { parseSimulators } from './utils'

interface DatabaseFile {
  path: string
  packageName: string
  filename: string
  location: string
  deviceType: 'android' | 'iphone' | 'desktop'
}

export function setupIpcADB() {
  const tempDirPath = path.join(os.tmpdir(), 'flippio-db-temp')
  if (!fs.existsSync(tempDirPath)) {
    fs.mkdirSync(tempDirPath, { recursive: true })
  }

  const getIOsSimulators = async () => {
    try {
      const deviceList = await new Promise<string>((resolve, reject) => {
        exec('xcrun simctl list devices | grep Booted', (error, stdout, stderr) => {
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
      const devices = parseSimulators(deviceList)
      return devices
    }
    catch (error: any) {
      console.error('Error getting iOS devices', error)
      return []
    }
  }

  ipcMain.handle('device:getIosPackages', async (_event, deviceId) => {
    try {
      const packages = await new Promise<string>((resolve, reject) => {
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

      return { success: true, packages: parsedPackages }
    }
    catch (error: any) {
      console.error('Error getting IOs packages', error)
      return { success: false, error: error.message }
    }
  })

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

      const iosDevices = await getIOsSimulators()

      const allDevices = devices.concat(iosDevices)

      return { success: true, devices: allDevices }
    }
    catch (error: any) {
      console.error('Error getting Android devices', error)
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
      console.error('Error getting Android packages', error)
      return { success: false, error: error.message }
    }
  })

  // Get database files for a specific package
  ipcMain.handle('adb:getIOSDatabaseFiles', async (_event, deviceId, packageName) => {
    try {
      const databaseFiles: DatabaseFile[] = []

      // Get the app's data container path
      const containerPathCmd = `xcrun simctl get_app_container ${deviceId} ${packageName} data`
      const containerPath = await new Promise<string>((resolve, reject) => {
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

      const filesOutput = await new Promise<string>((resolve, reject) => {
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
          location: relativePath,
          deviceType: 'iphone',
        })
      })

      return { success: true, files: databaseFiles }
    }
    catch (error: any) {
      console.error('Error getting iOS database files', error)
      return { success: false, error: error.message }
    }
  })

  // Get database files for a specific package
  ipcMain.handle('adb:getAndroidDatabaseFiles', async (_event, deviceId, packageName) => {
    try {
      const databaseFiles: DatabaseFile[] = []

      // Try to list database files in various common locations
      const locations = [
        'databases',
        'files',
        'shared_prefs',
        'app_databases',
        'app_db',
      ]

      for (const location of locations) {
        try {
          // Use run-as to list files in the package's data directory
          const cmd = `adb -s ${deviceId} shell run-as ${packageName} find /data/data/${packageName}/${location} -name "*.db" -o -name "*.sqlite" -o -name "*.sqlite3" 2>/dev/null`

          const filesOutput = await new Promise<string>((resolve, _reject) => {
            exec(cmd, (_error, stdout, _stderr) => {
              // We don't reject here because some errors are expected
              // (e.g., app not debuggable, directory doesn't exist)
              resolve(stdout || '')
            })
          })

          // Process found files
          const filePaths = filesOutput.split('\n').filter(line => line.trim().length > 0)

          filePaths.forEach((filePath) => {
            const filename = path.basename(filePath)

            databaseFiles.push({
              path: filePath,
              packageName,
              filename,
              location,
              deviceType: 'android',
            })
          })
        }
        catch (err) {
          // Silently fail for individual locations - we'll still try others
          console.error(`Could not access ${location} for ${packageName}:`, err)
        }
      }

      return { success: true, files: databaseFiles }
    }
    catch (error: any) {
      console.error('Error getting database files', error)
      return { success: false, error: error.message }
    }
  })

  // Updated to use temp directory by default
  ipcMain.handle('adb:pullDatabaseFile', async (_event, deviceId, remotePath, localPath = '') => {
    try {
      // Extract package name and file path
      const parts = remotePath.split('/')
      const packageName = parts[3] // /data/data/PACKAGE_NAME/...
      const filename = path.basename(remotePath)

      // If no local path provided, use a temp path
      if (!localPath) {
        localPath = path.join(tempDirPath, `${filename}`)
      }

      // Use run-as to copy the database file to the local machine
      await new Promise<void>((resolve, reject) => {
        // Use exec-out to avoid text encoding issues with binary data
        const cmd = `adb -s ${deviceId} exec-out run-as ${packageName} cat ${remotePath} > ${localPath}`
        exec(cmd, (error, _stdout, stderr) => {
          if (error) {
            reject(error)
          }
          else if (stderr && !stderr.includes('pulled')) {
            reject(new Error(stderr))
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
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))

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
      console.error('Error pulling database file', error)
      return { success: false, error: error.message }
    }
  })

  // New handler to push database back to device
  ipcMain.handle('adb:pushDatabaseFile', async (_event, deviceId, localPath, packageName, remotePath) => {
    try {
      // First, push to /data/local/tmp which is accessible via adb
      const filename = path.basename(localPath)
      const tmpPath = `/data/local/tmp/${filename}`

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
      console.error('Error pushing database file', error)
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
