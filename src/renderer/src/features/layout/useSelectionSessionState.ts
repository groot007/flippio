import { useCurrentDatabaseSelection, useCurrentDeviceSelection } from '@renderer/store'
import { useMemo } from 'react'

export function useSelectionSessionState() {
  const selectedDevice = useCurrentDeviceSelection(state => state.selectedDevice)
  const selectedApplication = useCurrentDeviceSelection(state => state.selectedApplication)
  const selectedDatabaseFile = useCurrentDatabaseSelection(state => state.selectedDatabaseFile)
  const selectedDatabaseTable = useCurrentDatabaseSelection(state => state.selectedDatabaseTable)

  return useMemo(() => ({
    selectedApplication,
    selectedDatabaseFile,
    selectedDatabaseTable,
    selectedDevice,
  }), [
    selectedApplication,
    selectedDatabaseFile,
    selectedDatabaseTable,
    selectedDevice,
  ])
}
