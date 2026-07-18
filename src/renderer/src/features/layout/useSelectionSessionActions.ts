import type { SelectionSessionActions } from './selectionSession'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection, useTableData } from '@renderer/store'
import { useRowEditingStore } from '@renderer/store/useRowEditingStore'
import { useMemo } from 'react'

export function useSelectionSessionActions(): SelectionSessionActions {
  const setSelectedDevice = useCurrentDeviceSelection(state => state.setSelectedDevice)
  const setSelectedApplication = useCurrentDeviceSelection(state => state.setSelectedApplication)
  const setSelectedDatabaseFile = useCurrentDatabaseSelection(state => state.setSelectedDatabaseFile)
  const setSelectedDatabaseTable = useCurrentDatabaseSelection(state => state.setSelectedDatabaseTable)
  const clearTableData = useTableData(state => state.clearTableData)
  const setTableData = useTableData(state => state.setTableData)
  const setSelectedRow = useRowEditingStore(state => state.setSelectedRow)

  return useMemo(() => ({
    clearTableData,
    setSelectedApplication,
    setSelectedDatabaseFile,
    setSelectedDatabaseTable,
    setSelectedDevice,
    setSelectedRow,
    setTableData,
  }), [
    clearTableData,
    setSelectedApplication,
    setSelectedDatabaseFile,
    setSelectedDatabaseTable,
    setSelectedDevice,
    setSelectedRow,
    setTableData,
  ])
}
