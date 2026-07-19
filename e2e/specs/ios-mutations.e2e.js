/* global describe, it */

const { browser } = require('@wdio/globals')
const {
  clickActionButton,
  clickButtonByText,
  getGridText,
  openIOSHappyPathToGrid,
  openRowDetails,
  prepareScenario,
  waitForCommand,
  waitForE2EMode,
  waitForGridText,
} = require('../helpers/flows.cjs')
const {
  createIOSClearTableScenario,
  createIOSDeleteRowScenario,
} = require('../helpers/scenarios.cjs')

describe('Flippio E2E iPhone mutations', () => {
  async function prepareFreshScenario(scenario) {
    await prepareScenario(scenario)
    await browser.refresh()
    await waitForE2EMode('E2E mode did not reinitialize after refresh')
  }

  it('deletes a row and refreshes the grid on iphone-device', async () => {
    await waitForE2EMode('E2E mode did not initialize')
    await prepareFreshScenario(createIOSDeleteRowScenario())

    await openIOSHappyPathToGrid()
    await waitForGridText('Alice', 'Initial iPhone rows did not render')
    await openRowDetails('Alice')
    await clickActionButton({
      testIds: ['remove-row-button'],
      texts: ['Remove Row'],
      timeoutMsg: 'Remove-row action was not available',
    })
    await clickButtonByText('Delete')

    await waitForCommand('db_delete_table_row', 1, 'iPhone delete-row command did not execute')
    await waitForCommand('device_push_ios_database_file', 1, 'Deleted iPhone database was not pushed back to device')

    await browser.waitUntil(async () => {
      const gridText = await getGridText()
      return !gridText.includes('Alice') && gridText.includes('Bob')
    }, {
      timeout: 15000,
      timeoutMsg: 'Deleted row still appears in the iPhone grid',
    })
  })

  it('clears a table and refreshes the grid on iphone-device', async () => {
    await waitForE2EMode('E2E mode did not initialize')
    await prepareFreshScenario(createIOSClearTableScenario())

    await openIOSHappyPathToGrid()
    await waitForGridText('Alice', 'Initial iPhone rows did not render')
    await openRowDetails('Alice')
    await clickActionButton({
      testIds: ['clear-table-button'],
      texts: ['Clear Whole Table'],
      timeoutMsg: 'Clear-table action was not available',
    })
    await clickButtonByText('Clear Table')

    await waitForCommand('db_clear_table', 1, 'iPhone clear-table command did not execute')
    await waitForCommand('device_push_ios_database_file', 1, 'Cleared iPhone database was not pushed back to device')

    await browser.waitUntil(async () => {
      const gridText = await getGridText()
      return !gridText.includes('Alice') && !gridText.includes('Bob')
    }, {
      timeout: 15000,
      timeoutMsg: 'Cleared rows still appear in the iPhone grid',
    })
  })
})
