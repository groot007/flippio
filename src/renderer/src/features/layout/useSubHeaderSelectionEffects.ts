import type { ApplicationSelection, DatabaseFile, DatabaseTable, DeviceInfo } from '@renderer/types'
import type { SelectionSessionActions } from './selectionSession'
import { useEffect } from 'react'
import {
  clearTableContext,
  reconcileSelectionWithDatabaseFiles,
  reconcileSelectionWithDatabaseTables,
} from './selectionSession'

interface UseSubHeaderSelectionEffectsParams {
  databaseFiles: Array<{ options?: DatabaseFile[] } | DatabaseFile>
  databaseTables: DatabaseTable[]
  isDatabaseFilesScanning: boolean
  isDesktopMode: boolean
  selectedApplication: ApplicationSelection | null
  selectedDatabaseFile: DatabaseFile | null
  selectedDatabaseTable: DatabaseTable | null
  selectedDevice: DeviceInfo | null
  selectionActions: SelectionSessionActions
}

export function useSubHeaderSelectionEffects({
  databaseFiles,
  databaseTables,
  isDatabaseFilesScanning,
  isDesktopMode,
  selectedApplication,
  selectedDatabaseFile,
  selectedDatabaseTable,
  selectedDevice,
  selectionActions,
}: UseSubHeaderSelectionEffectsParams) {
  useEffect(() => {
    if (!selectedDatabaseFile?.filename) {
      clearTableContext(selectionActions)
    }
  }, [selectedDatabaseFile, selectionActions])

  useEffect(() => {
    if (
      !selectedDatabaseFile
      || isDesktopMode
      || isDatabaseFilesScanning
      || selectedDevice?.deviceType === 'iphone-device'
    ) {
      return
    }

    const flattenedDatabaseFiles = databaseFiles.flatMap(optionOrGroup => optionOrGroup.options ?? [optionOrGroup])
    reconcileSelectionWithDatabaseFiles(
      {
        databaseFiles: flattenedDatabaseFiles,
        selectedApplication,
        selectedDatabaseFile,
        selectedDatabaseTable,
        selectedDevice,
      },
      selectionActions,
    )
  }, [
    databaseFiles,
    isDesktopMode,
    isDatabaseFilesScanning,
    selectedApplication,
    selectedDatabaseFile,
    selectedDatabaseTable,
    selectedDevice,
    selectionActions,
  ])

  useEffect(() => {
    if (!selectedDatabaseTable) {
      return
    }

    reconcileSelectionWithDatabaseTables(
      {
        databaseTables,
        selectedApplication,
        selectedDatabaseFile,
        selectedDatabaseTable,
        selectedDevice,
      },
      selectionActions,
    )
  }, [
    databaseTables,
    selectedApplication,
    selectedDatabaseFile,
    selectedDatabaseTable,
    selectedDevice,
    selectionActions,
  ])
}
