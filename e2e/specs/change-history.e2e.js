/* global describe, it */

const { browser, expect } = require('@wdio/globals')
const {
  clickActionButton,
  openHappyPathToGrid,
  openRowDetails,
  prepareScenario,
  waitForCommand,
  waitForE2EMode,
  waitForGridText,
} = require('../helpers/flows.cjs')
const { createAndroidChangeHistoryScenario } = require('../helpers/scenarios.cjs')

describe('Flippio E2E change history', () => {
  async function prepareFreshScenario(scenario) {
    await prepareScenario(scenario)
    await browser.refresh()
    await waitForE2EMode('E2E mode did not reinitialize after refresh')
  }

  it('shows refreshed change history after a row update', async () => {
    await waitForE2EMode('E2E mode did not initialize')
    await prepareFreshScenario(createAndroidChangeHistoryScenario())

    await openHappyPathToGrid()
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
    await waitForGridText('Alicia', 'Updated row did not render in the grid')

    await $('//button[starts-with(@aria-label, "Change history")]').click()
    await waitForCommand('get_database_change_history', 3, 'Change history did not refresh after mutation')
    await $('//*[contains(normalize-space(.), "Change History")]').waitForDisplayed({ timeout: 15000 })
    await expect($('body')).toHaveText(expect.stringContaining('Change History'))
    await expect($('body')).toHaveText(expect.stringContaining('Table: users'))
    await expect($('body')).toHaveText(expect.stringContaining('Update'))
  })
})
