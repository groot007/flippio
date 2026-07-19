/* global describe, it */

const { $, expect } = require('@wdio/globals')
const {
  openHappyPathToGrid,
  prepareScenario,
  waitForCommand,
  waitForE2EMode,
  waitForGridText,
} = require('../helpers/flows.cjs')
const { createAndroidRefreshPreserveScenario } = require('../helpers/scenarios.cjs')

describe('Flippio E2E refresh preservation', () => {
  it('preserves the current database and table selection when refresh returns the same data', async () => {
    await waitForE2EMode('E2E mode did not initialize')
    await prepareScenario(createAndroidRefreshPreserveScenario())

    await openHappyPathToGrid()
    await waitForGridText('alice@flippio.dev', 'Initial grid rows did not render')

    await $('[data-testid="refresh-db"]').click()
    await waitForCommand('adb_get_android_database_files', 2, 'Database file refresh did not complete')
    await waitForCommand('db_get_tables', 2, 'Table refresh did not complete')
    await waitForCommand('db_get_table_data', 2, 'Table data refresh did not complete')

    await expect($('[data-testid="database-file-select"]')).toHaveText(expect.stringContaining('sample.db'))
    await expect($('[data-testid="table-select"]')).toHaveText(expect.stringContaining('users'))
    await waitForGridText('alice@flippio.dev', 'Grid rows did not remain visible after refresh')
  })
})
