/* global describe, it */

const { $, browser } = require('@wdio/globals')
const {
  clickActionButton,
  clickButtonByText,
  getGridText,
  openHappyPathToGrid,
  openRowDetails,
  prepareScenario,
  waitForCommand,
  waitForE2EMode,
  waitForGridText,
} = require('../helpers/flows.cjs')
const {
  createAndroidAddRowScenario,
  createAndroidClearTableScenario,
  createAndroidDeleteRowScenario,
  createAndroidRowUpdateScenario,
} = require('../helpers/scenarios.cjs')

async function bootScenario(scenario) {
  await waitForE2EMode('E2E mode did not initialize')
  await prepareScenario(scenario)
  await openHappyPathToGrid()
}

describe('Flippio E2E mutations', () => {
  it('updates a row and refreshes the grid', async () => {
    await bootScenario(createAndroidRowUpdateScenario())

    await waitForGridText('Alice', 'Initial grid rows did not render')
    await openRowDetails('Alice')
    await clickActionButton({
      testIds: ['edit-row-button'],
      texts: ['Edit'],
      timeoutMsg: 'Edit action was not available',
    })

    const nameInput = $('input[value="Alice"]')
    await nameInput.waitForDisplayed({ timeout: 15000 })
    await nameInput.clearValue()
    await nameInput.setValue('Alicia')

    await clickActionButton({
      testIds: ['save-row-button'],
      texts: ['Save'],
      timeoutMsg: 'Save action was not available',
    })

    await waitForCommand('db_update_table_row', 1, 'Row update did not execute')
    await waitForCommand('adb_push_database_file', 1, 'Updated database was not pushed back to device')
    await waitForGridText('Alicia', 'Updated row did not render in the grid')
  })

  it('adds a row and refreshes the grid', async () => {
    await bootScenario(createAndroidAddRowScenario())
    await waitForGridText('Alice', 'Initial grid rows did not render')

    await clickActionButton({
      testIds: ['add-row-button'],
      selectors: ['button[aria-label="Add new row"]'],
      timeoutMsg: 'Add-row action was not available',
    })

    await waitForCommand('db_add_new_row_with_defaults', 1, 'Add-row command did not execute')
    await waitForCommand('adb_push_database_file', 1, 'Added row was not pushed back to device')
    await waitForGridText('charlie@flippio.dev', 'New row did not render in the grid')
  })

  it('deletes a row and refreshes the grid', async () => {
    await bootScenario(createAndroidDeleteRowScenario())

    await waitForGridText('Alice', 'Initial grid rows did not render')
    await openRowDetails('Alice')
    await clickActionButton({
      testIds: ['remove-row-button'],
      texts: ['Remove Row'],
      timeoutMsg: 'Remove-row action was not available',
    })
    await clickButtonByText('Delete')

    await waitForCommand('db_delete_table_row', 1, 'Delete-row command did not execute')
    await waitForCommand('adb_push_database_file', 1, 'Deleted row state was not pushed back to device')

    await browser.waitUntil(async () => {
      const gridText = await getGridText()
      return !gridText.includes('Alice') && gridText.includes('Bob')
    }, {
      timeout: 15000,
      timeoutMsg: 'Deleted row still appears in the grid',
    })
  })

  it('clears a table and refreshes the grid', async () => {
    await bootScenario(createAndroidClearTableScenario())

    await waitForGridText('Alice', 'Initial grid rows did not render')
    await openRowDetails('Alice')
    await clickActionButton({
      testIds: ['clear-table-button'],
      texts: ['Clear Whole Table'],
      timeoutMsg: 'Clear-table action was not available',
    })
    await clickButtonByText('Clear Table')

    await waitForCommand('db_clear_table', 1, 'Clear-table command did not execute')
    await waitForCommand('adb_push_database_file', 1, 'Cleared table state was not pushed back to device')

    await browser.waitUntil(async () => {
      const gridText = await getGridText()
      return !gridText.includes('Alice') && !gridText.includes('Bob')
    }, {
      timeout: 15000,
      timeoutMsg: 'Cleared rows still appear in the grid',
    })
  })
})
