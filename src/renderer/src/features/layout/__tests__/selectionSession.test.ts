import { describe, expect, it, vi } from 'vitest'
import {
  clearTableContext,
  matchSelectedApplication,
  matchSelectedDatabaseFile,
  matchSelectedDevice,
  reconcileSelectionAfterApplicationRefresh,
  reconcileSelectionAfterDeviceRefresh,
  reconcileSelectionWithApplications,
  reconcileSelectionWithDatabaseFiles,
  reconcileSelectionWithDevices,
  reduceSelectionSession,
  refreshSelectionGraph,
  selectApplication,
  selectDatabase,
  selectDesktopDatabase,
  selectDevice,
  selectTable,
} from '../selectionSession'

function createActions() {
  return {
    clearTableData: vi.fn(),
    setSelectedApplication: vi.fn(),
    setSelectedDatabaseFile: vi.fn(),
    setSelectedDatabaseTable: vi.fn(),
    setSelectedDevice: vi.fn(),
    setSelectedRow: vi.fn(),
    setTableData: vi.fn(),
  }
}

describe('selectionSession', () => {
  it('clears table context', () => {
    const actions = createActions()

    clearTableContext(actions)

    expect(actions.setSelectedDatabaseTable).toHaveBeenCalledWith(null)
    expect(actions.clearTableData).toHaveBeenCalledTimes(1)
    expect(actions.setSelectedRow).toHaveBeenCalledWith(null)
  })

  it('matches a selected device by id', () => {
    const matchedDevice = matchSelectedDevice(
      [
        { id: 'device-1', name: 'Phone', model: 'Pixel', deviceType: 'android' },
        { id: 'device-2', name: 'Tablet', model: 'Pixel Tablet', deviceType: 'android' },
      ],
      { id: 'device-2', name: 'Old Tablet', model: 'Old', deviceType: 'android' },
    )

    expect(matchedDevice).toMatchObject({ id: 'device-2', name: 'Tablet' })
  })

  it('matches a selected application by bundle id', () => {
    const matchedApplication = matchSelectedApplication(
      [
        { bundleId: 'com.test.a', name: 'App A' },
        { bundleId: 'com.test.b', name: 'App B' },
      ],
      { bundleId: 'com.test.b', name: 'Old App B' },
    )

    expect(matchedApplication).toMatchObject({ bundleId: 'com.test.b', name: 'App B' })
  })

  it('matches a selected database file by remote path before fallback fields', () => {
    const matchedDatabaseFile = matchSelectedDatabaseFile(
      [
        {
          filename: 'local-copy.db',
          location: '/tmp',
          packageName: 'com.test.app',
          path: '/tmp/local-copy.db',
          remotePath: '/remote/live.db',
          deviceType: 'iphone-device',
        },
      ],
      {
        filename: 'stale-name.db',
        location: '/tmp',
        packageName: 'com.test.app',
        path: '/tmp/stale-name.db',
        remotePath: '/remote/live.db',
        deviceType: 'iphone-device',
      },
    )

    expect(matchedDatabaseFile).toMatchObject({
      filename: 'local-copy.db',
      remotePath: '/remote/live.db',
    })
  })

  it('reduces device selection into a cleared downstream session state', () => {
    const device = { id: 'device-1', name: 'Phone', model: 'Pixel', deviceType: 'android' as const }

    const transition = reduceSelectionSession(
      {
        selectedDevice: null,
        selectedApplication: { bundleId: 'com.test.app', name: 'Test App' },
        selectedDatabaseFile: {
          filename: 'test.db',
          location: '/tmp/test.db',
          packageName: 'com.test.app',
          path: '/tmp/test.db',
        },
        selectedDatabaseTable: { name: 'users' },
        selectedRow: { id: 1 },
      },
      {
        type: 'selectDevice',
        device,
      },
    )

    expect(transition.state).toMatchObject({
      selectedDevice: device,
      selectedApplication: null,
      selectedDatabaseFile: null,
      selectedDatabaseTable: null,
      selectedRow: null,
    })
    expect(transition.effects.clearTableContext).toBe(true)
  })

  it('reduces table selection into a table-focused session state and reset table data payload', () => {
    const table = { name: 'users' }

    const transition = reduceSelectionSession(
      {
        selectedDevice: { id: 'device-1', name: 'Phone', model: 'Pixel', deviceType: 'android' },
        selectedApplication: { bundleId: 'com.test.app', name: 'Test App' },
        selectedDatabaseFile: {
          filename: 'test.db',
          location: '/tmp/test.db',
          packageName: 'com.test.app',
          path: '/tmp/test.db',
        },
        selectedDatabaseTable: null,
        selectedRow: { id: 1 },
      },
      {
        type: 'selectTable',
        table,
      },
    )

    expect(transition.state).toMatchObject({
      selectedDatabaseTable: table,
      selectedRow: null,
    })
    expect(transition.effects).toMatchObject({
      clearTableContext: false,
      tableData: {
        rows: [],
        columns: [],
        isCustomQuery: false,
        tableName: 'users',
      },
    })
  })

  it('reduces refresh reconciliation and preserves a desktop database when a device disappears', () => {
    const desktopDatabaseFile = {
      filename: 'local.db',
      location: '/tmp/local.db',
      packageName: '',
      path: '/tmp/local.db',
      remotePath: '/tmp/local.db',
      deviceType: 'desktop' as const,
    }

    const transition = reduceSelectionSession(
      {
        selectedDevice: { id: 'device-1', name: 'Phone', model: 'Pixel', deviceType: 'android' },
        selectedApplication: { bundleId: 'com.test.app', name: 'Test App' },
        selectedDatabaseFile: desktopDatabaseFile,
        selectedDatabaseTable: { name: 'users' },
        selectedRow: { id: 1 },
      },
      {
        type: 'refreshSelectionGraph',
        matchedDevice: null,
        preserveDatabaseFile: true,
      },
    )

    expect(transition.state).toMatchObject({
      selectedDevice: null,
      selectedApplication: null,
      selectedDatabaseFile: desktopDatabaseFile,
      selectedDatabaseTable: null,
      selectedRow: null,
    })
    expect(transition.effects.clearTableContext).toBe(true)
    expect(transition.refreshResult).toMatchObject({
      didClearSelectedDevice: true,
      didClearSelectedApplication: true,
      didClearSelectedDatabaseFile: false,
    })
  })

  it('selectDevice resets all downstream selection state', () => {
    const actions = createActions()
    const device = { id: 'device-1', name: 'Phone', model: 'Pixel', deviceType: 'android' as const }

    selectDevice({ actions, device })

    expect(actions.setSelectedDevice).toHaveBeenCalledWith(device)
    expect(actions.setSelectedApplication).toHaveBeenCalledWith(null)
    expect(actions.setSelectedDatabaseFile).toHaveBeenCalledWith(null)
    expect(actions.setSelectedDatabaseTable).toHaveBeenCalledWith(null)
    expect(actions.clearTableData).toHaveBeenCalledTimes(1)
    expect(actions.setSelectedRow).toHaveBeenCalledWith(null)
  })

  it('selectApplication clears downstream state and records a recent app', () => {
    const actions = createActions()
    const addRecentApp = vi.fn()
    const currentDevice = { id: 'device-1', name: 'Phone', model: 'Pixel', deviceType: 'android' as const }
    const application = { bundleId: 'com.test.app', name: 'Test App' }

    selectApplication({ actions, addRecentApp, application, currentDevice })

    expect(actions.setSelectedDatabaseFile).toHaveBeenCalledWith(null)
    expect(actions.setSelectedApplication).toHaveBeenCalledWith(application)
    expect(actions.setSelectedDatabaseTable).toHaveBeenCalledWith(null)
    expect(actions.clearTableData).toHaveBeenCalledTimes(1)
    expect(actions.setSelectedRow).toHaveBeenCalledWith(null)
    expect(addRecentApp).toHaveBeenCalledWith(application, 'device-1', 'Phone')
  })

  it('selectDatabase clears table context for the new database file', () => {
    const actions = createActions()
    const databaseFile = {
      filename: 'test.db',
      location: '/tmp/test.db',
      packageName: 'com.test.app',
      path: '/tmp/test.db',
    }

    selectDatabase({ actions, databaseFile })

    expect(actions.setSelectedDatabaseFile).toHaveBeenCalledWith(databaseFile)
    expect(actions.setSelectedDatabaseTable).toHaveBeenCalledWith(null)
    expect(actions.clearTableData).toHaveBeenCalledTimes(1)
    expect(actions.setSelectedRow).toHaveBeenCalledWith(null)
  })

  it('selectDesktopDatabase enters desktop mode and clears downstream state', () => {
    const actions = createActions()
    const databaseFile = {
      filename: 'local.db',
      location: '/tmp/local.db',
      packageName: '',
      path: '/tmp/local.db',
      remotePath: '/tmp/local.db',
      deviceType: 'desktop' as const,
    }

    selectDesktopDatabase({ actions, databaseFile })

    expect(actions.setSelectedDevice).toHaveBeenCalledWith(null)
    expect(actions.setSelectedApplication).toHaveBeenCalledWith(null)
    expect(actions.setSelectedDatabaseFile).toHaveBeenCalledWith(databaseFile)
    expect(actions.setSelectedDatabaseTable).toHaveBeenCalledWith(null)
    expect(actions.clearTableData).toHaveBeenCalledTimes(1)
    expect(actions.setSelectedRow).toHaveBeenCalledWith(null)
  })

  it('selectTable swaps the visible table context before storing the table', () => {
    const actions = createActions()
    const table = { name: 'users' }

    selectTable({ actions, table })

    expect(actions.setTableData).toHaveBeenCalledWith({
      rows: [],
      columns: [],
      isCustomQuery: false,
      tableName: 'users',
    })
    expect(actions.setSelectedRow).toHaveBeenCalledWith(null)
    expect(actions.setSelectedDatabaseTable).toHaveBeenCalledWith(table)
  })

  it('refreshSelectionGraph preserves matching refreshed objects', () => {
    const actions = createActions()
    const selectedDevice = { id: 'device-1', name: 'Old', label: 'Old', model: 'Pixel', deviceType: 'android' as const }
    const matchedDevice = { ...selectedDevice, label: 'New Label' }
    const selectedApplication = { bundleId: 'com.test.app', name: 'Old App' }
    const matchedApplication = { ...selectedApplication, name: 'New App' }
    const selectedDatabaseFile = {
      filename: 'test.db',
      location: '/tmp/test.db',
      packageName: 'com.test.app',
      path: '/tmp/test.db',
      deviceType: 'android' as const,
    }
    const matchedDatabaseFile = { ...selectedDatabaseFile, filename: 'renamed.db' }

    refreshSelectionGraph(
      {
        selectedDevice,
        selectedApplication,
        selectedDatabaseFile,
        matchedDevice,
        matchedApplication,
        matchedDatabaseFile,
      },
      actions,
    )

    expect(actions.setSelectedDevice).toHaveBeenCalledWith(matchedDevice)
    expect(actions.setSelectedApplication).toHaveBeenCalledWith(matchedApplication)
    expect(actions.setSelectedDatabaseFile).toHaveBeenCalledWith(matchedDatabaseFile)
    expect(actions.clearTableData).not.toHaveBeenCalled()
  })

  it('refreshSelectionGraph resets from an invalid application downward', () => {
    const actions = createActions()
    const selectedApplication = { bundleId: 'com.test.app', name: 'Test App' }
    const selectedDatabaseFile = {
      filename: 'test.db',
      location: '/tmp/test.db',
      packageName: 'com.test.app',
      path: '/tmp/test.db',
      deviceType: 'android' as const,
    }

    const result = refreshSelectionGraph(
      {
        selectedApplication,
        selectedDatabaseFile,
        matchedApplication: null,
      },
      actions,
    )

    expect(result).toMatchObject({
      didClearSelectedApplication: true,
      didClearSelectedDatabaseFile: true,
      didClearSelectedDevice: false,
      preservedMissingSelectedDevice: false,
    })
    expect(actions.setSelectedApplication).toHaveBeenCalledWith(null)
    expect(actions.setSelectedDatabaseFile).toHaveBeenCalledWith(null)
    expect(actions.setSelectedDatabaseTable).toHaveBeenCalledWith(null)
    expect(actions.clearTableData).toHaveBeenCalledTimes(1)
    expect(actions.setSelectedRow).toHaveBeenCalledWith(null)
  })

  it('refreshSelectionGraph can preserve a selected device during passive list flicker', () => {
    const actions = createActions()
    const selectedDevice = {
      id: 'iphone-device-1',
      name: 'My iPhone',
      model: 'iPhone',
      deviceType: 'iphone-device' as const,
    }

    const result = refreshSelectionGraph(
      {
        selectedDevice,
        matchedDevice: null,
        allowMissingSelectedDevice: true,
      },
      actions,
    )

    expect(result).toMatchObject({
      didClearSelectedApplication: false,
      didClearSelectedDatabaseFile: false,
      didClearSelectedDevice: false,
      preservedMissingSelectedDevice: true,
    })
    expect(actions.setSelectedDevice).not.toHaveBeenCalled()
    expect(actions.setSelectedApplication).not.toHaveBeenCalled()
    expect(actions.setSelectedDatabaseFile).not.toHaveBeenCalled()
    expect(actions.clearTableData).not.toHaveBeenCalled()
    expect(actions.setSelectedRow).not.toHaveBeenCalled()
  })

  it('reconcileSelectionWithDevices applies shared device-list reconciliation policy', () => {
    const actions = createActions()
    const selectedDevice = {
      id: 'iphone-device-1',
      name: 'My iPhone',
      model: 'iPhone',
      deviceType: 'iphone-device' as const,
    }

    const result = reconcileSelectionWithDevices(
      {
        allowMissingSelectedDevice: true,
        devices: [],
        selectedDevice,
      },
      actions,
    )

    expect(result).toMatchObject({
      didClearSelectedApplication: false,
      didClearSelectedDatabaseFile: false,
      didClearSelectedDevice: false,
      preservedMissingSelectedDevice: true,
    })
    expect(actions.setSelectedDevice).not.toHaveBeenCalled()
    expect(actions.clearTableData).not.toHaveBeenCalled()
  })

  it('reconcileSelectionWithApplications clears invalid app state through the shared helper', () => {
    const actions = createActions()
    const selectedDevice = { id: 'device-1', name: 'Phone', model: 'Pixel', deviceType: 'android' as const }
    const selectedApplication = { bundleId: 'com.test.app', name: 'Test App' }
    const selectedDatabaseFile = {
      filename: 'test.db',
      location: '/tmp/test.db',
      packageName: 'com.test.app',
      path: '/tmp/test.db',
      deviceType: 'android' as const,
    }

    const result = reconcileSelectionWithApplications(
      {
        applications: [{ bundleId: 'com.other.app', name: 'Other App' }],
        selectedApplication,
        selectedDatabaseFile,
        selectedDevice,
      },
      actions,
    )

    expect(result).toMatchObject({
      didClearSelectedApplication: true,
      didClearSelectedDatabaseFile: true,
      didClearSelectedDevice: false,
      preservedMissingSelectedDevice: false,
    })
    expect(actions.setSelectedApplication).toHaveBeenCalledWith(null)
    expect(actions.setSelectedDatabaseFile).toHaveBeenCalledWith(null)
    expect(actions.clearTableData).toHaveBeenCalledTimes(1)
  })

  it('reconcileSelectionAfterDeviceRefresh reports whether app refresh should continue', () => {
    const actions = createActions()
    const selectedDevice = { id: 'device-1', name: 'Phone', model: 'Pixel', deviceType: 'android' as const }
    const selectedApplication = { bundleId: 'com.test.app', name: 'Test App' }

    const result = reconcileSelectionAfterDeviceRefresh(
      {
        devices: [selectedDevice],
        selectedDevice,
        selectedApplication,
      },
      actions,
    )

    expect(result).toMatchObject({
      matchedDevice: selectedDevice,
      shouldRefreshApplications: true,
    })
    expect(result.refreshResult).toMatchObject({
      didClearSelectedDevice: false,
      didClearSelectedApplication: false,
    })
  })

  it('reconcileSelectionAfterApplicationRefresh reports whether db refresh should continue', () => {
    const actions = createActions()
    const selectedDevice = { id: 'device-1', name: 'Phone', model: 'Pixel', deviceType: 'android' as const }
    const selectedApplication = { bundleId: 'com.test.app', name: 'Test App' }
    const selectedDatabaseFile = {
      filename: 'test.db',
      location: '/tmp/test.db',
      packageName: 'com.test.app',
      path: '/tmp/test.db',
      deviceType: 'android' as const,
    }

    const result = reconcileSelectionAfterApplicationRefresh(
      {
        applications: [selectedApplication],
        selectedDevice,
        selectedApplication,
        selectedDatabaseFile,
      },
      actions,
    )

    expect(result).toMatchObject({
      matchedApplication: selectedApplication,
      shouldRefreshDatabaseFiles: true,
    })
    expect(result.refreshResult).toMatchObject({
      didClearSelectedApplication: false,
      didClearSelectedDatabaseFile: false,
    })
  })

  it('reconcileSelectionWithDatabaseFiles clears invalid db state through the shared helper', () => {
    const actions = createActions()
    const selectedDevice = { id: 'device-1', name: 'Phone', model: 'Pixel', deviceType: 'android' as const }
    const selectedApplication = { bundleId: 'com.test.app', name: 'Test App' }
    const selectedDatabaseFile = {
      filename: 'missing.db',
      location: '/tmp/missing.db',
      packageName: 'com.test.app',
      path: '/tmp/missing.db',
      deviceType: 'android' as const,
    }

    const result = reconcileSelectionWithDatabaseFiles(
      {
        databaseFiles: [{
          filename: 'test.db',
          location: '/tmp/test.db',
          packageName: 'com.test.app',
          path: '/tmp/test.db',
          deviceType: 'android' as const,
        }],
        selectedDevice,
        selectedApplication,
        selectedDatabaseFile,
      },
      actions,
    )

    expect(result.matchedDatabaseFile).toBeNull()
    expect(result.refreshResult).toMatchObject({
      didClearSelectedDatabaseFile: true,
    })
    expect(actions.setSelectedDatabaseFile).toHaveBeenCalledWith(null)
    expect(actions.clearTableData).toHaveBeenCalledTimes(1)
  })
})
