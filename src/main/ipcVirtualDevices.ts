import { exec } from 'node:child_process'
import util from 'node:util'
import { ipcMain } from 'electron'

const execPromise = util.promisify(exec)

// Get a list of available Android emulators
export async function getAndroidEmulators() {
  try {
    const { stdout } = await execPromise('emulator -list-avds')

    if (!stdout.trim()) {
      return { success: true, emulators: [] }
    }

    const runningDevicesResult = await execPromise('adb devices')
    const runningDevices = runningDevicesResult.stdout.split('\n')
      .slice(1) // Skip the first line which is the "List of devices attached" header
      .filter(line => line.includes('emulator-') && line.includes('\tdevice'))
      .map(line => line.split('\t')[0].replace('emulator-', ''))

    const emulators = stdout.split('\n')
      .filter(name => name.trim().length > 0)
      .map(name => ({
        name: name.trim(),
        id: name.trim(),
        platform: 'android' as const,
        status: runningDevices.includes(name.trim()) ? 'running' : 'stopped',
      }))

    return { success: true, emulators }
  }
  catch (error) {
    console.error('Error getting Android emulators:', error)
    return { success: false, error: 'Failed to retrieve Android emulators' }
  }
}

// Get a list of available iOS simulators
export async function getIOSSimulators() {
  try {
    // Check if xcrun is available (macOS only)
    try {
      await execPromise('which xcrun')
    }
    catch {
      return { success: true, simulators: [] } // Return empty if xcrun isn't available (non-macOS)
    }

    const { stdout } = await execPromise('xcrun simctl list devices available --json')
    const devices = JSON.parse(stdout).devices

    // Get list of booted simulators
    const { stdout: bootedStdout } = await execPromise('xcrun simctl list devices booted --json')
    const bootedDevices = JSON.parse(bootedStdout).devices

    const bootedIds = Object.values(bootedDevices)
      .flat()
      .map((device: any) => device.udid)

    // Extract all simulators from different iOS versions
    let simulators: Array<{
      name: string
      id: string
      platform: 'ios'
      status: string
    }> = []

    for (const [runtimeName, deviceList] of Object.entries(devices)) {
      if (Array.isArray(deviceList)) {
        const runtime = runtimeName.replace('com.apple.CoreSimulator.SimRuntime.', '').replace('-', ' ')

        const devicesFromRuntime = (deviceList as any[]).map(device => ({
          name: `${device.name} (${runtime})`,
          id: device.udid,
          platform: 'ios' as const,
          status: bootedIds.includes(device.udid) ? 'running' : 'stopped',
        }))

        simulators = [...simulators, ...devicesFromRuntime]
      }
    }

    return { success: true, simulators }
  }
  catch (error) {
    console.error('Error getting iOS simulators:', error)
    return { success: false, error: 'Failed to retrieve iOS simulators' }
  }
}

// Launch an Android emulator
export async function launchAndroidEmulator(emulatorId: string) {
  try {
    // Launch the emulator in the background
    const child = exec(`emulator -avd "${emulatorId}"`, (error) => {
      if (error) {
        console.error(`Error launching Android emulator: ${error}`)
      }
    })

    // Don't wait for it to complete, just return success
    child.unref()
    return { success: true }
  }
  catch (error) {
    console.error('Error launching Android emulator:', error)
    return { success: false, error: 'Failed to launch Android emulator' }
  }
}

// Launch an iOS simulator
export async function launchIOSSimulator(simulatorId: string) {
  try {
    // Check if xcrun is available (macOS only)
    try {
      await execPromise('which xcrun')
    }
    catch {
      return { success: false, error: 'iOS simulators are only available on macOS' }
    }

    // Boot simulator if not already running
    await execPromise(`xcrun simctl boot "${simulatorId}"`)

    // Open simulator app
    await execPromise('open -a Simulator')

    return { success: true }
  }
  catch (error) {
    console.error('Error launching iOS simulator:', error)
    return { success: false, error: 'Failed to launch iOS simulator' }
  }
}

// Register IPC handlers
export function registerVirtualDeviceHandlers(): void {
  ipcMain.handle('getAndroidEmulators', async () => {
    return await getAndroidEmulators()
  })

  ipcMain.handle('getIOSSimulators', async () => {
    return await getIOSSimulators()
  })

  ipcMain.handle('launchAndroidEmulator', async (_, emulatorId: string) => {
    return await launchAndroidEmulator(emulatorId)
  })

  ipcMain.handle('launchIOSSimulator', async (_, simulatorId: string) => {
    return await launchIOSSimulator(simulatorId)
  })
}
