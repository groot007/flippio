import type { ApplicationSelection, DatabaseFile, DatabaseTable, DeviceInfo } from '@renderer/types'

interface TableDataState {
  columns: any[]
  isCustomQuery: boolean
  rows: any[]
  tableName?: string
}

export interface SelectionSessionActions {
  clearTableData: () => void
  setSelectedApplication: (application: ApplicationSelection | null) => void
  setSelectedDatabaseFile: (databaseFile: DatabaseFile | null) => void
  setSelectedDatabaseTable: (table: DatabaseTable | null) => void
  setSelectedDevice: (device: DeviceInfo | null) => void
  setSelectedRow: (row: unknown | null) => void
  setTableData?: (tableData: TableDataState) => void
}

interface SelectApplicationInput {
  actions: SelectionSessionActions
  addRecentApp?: (application: ApplicationSelection, deviceId: string, deviceName: string) => void
  application: ApplicationSelection | null
  currentDevice: DeviceInfo | null
}

interface RefreshSelectionGraphInput {
  allowMissingSelectedDevice?: boolean
  matchedApplication?: ApplicationSelection | null
  matchedDatabaseFile?: DatabaseFile | null
  matchedDevice?: DeviceInfo | null
  preserveDatabaseFile?: boolean
  selectedApplication?: ApplicationSelection | null
  selectedDatabaseFile?: DatabaseFile | null
  selectedDevice?: DeviceInfo | null
}

interface RefreshSelectionGraphResult {
  didClearSelectedApplication: boolean
  didClearSelectedDatabaseFile: boolean
  didClearSelectedDevice: boolean
  preservedMissingSelectedDevice: boolean
}

interface SelectDatabaseInput {
  actions: SelectionSessionActions
  databaseFile: DatabaseFile | null
}

interface SelectDesktopDatabaseInput {
  actions: SelectionSessionActions
  databaseFile: DatabaseFile
}

interface SelectDeviceInput {
  actions: SelectionSessionActions
  device: DeviceInfo | null
}

interface SelectTableInput {
  actions: SelectionSessionActions
  table: DatabaseTable | null
}

export function matchSelectedDevice(
  devices: DeviceInfo[],
  selectedDevice: DeviceInfo | null | undefined,
) {
  if (!selectedDevice) {
    return null
  }

  return devices.find(device => device.id === selectedDevice.id) ?? null
}

export function matchSelectedApplication(
  applications: ApplicationSelection[],
  selectedApplication: ApplicationSelection | null | undefined,
) {
  if (!selectedApplication) {
    return null
  }

  return applications.find(application => application.bundleId === selectedApplication.bundleId) ?? null
}

export function matchSelectedDatabaseFile(
  databaseFiles: DatabaseFile[],
  selectedDatabaseFile: DatabaseFile | null | undefined,
) {
  if (!selectedDatabaseFile) {
    return null
  }

  return databaseFiles.find(file =>
    (selectedDatabaseFile.remotePath && file.remotePath === selectedDatabaseFile.remotePath)
    || file.path === selectedDatabaseFile.path
    || file.filename === selectedDatabaseFile.filename,
  ) ?? null
}

export function clearTableContext(actions: SelectionSessionActions) {
  actions.setSelectedDatabaseTable(null)
  actions.clearTableData()
  actions.setSelectedRow(null)
}

export function selectDevice({ actions, device }: SelectDeviceInput) {
  actions.setSelectedDevice(device)
  actions.setSelectedApplication(null)
  actions.setSelectedDatabaseFile(null)
  clearTableContext(actions)
}

export function selectApplication({
  actions,
  addRecentApp,
  application,
  currentDevice,
}: SelectApplicationInput) {
  actions.setSelectedDatabaseFile(null)
  clearTableContext(actions)
  actions.setSelectedApplication(application)

  if (application && currentDevice && addRecentApp) {
    addRecentApp(application, currentDevice.id, currentDevice.name || currentDevice.id)
  }
}

export function selectDatabase({ actions, databaseFile }: SelectDatabaseInput) {
  actions.setSelectedDatabaseFile(databaseFile)
  clearTableContext(actions)
}

export function selectDesktopDatabase({ actions, databaseFile }: SelectDesktopDatabaseInput) {
  actions.setSelectedDevice(null)
  actions.setSelectedApplication(null)
  actions.setSelectedDatabaseFile(databaseFile)
  clearTableContext(actions)
}

export function selectTable({ actions, table }: SelectTableInput) {
  if (table && actions.setTableData) {
    actions.setTableData({
      rows: [],
      columns: [],
      isCustomQuery: false,
      tableName: table.name,
    })
  }

  actions.setSelectedRow(null)
  actions.setSelectedDatabaseTable(table)
}

export function refreshSelectionGraph(
  {
    allowMissingSelectedDevice = false,
    matchedApplication,
    matchedDatabaseFile,
    matchedDevice,
    preserveDatabaseFile = false,
    selectedApplication,
    selectedDatabaseFile,
    selectedDevice,
  }: RefreshSelectionGraphInput,
  actions: SelectionSessionActions,
): RefreshSelectionGraphResult {
  const result: RefreshSelectionGraphResult = {
    didClearSelectedApplication: false,
    didClearSelectedDatabaseFile: false,
    didClearSelectedDevice: false,
    preservedMissingSelectedDevice: false,
  }

  if (typeof matchedDevice !== 'undefined') {
    if (selectedDevice && !matchedDevice && allowMissingSelectedDevice) {
      result.preservedMissingSelectedDevice = true
      return result
    }

    if (selectedDevice && !matchedDevice) {
      actions.setSelectedDevice(null)
      actions.setSelectedApplication(null)
      result.didClearSelectedDevice = true
      result.didClearSelectedApplication = true
      if (!preserveDatabaseFile) {
        actions.setSelectedDatabaseFile(null)
        result.didClearSelectedDatabaseFile = true
      }
      clearTableContext(actions)
      return result
    }

    if (matchedDevice && matchedDevice !== selectedDevice) {
      actions.setSelectedDevice(matchedDevice)
    }
  }

  if (typeof matchedApplication !== 'undefined') {
    if (selectedApplication && !matchedApplication) {
      actions.setSelectedApplication(null)
      actions.setSelectedDatabaseFile(null)
      result.didClearSelectedApplication = true
      result.didClearSelectedDatabaseFile = true
      clearTableContext(actions)
      return result
    }

    if (matchedApplication && matchedApplication !== selectedApplication) {
      actions.setSelectedApplication(matchedApplication)
    }
  }

  if (typeof matchedDatabaseFile !== 'undefined') {
    if (selectedDatabaseFile && !matchedDatabaseFile) {
      actions.setSelectedDatabaseFile(null)
      result.didClearSelectedDatabaseFile = true
      clearTableContext(actions)
      return result
    }

    if (matchedDatabaseFile && matchedDatabaseFile !== selectedDatabaseFile) {
      actions.setSelectedDatabaseFile(matchedDatabaseFile)
    }
  }

  return result
}
