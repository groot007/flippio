import { useCurrentDatabaseSelection, useCurrentDeviceSelection } from '@renderer/store'
import { useMemo } from 'react'

export type SelectionWorkflowMode = 'desktop' | 'device' | 'empty'

export function useSelectionSessionState() {
  const selectedDevice = useCurrentDeviceSelection(state => state.selectedDevice)
  const selectedApplication = useCurrentDeviceSelection(state => state.selectedApplication)
  const selectedDatabaseFile = useCurrentDatabaseSelection(state => state.selectedDatabaseFile)
  const selectedDatabaseTable = useCurrentDatabaseSelection(state => state.selectedDatabaseTable)

  const workflowMode: SelectionWorkflowMode = selectedDatabaseFile?.deviceType === 'desktop'
    ? 'desktop'
    : selectedDevice
      ? 'device'
      : 'empty'

  return useMemo(() => ({
    isDesktopMode: workflowMode === 'desktop',
    isDeviceMode: workflowMode === 'device',
    selectedApplication,
    selectedDatabaseFile,
    selectedDatabaseTable,
    selectedDevice,
    workflowMode,
  }), [
    selectedApplication,
    selectedDatabaseFile,
    selectedDatabaseTable,
    selectedDevice,
    workflowMode,
  ])
}
