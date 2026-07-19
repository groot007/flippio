import type { ApplicationSelection, DeviceInfo } from '@renderer/types'
import { create } from 'zustand'

interface DeviceStore {
  selectedDevice: DeviceInfo | null
  setSelectedDevice: (device: DeviceInfo | null) => void
  selectedApplication: ApplicationSelection | null
  setSelectedApplication: (app: ApplicationSelection | null) => void
}

export const useCurrentDeviceSelection = create<DeviceStore>((set, _get) => ({
  selectedDevice: null,
  setSelectedDevice: device => set({ selectedDevice: device }),
  selectedApplication: null,
  setSelectedApplication: app => set({ selectedApplication: app }),
}))
