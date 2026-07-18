import type { DeviceInfo } from '@renderer/types'
import { create } from 'zustand'

interface ApplicationInfo {
  name: string
  bundleId: string
}

interface DeviceStore {
  selectedDevice: DeviceInfo | null
  setSelectedDevice: (device: DeviceInfo | null) => void
  selectedApplication: ApplicationInfo | null
  setSelectedApplication: (app: ApplicationInfo | null) => void
}

export const useCurrentDeviceSelection = create<DeviceStore>((set, _get) => ({
  selectedDevice: null,
  setSelectedDevice: device => set({ selectedDevice: device }),
  selectedApplication: null,
  setSelectedApplication: app => set({ selectedApplication: app }),
}))
