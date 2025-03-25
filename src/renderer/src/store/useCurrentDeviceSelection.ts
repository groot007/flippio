import { create } from 'zustand'

interface DeviceInfo {
  deviceType: 'android' | 'iphone'
  id: string
  model: string
  name: string
}

interface ApplicationInfo {
  name: string
  bundleId: string
}

interface DeviceStore {
  devicesList: DeviceInfo[]
  setDevicesList: (devices: DeviceInfo[]) => void
  selectedDevice: DeviceInfo
  setSelectedDevice: (device: DeviceInfo) => void
  applicationsList: ApplicationInfo[]
  setApplicationsList: (apps: ApplicationInfo[]) => void
  selectedApplication: ApplicationInfo
  setSelectedApplication: (app: ApplicationInfo) => void
  isDBPulling: boolean
  setIsDBPulling: (isPulling: boolean) => void
}

export const useCurrentDeviceSelection = create<DeviceStore>((set, _get) => ({
  devicesList: [],
  setDevicesList: devices => set({ devicesList: devices }),
  selectedDevice: {
    id: '',
    model: '',
    name: '',
    deviceType: 'android',
  },
  setSelectedDevice: device => set({ selectedDevice: device }),
  applicationsList: [],
  setApplicationsList: apps => set({ applicationsList: apps }),
  selectedApplication: {
    name: '',
    bundleId: '',
  },
  setSelectedApplication: app => set({ selectedApplication: app }),
  isDBPulling: false,
  setIsDBPulling: isPulling => set({ isDBPulling: isPulling }),
}))
