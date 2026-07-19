import type { ApplicationSelection, DatabaseFile, DatabaseTable, DeviceInfo } from '@renderer/types'
import type { SelectionSessionActions } from './selectionSession'
import { useEffect } from 'react'
import {
  clearTableContext,
  reconcileSelectionWithDatabaseFiles,
  reconcileSelectionWithDatabaseTables,
} from './selectionSession'

interface DatabaseFileGroupOption {
  options?: DatabaseFile[]
}

interface UseSubHeaderSelectionEffectsParams {
  databaseFiles: Array<DatabaseFileGroupOption | DatabaseFile>
  databaseTables: DatabaseTable[]
  isDatabaseFilesScanning: boolean
  isDesktopMode: boolean
  selectedApplication: ApplicationSelection | null
  selectedDatabaseFile: DatabaseFile | null
  selectedDatabaseTable: DatabaseTable | null
  selectedDevice: DeviceInfo | null
  selectionActions: SelectionSessionActions
}

function isDatabaseFileGroupOption(
  optionOrGroup: DatabaseFileGroupOption | DatabaseFile,
): optionOrGroup is DatabaseFileGroupOption {
  return 'options' in optionOrGroup
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
  const flattenedDatabaseFiles = databaseFiles.flatMap<DatabaseFile>((optionOrGroup) => {
    if (isDatabaseFileGroupOption(optionOrGroup)) {
      return optionOrGroup.options ?? []
    }

    return [optionOrGroup]
  })

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
    flattenedDatabaseFiles,
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
