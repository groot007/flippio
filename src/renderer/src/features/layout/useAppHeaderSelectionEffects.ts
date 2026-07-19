import type { ApplicationSelection, DatabaseFile, DeviceInfo } from '@renderer/types'
import type { SelectionSessionActions } from './selectionSession'
import { useEffect } from 'react'
import { reconcileSelectionWithApplications, reconcileSelectionWithDevices } from './selectionSession'

interface UseAppHeaderSelectionEffectsParams {
  applications: ApplicationSelection[]
  devices: DeviceInfo[]
  isApplicationsError: boolean
  isDesktopMode: boolean
  isLoadingApplications: boolean
  selectedApplication: ApplicationSelection | null
  selectedDatabaseFile: DatabaseFile | null
  selectedDevice: DeviceInfo | null
  selectionActions: SelectionSessionActions
}

export function useAppHeaderSelectionEffects({
  applications,
  devices,
  isApplicationsError,
  isDesktopMode,
  isLoadingApplications,
  selectedApplication,
  selectedDatabaseFile,
  selectedDevice,
  selectionActions,
}: UseAppHeaderSelectionEffectsParams) {
  useEffect(() => {
    if (!selectedDevice) {
      return
    }

    reconcileSelectionWithDevices(
      {
        allowMissingSelectedDevice: selectedDevice.deviceType === 'iphone-device',
        devices,
        preserveDatabaseFile: isDesktopMode,
        selectedApplication,
        selectedDatabaseFile,
        selectedDevice,
      },
      selectionActions,
    )
  }, [devices, isDesktopMode, selectedApplication, selectedDatabaseFile, selectedDevice, selectionActions])

  useEffect(() => {
    if (!selectedApplication || isLoadingApplications || isApplicationsError) {
      return
    }

    reconcileSelectionWithApplications(
      {
        applications,
        selectedDevice,
        selectedApplication,
        selectedDatabaseFile,
      },
      selectionActions,
    )
  }, [
    applications,
    isApplicationsError,
    isLoadingApplications,
    selectedApplication,
    selectedDatabaseFile,
    selectedDevice,
    selectionActions,
  ])
}
