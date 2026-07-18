export interface DeviceApi {
  checkAppExistence: (deviceId: string, applicationId: string) => Promise<any>
  getAndroidDatabaseFiles: (deviceId: string, applicationId: string) => Promise<any>
  getAndroidPackages: (deviceId: string) => Promise<any>
  getIOsDevicePackages: (deviceId: string) => Promise<any>
  getIOSDeviceDatabaseFiles: (deviceId: string, applicationId: string, scanRequestId?: string) => Promise<any>
  getIOSPackages: (deviceId: string) => Promise<any>
  getIOSSimulatorDatabaseFiles: (deviceId: string, applicationId: string) => Promise<any>
}

interface DeviceApiDependencies {
  invokeCommandWithResponse: (electronCommand: string, dataFieldName: string, ...args: any[]) => Promise<{ success: boolean, [key: string]: any }>
}

export function createDeviceApi({ invokeCommandWithResponse }: DeviceApiDependencies): DeviceApi {
  return {
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

    getIOSSimulatorDatabaseFiles: (deviceId: string, applicationId: string) =>
      invokeCommandWithResponse('simulator:getIOSSimulatorDatabaseFiles', 'files', deviceId, applicationId),
  }
}
