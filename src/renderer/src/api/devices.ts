export interface DeviceSummary {
  id: string
  name?: string
  model?: string
  label?: string
  description?: string
  platform?: string
  deviceType?: string
  state?: string
}

export interface GetDevicesResult {
  success: boolean
  devices?: DeviceSummary[]
  error?: string
}

export interface CancelIOSDeviceDatabaseScanResult {
  success: boolean
  result?: unknown
  error?: string
}

export interface DeviceApi {
  cancelIOSDeviceDatabaseScan: (scanKey: string) => Promise<CancelIOSDeviceDatabaseScanResult>
  checkAppExistence: (deviceId: string, applicationId: string) => Promise<any>
  getAndroidDatabaseFiles: (deviceId: string, applicationId: string) => Promise<any>
  getAndroidPackages: (deviceId: string) => Promise<any>
  getDevices: () => Promise<GetDevicesResult>
  getIOsDevicePackages: (deviceId: string) => Promise<any>
  getIOSDeviceDatabaseFiles: (deviceId: string, applicationId: string, scanRequestId?: string) => Promise<any>
  refreshIOSDeviceDatabaseFile: (deviceId: string, applicationId: string, remotePath: string) => Promise<any>
  getIOSPackages: (deviceId: string) => Promise<any>
  getIOSSimulatorDatabaseFiles: (deviceId: string, applicationId: string) => Promise<any>
}

interface DeviceApiDependencies {
  invokeCommandWithResponse: (electronCommand: string, dataFieldName: string, ...args: any[]) => Promise<{ success: boolean, [key: string]: any }>
}

export function createDeviceApi({ invokeCommandWithResponse }: DeviceApiDependencies): DeviceApi {
  return {
    getDevices: async () => {
      try {
        const androidResp = await invokeCommandWithResponse('adb:getDevices', 'devices')
        const iosResp = await invokeCommandWithResponse('device:getIOsDevices', 'devices')

        let iosSimulatorsResp: { success: boolean, simulators: DeviceSummary[] } = { success: false, simulators: [] }
        const abortController = new AbortController()
        const timeoutId = setTimeout(() => abortController.abort(), 5000)

        try {
          const result = await Promise.race([
            invokeCommandWithResponse('getIOSSimulators', 'simulators'),
            new Promise<{ success: boolean, simulators: DeviceSummary[] }>((_, reject) => {
              abortController.signal.addEventListener('abort', () => {
                reject(new Error('iOS Simulators fetch timed out'))
              })
            }),
          ])
          iosSimulatorsResp = { success: result.success, simulators: result.simulators || [] }
          clearTimeout(timeoutId)
        }
        catch (error) {
          clearTimeout(timeoutId)
          console.warn('Failed to fetch iOS simulators, continuing without them:', error)
          iosSimulatorsResp = { success: false, simulators: [] }
        }

        const allDevices: DeviceSummary[] = []

        if (androidResp.success && androidResp.devices) {
          androidResp.devices.forEach((device: DeviceSummary) => {
            allDevices.push({
              ...device,
              label: `${device.name || device.id}`,
              description: device.description || 'Android',
            })
          })
        }

        if (iosResp.success && iosResp.devices) {
          iosResp.devices.forEach((device: DeviceSummary) => {
            allDevices.push({
              ...device,
              label: `${device.name || device.id}`,
              description: 'iPhone Device',
            })
          })
        }

        if (iosSimulatorsResp.success && iosSimulatorsResp.simulators) {
          iosSimulatorsResp.simulators
            .filter((simulator: DeviceSummary) => simulator.state === 'Booted')
            .forEach((simulator: DeviceSummary) => {
              allDevices.push({
                id: simulator.id,
                name: simulator.name,
                model: simulator.name,
                label: `${simulator.model}`,
                description: 'iPhone Simulator',
                platform: 'ios',
                deviceType: 'simulator',
              })
            })
        }

        return { success: true, devices: allDevices }
      }
      catch (error) {
        console.error('Error getting devices:', error)
        return { success: false, error: (error as Error).message }
      }
    },

    getIOSPackages: (deviceId: string) => {
      console.log('getIOSPackages called with deviceId:', deviceId)
      return invokeCommandWithResponse('device:getIosPackages', 'packages', deviceId)
    },

    getAndroidPackages: (deviceId: string) =>
      invokeCommandWithResponse('adb:getPackages', 'packages', deviceId),

    getIOsDevicePackages: (deviceId: string) =>
      invokeCommandWithResponse('device:getIosDevicePackages', 'packages', deviceId),

    getAndroidDatabaseFiles: (deviceId: string, applicationId: string) =>
      invokeCommandWithResponse('adb:getAndroidDatabaseFiles', 'files', deviceId, applicationId),

    checkAppExistence: (deviceId: string, applicationId: string) =>
      invokeCommandWithResponse('device:checkAppExistence', 'exists', deviceId, applicationId),

    getIOSDeviceDatabaseFiles: (deviceId: string, applicationId: string, scanRequestId?: string) =>
      invokeCommandWithResponse('device:getIOSDeviceDatabaseFiles', 'files', deviceId, applicationId, scanRequestId),

    refreshIOSDeviceDatabaseFile: (deviceId: string, applicationId: string, remotePath: string) =>
      invokeCommandWithResponse('device:refreshIOSDeviceDatabaseFile', 'file', deviceId, applicationId, remotePath),

    getIOSSimulatorDatabaseFiles: (deviceId: string, applicationId: string) =>
      invokeCommandWithResponse('simulator:getIOSSimulatorDatabaseFiles', 'files', deviceId, applicationId),

    cancelIOSDeviceDatabaseScan: (scanKey: string) =>
      invokeCommandWithResponse('device:cancelIOSDeviceDatabaseScan', 'result', scanKey),
  }
}
