import type { ApplicationSelection } from '@renderer/types'
import type { RecentlyUsedApp } from '@renderer/utils/recentApps'
import { buildUpdatedRecentApps, selectRecentAppsForDevice } from '@renderer/utils/recentApps'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface RecentlyUsedAppsStore {
  recentApps: RecentlyUsedApp[]
  addRecentApp: (app: ApplicationSelection, deviceId: string, deviceName: string) => void
  getRecentAppsForDevice: (deviceId: string) => RecentlyUsedApp[]
  clearRecentApps: () => void
  removeAppFromRecents: (bundleId: string, deviceId: string) => void
}

export const useRecentlyUsedApps = create<RecentlyUsedAppsStore>()(
  persist(
    (set, get) => ({
      recentApps: [],

      addRecentApp: (app: ApplicationSelection, deviceId: string, deviceName: string) => {
        set({
          recentApps: buildUpdatedRecentApps(get().recentApps, app, deviceId, deviceName),
        })
      },

      getRecentAppsForDevice: (deviceId: string) => {
        return selectRecentAppsForDevice(get().recentApps, deviceId)
      },

      clearRecentApps: () => {
        set({ recentApps: [] })
      },

      removeAppFromRecents: (bundleId: string, deviceId: string) => {
        const { recentApps } = get()
        const updatedRecentApps = recentApps.filter(
          app => !(app.bundleId === bundleId && app.deviceId === deviceId),
        )
        set({ recentApps: updatedRecentApps })
      },
    }),
    {
      name: 'flippio-recently-used-apps',
      version: 1,
    },
  ),
)
