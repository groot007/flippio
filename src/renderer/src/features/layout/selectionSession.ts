import type { DatabaseFile, DatabaseTable, DeviceInfo } from '@renderer/types'

interface ApplicationInfo {
  bundleId: string
  name: string
}

interface TableDataState {
  columns: any[]
  isCustomQuery: boolean
  rows: any[]
  tableName?: string
}

interface SelectionSessionActions {
  clearTableData: () => void
  setSelectedApplication: (application: ApplicationInfo | null) => void
  setSelectedDatabaseFile: (databaseFile: DatabaseFile | null) => void
  setSelectedDatabaseTable: (table: DatabaseTable | null) => void
  setSelectedDevice: (device: DeviceInfo | null) => void
  setSelectedRow: (row: unknown | null) => void
  setTableData?: (tableData: TableDataState) => void
}

interface SelectApplicationInput {
  actions: SelectionSessionActions
  addRecentApp?: (application: ApplicationInfo, deviceId: string, deviceName: string) => void
  application: ApplicationInfo | null
  currentDevice: DeviceInfo | null
}

interface RefreshSelectionGraphInput {
  matchedApplication?: ApplicationInfo | null
  matchedDatabaseFile?: DatabaseFile | null
  matchedDevice?: DeviceInfo | null
  preserveDatabaseFile?: boolean
  selectedApplication?: ApplicationInfo | null
  selectedDatabaseFile?: DatabaseFile | null
  selectedDevice?: DeviceInfo | null
}

interface SelectDatabaseInput {
  actions: SelectionSessionActions
  databaseFile: DatabaseFile | null
}

interface SelectDeviceInput {
  actions: SelectionSessionActions
  device: DeviceInfo | null
}

interface SelectTableInput {
  actions: SelectionSessionActions
  table: DatabaseTable | null
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

export function selectTable({ actions, table }: SelectTableInput) {
  if (table && actions.setTableData) {
    actions.setTableData({
      rows: [],
      columns: [],
      isCustomQuery: false,
      tableName: table.name,
    })
  }

  actions.setSelectedDatabaseTable(table)
}

export function refreshSelectionGraph(
  {
    matchedApplication,
    matchedDatabaseFile,
    matchedDevice,
    preserveDatabaseFile = false,
    selectedApplication,
    selectedDatabaseFile,
    selectedDevice,
  }: RefreshSelectionGraphInput,
  actions: SelectionSessionActions,
) {
  if (typeof matchedDevice !== 'undefined') {
    if (selectedDevice && !matchedDevice) {
      actions.setSelectedDevice(null)
      actions.setSelectedApplication(null)
      if (!preserveDatabaseFile) {
        actions.setSelectedDatabaseFile(null)
      }
      clearTableContext(actions)
      return
    }

    if (matchedDevice && matchedDevice !== selectedDevice) {
      actions.setSelectedDevice(matchedDevice)
    }
  }

  if (typeof matchedApplication !== 'undefined') {
    if (selectedApplication && !matchedApplication) {
      actions.setSelectedApplication(null)
      actions.setSelectedDatabaseFile(null)
      clearTableContext(actions)
      return
    }

    if (matchedApplication && matchedApplication !== selectedApplication) {
      actions.setSelectedApplication(matchedApplication)
    }
  }

  if (typeof matchedDatabaseFile !== 'undefined') {
    if (selectedDatabaseFile && !matchedDatabaseFile) {
      actions.setSelectedDatabaseFile(null)
      clearTableContext(actions)
      return
    }

    if (matchedDatabaseFile && matchedDatabaseFile !== selectedDatabaseFile) {
      actions.setSelectedDatabaseFile(matchedDatabaseFile)
    }
  }
}
