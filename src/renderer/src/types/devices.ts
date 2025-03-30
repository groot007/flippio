export interface DeviceInfo {
  deviceType: 'android' | 'iphone'
  id: string
  model: string
  name: string
}

export interface DatabaseFile {
  path: string
  filename: string
  packageName: string
}

export interface DatabaseTable {
  name: string
  deviceType: 'android' | 'iphone'
}
