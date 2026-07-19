import type { ApplicationSelection, DatabaseFile, DatabaseTable, DeviceInfo } from '@renderer/types'

interface TableDataState {
  columns: any[]
  isCustomQuery: boolean
  rows: any[]
  tableName?: string
}

export interface SelectionSessionState {
  selectedApplication: ApplicationSelection | null
  selectedDatabaseFile: DatabaseFile | null
  selectedDatabaseTable: DatabaseTable | null
  selectedDevice: DeviceInfo | null
  selectedRow: unknown | null
}

interface SelectionSessionEffects {
  clearTableContext: boolean
  tableData?: TableDataState
}

type SelectionSessionEvent
  = | {
    type: 'selectDevice'
    device: DeviceInfo | null
  }
  | {
    type: 'selectApplication'
    application: ApplicationSelection | null
  }
  | {
    type: 'selectDatabase'
    databaseFile: DatabaseFile | null
  }
  | {
    type: 'selectDesktopDatabase'
    databaseFile: DatabaseFile
  }
  | {
    type: 'selectTable'
    table: DatabaseTable | null
  }
  | {
    type: 'refreshSelectionGraph'
    allowMissingSelectedDevice?: boolean
    matchedApplication?: ApplicationSelection | null
    matchedDatabaseFile?: DatabaseFile | null
    matchedDevice?: DeviceInfo | null
    preserveDatabaseFile?: boolean
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

interface SelectionSessionTransition {
  effects: SelectionSessionEffects
  refreshResult?: RefreshSelectionGraphResult
  state: SelectionSessionState
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

function createSelectionSessionState(
  overrides: Partial<SelectionSessionState> = {},
): SelectionSessionState {
  return {
    selectedApplication: null,
    selectedDatabaseFile: null,
    selectedDatabaseTable: null,
    selectedDevice: null,
    selectedRow: null,
    ...overrides,
  }
}

function createClearTableContextEffects(): SelectionSessionEffects {
  return {
    clearTableContext: true,
  }
}

function createNoEffects(): SelectionSessionEffects {
  return {
    clearTableContext: false,
  }
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

function applySelectionSessionTransition(
  transition: SelectionSessionTransition,
  actions: SelectionSessionActions,
  previousState?: SelectionSessionState,
) {
  if (!previousState || transition.state.selectedDevice !== previousState.selectedDevice) {
    actions.setSelectedDevice(transition.state.selectedDevice)
  }
  if (!previousState || transition.state.selectedApplication !== previousState.selectedApplication) {
    actions.setSelectedApplication(transition.state.selectedApplication)
  }
  if (!previousState || transition.state.selectedDatabaseFile !== previousState.selectedDatabaseFile) {
    actions.setSelectedDatabaseFile(transition.state.selectedDatabaseFile)
  }

  if (transition.effects.clearTableContext) {
    clearTableContext(actions)
  }
  else {
    if (!previousState || transition.state.selectedDatabaseTable !== previousState.selectedDatabaseTable) {
      actions.setSelectedDatabaseTable(transition.state.selectedDatabaseTable)
    }
    if (!previousState || transition.state.selectedRow !== previousState.selectedRow) {
      actions.setSelectedRow(transition.state.selectedRow)
    }
  }

  if (transition.effects.tableData && actions.setTableData) {
    actions.setTableData(transition.effects.tableData)
  }
}

export function reduceSelectionSession(
  state: SelectionSessionState,
  event: SelectionSessionEvent,
): SelectionSessionTransition {
  switch (event.type) {
    case 'selectDevice':
      return {
        state: createSelectionSessionState({
          selectedDevice: event.device,
        }),
        effects: createClearTableContextEffects(),
      }

    case 'selectApplication':
      return {
        state: createSelectionSessionState({
          selectedApplication: event.application,
          selectedDevice: state.selectedDevice,
        }),
        effects: createClearTableContextEffects(),
      }

    case 'selectDatabase':
      return {
        state: createSelectionSessionState({
          selectedApplication: state.selectedApplication,
          selectedDatabaseFile: event.databaseFile,
          selectedDevice: state.selectedDevice,
        }),
        effects: createClearTableContextEffects(),
      }

    case 'selectDesktopDatabase':
      return {
        state: createSelectionSessionState({
          selectedDatabaseFile: event.databaseFile,
        }),
        effects: createClearTableContextEffects(),
      }

    case 'selectTable':
      return {
        state: createSelectionSessionState({
          selectedApplication: state.selectedApplication,
          selectedDatabaseFile: state.selectedDatabaseFile,
          selectedDatabaseTable: event.table,
          selectedDevice: state.selectedDevice,
        }),
        effects: event.table
          ? {
              clearTableContext: false,
              tableData: {
                rows: [],
                columns: [],
                isCustomQuery: false,
                tableName: event.table.name,
              },
            }
          : createNoEffects(),
      }

    case 'refreshSelectionGraph': {
      const refreshResult: RefreshSelectionGraphResult = {
        didClearSelectedApplication: false,
        didClearSelectedDatabaseFile: false,
        didClearSelectedDevice: false,
        preservedMissingSelectedDevice: false,
      }

      if (typeof event.matchedDevice !== 'undefined') {
        if (state.selectedDevice && !event.matchedDevice && event.allowMissingSelectedDevice) {
          refreshResult.preservedMissingSelectedDevice = true
          return {
            state,
            effects: createNoEffects(),
            refreshResult,
          }
        }

        if (state.selectedDevice && !event.matchedDevice) {
          refreshResult.didClearSelectedDevice = true
          refreshResult.didClearSelectedApplication = true
          refreshResult.didClearSelectedDatabaseFile = !event.preserveDatabaseFile

          return {
            state: createSelectionSessionState({
              selectedDatabaseFile: event.preserveDatabaseFile ? state.selectedDatabaseFile : null,
            }),
            effects: createClearTableContextEffects(),
            refreshResult,
          }
        }

        if (event.matchedDevice && event.matchedDevice !== state.selectedDevice) {
          state = {
            ...state,
            selectedDevice: event.matchedDevice,
          }
        }
      }

      if (typeof event.matchedApplication !== 'undefined') {
        if (state.selectedApplication && !event.matchedApplication) {
          refreshResult.didClearSelectedApplication = true
          refreshResult.didClearSelectedDatabaseFile = true

          return {
            state: createSelectionSessionState({
              selectedDevice: state.selectedDevice,
            }),
            effects: createClearTableContextEffects(),
            refreshResult,
          }
        }

        if (event.matchedApplication && event.matchedApplication !== state.selectedApplication) {
          state = {
            ...state,
            selectedApplication: event.matchedApplication,
          }
        }
      }

      if (typeof event.matchedDatabaseFile !== 'undefined') {
        if (state.selectedDatabaseFile && !event.matchedDatabaseFile) {
          refreshResult.didClearSelectedDatabaseFile = true

          return {
            state: createSelectionSessionState({
              selectedApplication: state.selectedApplication,
              selectedDevice: state.selectedDevice,
            }),
            effects: createClearTableContextEffects(),
            refreshResult,
          }
        }

        if (event.matchedDatabaseFile && event.matchedDatabaseFile !== state.selectedDatabaseFile) {
          state = {
            ...state,
            selectedDatabaseFile: event.matchedDatabaseFile,
          }
        }
      }

      return {
        state,
        effects: createNoEffects(),
        refreshResult,
      }
    }
  }
}

export function selectDevice({ actions, device }: SelectDeviceInput) {
  applySelectionSessionTransition(
    reduceSelectionSession(
      createSelectionSessionState(),
      {
        type: 'selectDevice',
        device,
      },
    ),
    actions,
  )
}

export function selectApplication({
  actions,
  addRecentApp,
  application,
  currentDevice,
}: SelectApplicationInput) {
  applySelectionSessionTransition(
    reduceSelectionSession(
      createSelectionSessionState({
        selectedDevice: currentDevice,
      }),
      {
        type: 'selectApplication',
        application,
      },
    ),
    actions,
  )

  if (application && currentDevice && addRecentApp) {
    addRecentApp(application, currentDevice.id, currentDevice.name || currentDevice.id)
  }
}

export function selectDatabase({ actions, databaseFile }: SelectDatabaseInput) {
  applySelectionSessionTransition(
    reduceSelectionSession(
      createSelectionSessionState(),
      {
        type: 'selectDatabase',
        databaseFile,
      },
    ),
    actions,
  )
}

export function selectDesktopDatabase({ actions, databaseFile }: SelectDesktopDatabaseInput) {
  applySelectionSessionTransition(
    reduceSelectionSession(
      createSelectionSessionState(),
      {
        type: 'selectDesktopDatabase',
        databaseFile,
      },
    ),
    actions,
  )
}

export function selectTable({ actions, table }: SelectTableInput) {
  applySelectionSessionTransition(
    reduceSelectionSession(
      createSelectionSessionState(),
      {
        type: 'selectTable',
        table,
      },
    ),
    actions,
  )
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
  const previousState = createSelectionSessionState({
    selectedApplication,
    selectedDatabaseFile,
    selectedDevice,
  })
  const transition = reduceSelectionSession(
    previousState,
    {
      type: 'refreshSelectionGraph',
      allowMissingSelectedDevice,
      matchedApplication,
      matchedDatabaseFile,
      matchedDevice,
      preserveDatabaseFile,
    },
  )

  applySelectionSessionTransition(transition, actions, previousState)

  return transition.refreshResult ?? {
    didClearSelectedApplication: false,
    didClearSelectedDatabaseFile: false,
    didClearSelectedDevice: false,
    preservedMissingSelectedDevice: false,
  }
}
