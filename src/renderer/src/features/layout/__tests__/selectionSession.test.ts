import { describe, expect, it, vi } from 'vitest'
import {
  clearTableContext,
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
})
