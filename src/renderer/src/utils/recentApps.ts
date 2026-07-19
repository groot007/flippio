import type { ApplicationSelection } from '@renderer/types'

export interface RecentlyUsedApp {
  bundleId: string
  name: string
  deviceId: string
  deviceName: string
  lastUsed: number
  useCount: number
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const MAX_RECENT_APPS_PER_DEVICE = 10
const MAX_RECENT_APPS_FOR_DISPLAY = 3

export function buildUpdatedRecentApps(
  recentApps: RecentlyUsedApp[],
  app: ApplicationSelection,
  deviceId: string,
  deviceName: string,
  now = Date.now(),
) {
  const existingIndex = recentApps.findIndex(
    recent => recent.bundleId === app.bundleId && recent.deviceId === deviceId,
  )

  let updatedRecentApps: RecentlyUsedApp[]

  if (existingIndex >= 0) {
    updatedRecentApps = [...recentApps]
    updatedRecentApps[existingIndex] = {
      ...updatedRecentApps[existingIndex],
      lastUsed: now,
      useCount: updatedRecentApps[existingIndex].useCount + 1,
      name: app.name,
    }
  }
  else {
    updatedRecentApps = [
      {
        bundleId: app.bundleId,
        name: app.name,
        deviceId,
        deviceName,
        lastUsed: now,
        useCount: 1,
      },
      ...recentApps,
    ]
  }

  const thirtyDaysAgo = now - THIRTY_DAYS_MS
  const deviceApps = updatedRecentApps
    .filter(recentApp => recentApp.deviceId === deviceId && recentApp.lastUsed > thirtyDaysAgo)
    .sort((left, right) => right.lastUsed - left.lastUsed)
    .slice(0, MAX_RECENT_APPS_PER_DEVICE)

  const otherDeviceApps = updatedRecentApps
    .filter(recentApp => recentApp.deviceId !== deviceId && recentApp.lastUsed > thirtyDaysAgo)

  return [...deviceApps, ...otherDeviceApps]
}

export function selectRecentAppsForDevice(recentApps: RecentlyUsedApp[], deviceId: string) {
  return recentApps
    .filter(app => app.deviceId === deviceId)
    .sort((left, right) => right.lastUsed - left.lastUsed)
    .slice(0, MAX_RECENT_APPS_FOR_DISPLAY)
}
