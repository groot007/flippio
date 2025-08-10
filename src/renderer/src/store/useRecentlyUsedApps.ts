import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ApplicationInfo {
  name: string
  bundleId: string
}

interface RecentlyUsedApp {
  bundleId: string
  name: string
  deviceId?: string
  deviceName?: string
  lastUsed: number
  useCount: number
}

interface RecentlyUsedAppsStore {
  recentApps: RecentlyUsedApp[]
  addRecentApp: (app: ApplicationInfo, deviceId: string, deviceName: string) => void
  getRecentAppsForDevice: (deviceId: string) => RecentlyUsedApp[]
  clearRecentApps: () => void
  removeAppFromRecents: (bundleId: string, deviceId: string) => void
}

export const useRecentlyUsedApps = create<RecentlyUsedAppsStore>()(
  persist(
    (set, get) => ({
      recentApps: [],

      addRecentApp: (app: ApplicationInfo, deviceId: string, deviceName: string) => {
        // Skip apps without bundleId
        if (!app.bundleId) {
          return
        }
        
        const { recentApps } = get()
        const now = Date.now()

        // Find existing app entry for this device
        const existingIndex = recentApps.findIndex(
          recent => recent.bundleId === app.bundleId && recent.deviceId === deviceId,
        )
        
        let updatedRecentApps: RecentlyUsedApp[]

        if (existingIndex >= 0 && recentApps[existingIndex]) {
          // Update existing entry
          updatedRecentApps = [...recentApps]
          const existingApp = updatedRecentApps[existingIndex]!
          updatedRecentApps[existingIndex] = {
            ...existingApp,
            lastUsed: now,
            useCount: existingApp.useCount + 1,
            name: app.name, // Update name in case it changed
          }
        }
        else {
          // Add new entry
          const newRecentApp: RecentlyUsedApp = {
            bundleId: app.bundleId,
            name: app.name,
            deviceId,
            deviceName,
            lastUsed: now,
            useCount: 1,
          }
          updatedRecentApps = [newRecentApp, ...recentApps]
        }

        // Keep only the most recent 10 apps per device and remove old entries (>30 days)
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000)
        const deviceApps = updatedRecentApps
          .filter(app => app.deviceId === deviceId && app.lastUsed > thirtyDaysAgo)
          .sort((a, b) => b.lastUsed - a.lastUsed)
          .slice(0, 10)

        const otherDeviceApps = updatedRecentApps
          .filter(app => app.deviceId !== deviceId && app.lastUsed > thirtyDaysAgo)

        set({ recentApps: [...deviceApps, ...otherDeviceApps] })
      },

      getRecentAppsForDevice: (deviceId: string) => {
        const { recentApps } = get()
        return recentApps
          .filter(app => app.deviceId === deviceId)
          .sort((a, b) => b.lastUsed - a.lastUsed)
          .slice(0, 3) // Return only top 3 for display
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
