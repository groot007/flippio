type DeviceType = 'android' | 'iphone' | 'desktop' | 'iphone-device'
export interface DeviceInfo {
  deviceType: DeviceType
  id: string
  model: string
  name: string
}

export interface DatabaseFile {
  path: string
  filename: string
  packageName: string
  deviceType?: DeviceType
}

export interface DatabaseTable {
  name: string
  deviceType?: DeviceType
}
