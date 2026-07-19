/* global describe, it */

const { $, expect } = require('@wdio/globals')
const {
  clickActionButton,
  getCommandHistory,
  openIOSHappyPathToGrid,
  prepareScenario,
  waitForCommand,
  waitForE2EMode,
  waitForGridText,
} = require('../helpers/flows.cjs')
const { createIOSBulkAddScenario } = require('../helpers/scenarios.cjs')

describe('Flippio E2E iPhone bulk add', () => {
  it('adds 10 rows to a loaded 100-row iphone table and refreshes cleanly', async () => {
    await waitForE2EMode('E2E mode did not initialize')
    await prepareScenario(createIOSBulkAddScenario())

    await openIOSHappyPathToGrid()
    await waitForGridText('user1@flippio.dev', 'Initial dense table did not render')

    for (let index = 1; index <= 10; index += 1) {
      await clickActionButton({
        testIds: ['add-row-button'],
        selectors: ['button[aria-label="Add new row"]'],
        timeoutMsg: 'Add-row action was not available',
      })
      await waitForCommand('db_add_new_row_with_defaults', index, `Add-row command ${index} did not execute`)
      await waitForCommand('device_push_ios_database_file', index, `iPhone sync command ${index} did not execute`)
    }

    await waitForCommand('db_get_table_data', 11, 'Table data did not refresh after each add')
    await waitForGridText('user1@flippio.dev', 'Grid did not recover after bulk add')

    const history = await getCommandHistory()
    const addCalls = history.filter(entry => entry.command === 'db_add_new_row_with_defaults')
    const pushCalls = history.filter(entry => entry.command === 'device_push_ios_database_file')
    await expect(addCalls).toHaveLength(10)
    await expect(pushCalls).toHaveLength(10)

    const bodyText = await $('body').getText()
    await expect(bodyText).toContain('1 to 20 of 110')
  })
})
