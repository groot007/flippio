/* global describe, it */

const { expect } = require('@wdio/globals')
const {
  getCommandHistory,
  openHappyPathToGrid,
  prepareScenario,
  waitForGridText,
  waitForE2EMode,
} = require('../helpers/flows.cjs')
const { createAndroidGridHappyPathScenario } = require('../helpers/scenarios.cjs')

describe('Flippio E2E full path', () => {
  it('loads mocked device data from selection through the data grid', async () => {
    await waitForE2EMode('E2E mode did not initialize')

    await prepareScenario(createAndroidGridHappyPathScenario())

    await openHappyPathToGrid()
    await waitForGridText('alice@flippio.dev', 'Grid rows did not render')

    const commands = (await getCommandHistory()).map(entry => entry.command)
    await expect(commands).toEqual(expect.arrayContaining([
      'adb_get_devices',
      'device_get_ios_devices',
      'get_ios_simulators',
      'adb_get_packages',
      'adb_get_android_database_files',
      'db_open',
      'db_get_tables',
      'db_get_table_data',
    ]))
  })
})
