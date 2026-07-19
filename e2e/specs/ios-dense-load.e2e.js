/* global describe, it */

const { $, expect } = require('@wdio/globals')
const {
  openIOSHappyPathToGrid,
  prepareScenario,
  waitForCommand,
  waitForE2EMode,
  waitForGridText,
} = require('../helpers/flows.cjs')
const { createIOSDenseHappyPathScenario } = require('../helpers/scenarios.cjs')

describe('Flippio E2E iPhone dense load', () => {
  it('loads iphone-device app -> database -> table on a 100-row table', async () => {
    await waitForE2EMode('E2E mode did not initialize')
    await prepareScenario(createIOSDenseHappyPathScenario())

    await openIOSHappyPathToGrid()

    await waitForCommand('device_get_ios_device_packages', 1, 'iPhone app fetch did not complete')
    await waitForCommand('get_ios_device_database_files', 1, 'iPhone database-file fetch did not complete')
    await waitForCommand('db_get_tables', 1, 'Table fetch did not complete')
    await waitForCommand('db_get_table_data', 1, 'Table data fetch did not complete')

    await waitForGridText('user1@flippio.dev', 'First dense row did not render')
    await waitForGridText('user1@flippio.dev', 'Dense grid row did not render')

    const bodyText = await $('body').getText()
    await expect(bodyText).toContain('1 to 20 of 100')
    await expect(bodyText).not.toContain('Error loading data')
    await expect(bodyText).not.toContain('Select table')
  })
})
