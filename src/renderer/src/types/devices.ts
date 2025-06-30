type DeviceType = 'android' | 'iphone' | 'desktop' | 'iphone-device' | 'emulator' | 'simulator'
export interface DeviceInfo {
  deviceType: DeviceType
  id: string
  model: string
  name: string
  label?: string
  description?: string
  platform?: string
}

export interface DatabaseFile {
  path: string
  filename: string
  packageName: string
  location: string
  remotePath?: string
  deviceType?: DeviceType
}

export interface DatabaseTable {
  name: string
  deviceType?: DeviceType
}
