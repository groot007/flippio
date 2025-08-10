import type { AppHeaderContainerProps } from './types'

import { useCurrentDatabaseSelection } from '@renderer/features/database/stores'
import { useApplications, useDevices } from '@renderer/features/devices/hooks'
import { useCurrentDeviceSelection, useRecentlyUsedApps } from '@renderer/features/devices/stores'
import { toaster } from '@renderer/ui/toaster'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppHeaderPresenter } from './AppHeaderPresenter'

export function AppHeaderContainer(_props: AppHeaderContainerProps) {
  const [isVirtualDeviceModalOpen, setIsVirtualDeviceModalOpen] = useState(false)
  const [isPackageSetModalOpen, setIsPackageSetModalOpen] = useState(false)

  // Store selections
  const selectedDevice = useCurrentDeviceSelection(state => state.selectedDevice)
  const setSelectedDevice = useCurrentDeviceSelection(state => state.setSelectedDevice)
  const selectedApplication = useCurrentDeviceSelection(state => state.selectedApplication)
  const setSelectedApplication = useCurrentDeviceSelection(state => state.setSelectedApplication)
  const selectedDatabaseFile = useCurrentDatabaseSelection(state => state.selectedDatabaseFile)
  const setSelectedDatabaseFile = useCurrentDatabaseSelection(state => state.setSelectedDatabaseFile)
  
  const { addRecentApp, getRecentAppsForDevice } = useRecentlyUsedApps()

  // Data fetching
  const {
    data: devicesList = [],
    refetch: refreshDevices,
    isFetching: isRefreshing,
  } = useDevices()

  const {
    isLoading,
    data: applicationsList = [],
    error: applicationsError,
    isError: isApplicationsError,
  } = useApplications(selectedDevice)

  // Package set modal logic
  const closePackageSetModal = useCallback(() => {
    setIsPackageSetModalOpen(false)
  }, [])

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (selectedDevice?.deviceType === 'iphone-device' && isLoading) {
      timer = setTimeout(() => {
        setIsPackageSetModalOpen(true)
      }, 5000)
    }
    else {
      setIsPackageSetModalOpen(false)
    }
    return () => {
      clearTimeout(timer)
    }
  }, [selectedDevice, isLoading])

  // Error handling for iOS devices
  useEffect(() => {
    if (isApplicationsError && applicationsError && selectedDevice?.deviceType === 'iphone-device') {
      const errorMessage = applicationsError.message || ''
      
      if (errorMessage.includes('Could not start com.apple.mobile.installation_proxy')) {
        toaster.create({
          title: 'iPhone Connection Issue',
          description: 'Cannot access iPhone apps. Please unlock your phone. Enable Developer Mode (iOS 16+)\\n\\nThen try again.',
          type: 'error',
          duration: 10000,
          meta: { closable: true },
        })
      }
      else if (errorMessage.includes('Device not found') || errorMessage.includes('No device found')) {
        toaster.create({
          title: 'iPhone Not Found',
          description: 'iPhone is not detected. Please check USB connection and try reconnecting your device.',
          type: 'error',
          duration: 6000,
          meta: { closable: true },
        })
      }
      else {
        toaster.create({
          title: 'iPhone Error',
          description: `Failed to load iPhone apps: ${errorMessage}`,
          type: 'error',
          duration: 6000,
          meta: { closable: true },
        })
      }
    }
  }, [isApplicationsError, applicationsError, selectedDevice])

  // Device list sync
  useEffect(() => {
    if (!devicesList.find(device => device.id === selectedDevice?.id)) {
      setSelectedApplication(null)
      setSelectedDevice(null)
      
      // Only clear database file if it's not a custom file (desktop type)
      if (selectedDatabaseFile?.deviceType !== 'desktop') {
        setSelectedDatabaseFile(null)
      }
    }
  }, [devicesList, selectedDevice, selectedDatabaseFile, setSelectedApplication, setSelectedDevice, setSelectedDatabaseFile])

  // Event handlers
  const handleRefreshDevices = useCallback(() => {
    refreshDevices()
      .then(() => {
        toaster.create({
          title: 'Success',
          description: 'Device list refreshed',
          type: 'success',
          duration: 3000,
          meta: { closable: true },
        })
      })
      .catch((err) => {
        toaster.create({
          title: 'Error refreshing devices',
          description: err.message,
          type: 'error',
          duration: 3000,
          meta: { closable: true },
        })
      })
  }, [refreshDevices])

  const handleDeviceChange = useCallback((value: any) => {
    setSelectedDevice(value)
    setSelectedApplication(null)
  }, [setSelectedDevice, setSelectedApplication])

  const handlePackageChange = useCallback((value: any) => {
    setSelectedDatabaseFile(null)
    setSelectedApplication(value)
    
    // Add to recently used apps if we have a device and app selected
    if (selectedDevice && value) {
      addRecentApp(value, selectedDevice.id, selectedDevice.name || selectedDevice.id)
    }
  }, [setSelectedApplication, setSelectedDatabaseFile, selectedDevice, addRecentApp])

  const handleOpenVirtualDeviceModal = useCallback(() => {
    setIsVirtualDeviceModalOpen(true)
  }, [])

  const handleCloseVirtualDeviceModal = useCallback(() => {
    setIsVirtualDeviceModalOpen(false)
    setTimeout(() => {
      refreshDevices()
    }, 1500)
  }, [refreshDevices])

  // Computed values
  const devicesSelectOptions = useMemo(() =>
    devicesList.map((device) => {
      const osVersion = device.deviceType === 'iphone' ? (device as any).iosVersion || '' : ''
      return {
        label: device.label || `${device.name} ${osVersion}`,
        value: device.id,
        description: device.description || (device.deviceType?.includes('iphone') ? 'iOS' : 'Android'),
        ...device,
      }
    }), [devicesList])

  const applicationSelectOptions = useMemo(() => {
    if (!selectedDevice) 
      return []
    
    // Get recently used apps for the current device
    const recentApps = getRecentAppsForDevice(selectedDevice.id)
    const recentBundleIds = new Set(recentApps.map(app => app.bundleId))
    
    // Map all applications to options
    const allAppOptions = applicationsList.map((app: any) => {
      const description = app.bundleId === app.name ? '' : app.bundleId
      const isRecentlyUsed = recentBundleIds.has(app.bundleId)
      return {
        label: app.name,
        value: app.bundleId,
        description,
        isRecentlyUsed,
        ...app,
      } 
    })
    
    // Find recently used apps that are still available
    const recentAppOptions = recentApps
      .map((recentApp: any) => {
        const foundApp = applicationsList.find((app: any) => app.bundleId === recentApp.bundleId)
        if (foundApp) {
          const description = foundApp.bundleId === foundApp.name ? '' : foundApp.bundleId
          return {
            label: foundApp.name,
            value: foundApp.bundleId,
            description,
            isRecentlyUsed: true,
            ...foundApp,
          }
        }
        return null
      })
      .filter(Boolean)
      .slice(0, 3) // Limit to top 3 recent apps
    
    // Filter out recently used apps from the main list to avoid duplicates
    const otherAppOptions = allAppOptions.filter((app: any) => !recentBundleIds.has(app.bundleId))
    
    // Combine: recent apps first, then all other apps
    return [...recentAppOptions, ...otherAppOptions]
  }, [applicationsList, selectedDevice, getRecentAppsForDevice])

  return (
    <AppHeaderPresenter
      devicesSelectOptions={devicesSelectOptions}
      applicationSelectOptions={applicationSelectOptions}
      selectedDevice={selectedDevice}
      selectedApplication={selectedApplication}
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      isVirtualDeviceModalOpen={isVirtualDeviceModalOpen}
      isPackageSetModalOpen={isPackageSetModalOpen}
      onDeviceChange={handleDeviceChange}
      onPackageChange={handlePackageChange}
      onRefreshDevices={handleRefreshDevices}
      onOpenVirtualDeviceModal={handleOpenVirtualDeviceModal}
      onCloseVirtualDeviceModal={handleCloseVirtualDeviceModal}
      onClosePackageSetModal={closePackageSetModal}
    />
  )
}
