import type { DeviceInfo } from '@renderer/types'
import { create } from 'zustand'

interface ApplicationInfo {
  name: string
  bundleId: string
  packageName: string
  version?: string
  size?: number
  hasDatabase?: boolean
}

interface DeviceStore {
  devicesList: DeviceInfo[]
  setDevicesList: (devices: DeviceInfo[]) => void
  selectedDevice: DeviceInfo | null
  setSelectedDevice: (device: DeviceInfo | null) => void
  applicationsList: ApplicationInfo[]
  setApplicationsList: (apps: ApplicationInfo[]) => void
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
