/* global describe, it */

const { $, browser, expect } = require('@wdio/globals')
const {
  clickActionButton,
  getGridText,
  openHappyPathToGrid,
  openRowDetails,
  prepareScenario,
  selectFirstOption,
  waitForCommand,
  waitForE2EMode,
  waitForGridText,
} = require('../helpers/flows.cjs')
const {
  createAndroidDatabaseFilesFailureScenario,
  createAndroidPackagesFailureScenario,
  createAndroidRowUpdateFailureScenario,
  createAndroidTableDataFailureScenario,
  createAndroidTablesFailureScenario,
} = require('../helpers/scenarios.cjs')

async function bootScenario(scenario) {
  await waitForE2EMode('E2E mode did not initialize')
  await prepareScenario(scenario)
}

describe('Flippio E2E unhappy paths', () => {
  it('keeps downstream selection locked when app fetch fails', async () => {
    await bootScenario(createAndroidPackagesFailureScenario())

    await waitForCommand('adb_get_devices', 1, 'Initial device fetch did not complete')
    await selectFirstOption('device-select')
    await waitForCommand('adb_get_packages', 1, 'Package fetch did not execute')

    await expect($('[data-testid="database-file-select"]')).toHaveAttribute('data-e2e-disabled', 'true')

    const commands = (await browser.execute(() => window.__FLIPPIO_E2E__?.getCommandHistory() ?? []))
      .map(entry => entry.command)
    await expect(commands).not.toContain('adb_get_android_database_files')
  })

  it('shows empty database state when database file fetch fails', async () => {
    await bootScenario(createAndroidDatabaseFilesFailureScenario())

    await waitForCommand('adb_get_devices', 1, 'Initial device fetch did not complete')
    await selectFirstOption('device-select')
    await waitForCommand('adb_get_packages', 1, 'Package fetch did not execute')
    await selectFirstOption('app-select')
    await waitForCommand('adb_get_android_database_files', 1, 'Database file fetch did not execute')
    await waitForGridText('No database files available', 'Missing empty database-files state')
  })

  it('stops before table data load when table fetch fails', async () => {
    await bootScenario(createAndroidTablesFailureScenario())

    await waitForCommand('adb_get_devices', 1, 'Initial device fetch did not complete')
    await selectFirstOption('device-select')
    await waitForCommand('adb_get_packages', 1, 'Package fetch did not execute')
    await selectFirstOption('app-select')
    await waitForCommand('adb_get_android_database_files', 1, 'Database file fetch did not execute')
    await selectFirstOption('database-file-select')
    await waitForCommand('db_get_tables', 1, 'Table fetch did not execute')
    await waitForGridText('Select table', 'Expected table selection prompt did not appear')

    const commands = (await browser.execute(() => window.__FLIPPIO_E2E__?.getCommandHistory() ?? []))
      .map(entry => entry.command)
    await expect(commands).not.toContain('db_get_table_data')
  })

  it('shows grid error state when table data fetch fails', async () => {
    await bootScenario(createAndroidTableDataFailureScenario())

    await waitForCommand('adb_get_devices', 1, 'Initial device fetch did not complete')
    await selectFirstOption('device-select')
    await waitForCommand('adb_get_packages', 1, 'Package fetch did not execute')
    await selectFirstOption('app-select')
    await waitForCommand('adb_get_android_database_files', 1, 'Database file fetch did not execute')
    await selectFirstOption('database-file-select')
    await waitForCommand('db_get_tables', 1, 'Table fetch did not execute')
    await selectFirstOption('table-select')
    await waitForCommand('db_get_table_data', 1, 'Table data fetch did not execute')
    await waitForGridText('Error loading data', 'Grid error state did not appear')
  })

  it('keeps original row visible when row update fails', async () => {
    await bootScenario(createAndroidRowUpdateFailureScenario())
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

    const commands = (await browser.execute(() => window.__FLIPPIO_E2E__?.getCommandHistory() ?? []))
      .map(entry => entry.command)
    await expect(commands).not.toContain('adb_push_database_file')

    await browser.waitUntil(async () => {
      const gridText = await getGridText()
      return gridText.includes('Alice') && !gridText.includes('Alicia')
    }, {
      timeout: 15000,
      timeoutMsg: 'Original row was not preserved after update failure',
    })
  })
})
