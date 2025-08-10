import type { DeviceInfo } from '@renderer/types'
import { useCurrentDeviceSelection } from './useCurrentDeviceSelection'
import { useRecentlyUsedApps } from './useRecentlyUsedApps'

/**
 * Composite hook that provides complete device management functionality
 * Combines device selection and recently used apps for streamlined device workflows
 */
export function useDeviceManagement() {
  const deviceStore = useCurrentDeviceSelection()
  const recentAppsStore = useRecentlyUsedApps()

  return {
    // Device selection
    devicesList: deviceStore.devicesList,
    selectedDevice: deviceStore.selectedDevice,
    setDevicesList: deviceStore.setDevicesList,
    setSelectedDevice: deviceStore.setSelectedDevice,
    
    // Application selection
    applicationsList: deviceStore.applicationsList,
    selectedApplication: deviceStore.selectedApplication,
    setApplicationsList: deviceStore.setApplicationsList,
    setSelectedApplication: deviceStore.setSelectedApplication,
    
    // Database pulling state
    isDBPulling: deviceStore.isDBPulling,
    setIsDBPulling: deviceStore.setIsDBPulling,
    
    // Recent apps functionality
    recentApps: recentAppsStore.recentApps,
    addRecentApp: recentAppsStore.addRecentApp,
    getRecentAppsForDevice: recentAppsStore.getRecentAppsForDevice,
    clearRecentApps: recentAppsStore.clearRecentApps,
    removeAppFromRecents: recentAppsStore.removeAppFromRecents,
    
    // Convenience methods
    selectDeviceAndClearSelection: (device: DeviceInfo | null) => {
      deviceStore.setSelectedDevice(device)
      deviceStore.setSelectedApplication(null)
      deviceStore.setApplicationsList([])
    },
    
    selectApplicationAndMarkRecent: (app: any) => {
      if (deviceStore.selectedDevice && app) {
        deviceStore.setSelectedApplication(app)
        recentAppsStore.addRecentApp(
          { name: app.name, bundleId: app.bundleId },
          deviceStore.selectedDevice.id,
          deviceStore.selectedDevice.name,
        )
      }
    },
  }
}

export type DeviceManagement = ReturnType<typeof useDeviceManagement>
