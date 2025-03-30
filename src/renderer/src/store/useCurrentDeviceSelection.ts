import type { DeviceInfo } from '@renderer/types'
import { create } from 'zustand'

interface ApplicationInfo {
  name: string
  bundleId: string
}

interface DeviceStore {
  devicesList: DeviceInfo[] | null
  setDevicesList: (devices: DeviceInfo[] | null) => void
  selectedDevice: DeviceInfo | null
  setSelectedDevice: (device: DeviceInfo | null) => void
  applicationsList: ApplicationInfo[] | null
  setApplicationsList: (apps: ApplicationInfo[] | null) => void
  selectedApplication: ApplicationInfo | null
  setSelectedApplication: (app: ApplicationInfo | null) => void
  isDBPulling: boolean
  setIsDBPulling: (isPulling: boolean) => void
}

export const useCurrentDeviceSelection = create<DeviceStore>((set, _get) => ({
  devicesList: [],
  setDevicesList: devices => set({ devicesList: devices }),
  selectedDevice: null,
  setSelectedDevice: device => set({ selectedDevice: device }),
  applicationsList: [],
  setApplicationsList: apps => set({ applicationsList: apps }),
  selectedApplication: null,
  setSelectedApplication: app => set({ selectedApplication: app }),
  isDBPulling: false,
  setIsDBPulling: isPulling => set({ isDBPulling: isPulling }),
}))
