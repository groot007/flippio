/* global describe, it */

const { $, browser, expect } = require('@wdio/globals')
const {
  clickActionButton,
  clickButtonByText,
  selectNthOptionByKeyboard,
  prepareScenario,
  simulateDroppedFile,
  waitForCommand,
  waitForE2EMode,
  waitForGridText,
} = require('../helpers/flows.cjs')
const {
  createDesktopCustomQueryScenario,
  createDesktopDragDropScenario,
  createDesktopExportScenario,
  createDesktopOpenScenario,
} = require('../helpers/scenarios.cjs')

describe('Flippio E2E desktop workflows', () => {
  async function prepareFreshScenario(scenario) {
    await prepareScenario(scenario)
    await browser.refresh()
    await waitForE2EMode('E2E mode did not reinitialize after refresh')
  }

  it('opens a local desktop database from the file dialog', async () => {
    await waitForE2EMode('E2E mode did not initialize')
    await prepareFreshScenario(createDesktopOpenScenario())

    await clickActionButton({
      testIds: ['open-db-button'],
      texts: ['Open'],
      timeoutMsg: 'Open database action was not available',
    })
    await waitForCommand('dialog_select_file', 1, 'Desktop file dialog did not complete')
    await waitForCommand('db_get_tables', 1, 'Desktop table fetch did not complete after opening a file')
    await expect($('body')).toHaveText(expect.stringContaining('/tmp/flippio/local.db'))
  })

  it('runs a custom SQL query and returns to the selected table', async () => {
    await waitForE2EMode('E2E mode did not initialize')
    await prepareFreshScenario(createDesktopCustomQueryScenario())

    await simulateDroppedFile('/tmp/flippio/local.db')
    await waitForCommand('db_get_tables', 1, 'Dropped desktop file did not load tables')
    await selectNthOptionByKeyboard('table-select', 1)
    await waitForCommand('db_get_table_data', 1, 'Dropped desktop file did not load table data')
    await waitForGridText('alice@flippio.dev', 'Initial desktop rows did not render')

    await clickActionButton({
      testIds: ['sql-button'],
      texts: ['SQL'],
      timeoutMsg: 'SQL action was not available',
    })
    const queryDialogTitle = $('//*[@role="dialog"]//*[contains(normalize-space(.), "Run Query")]')
    await queryDialogTitle.waitForDisplayed({ timeout: 15000 })
    const queryTextarea = $('//*[@role="dialog"]//textarea[@placeholder="SELECT * FROM table_name WHERE condition"]')
    await queryTextarea.waitForDisplayed({ timeout: 15000 })
    await queryTextarea.setValue('SELECT id, name, email FROM users WHERE id = 99')
    await clickButtonByText('Run Query')

    await waitForCommand('db_execute_query', 1, 'Custom query did not execute')
    await waitForGridText('query@flippio.dev', 'Custom query result did not render')

    await clickActionButton({
      testIds: ['clear-sql-button'],
      selectors: ['button[title="Clear SQL query and show default table rows"]'],
      timeoutMsg: 'Clear custom query action was not available',
    })
    await waitForCommand('db_get_table_data', 2, 'Default table rows were not restored after clearing custom query')
    await waitForGridText('alice@flippio.dev', 'Default table rows did not return after clearing custom query')
  })

  it('exports the selected desktop database', async () => {
    await waitForE2EMode('E2E mode did not initialize')
    await prepareFreshScenario(createDesktopExportScenario())

    await clickActionButton({
      testIds: ['open-db-button'],
      texts: ['Open'],
      timeoutMsg: 'Open database action was not available',
    })
    await waitForCommand('dialog_select_file', 1, 'Desktop file dialog did not complete')
    await clickActionButton({
      testIds: ['export-db-button'],
      texts: ['Export'],
      timeoutMsg: 'Export database action was not available',
    })
    await waitForCommand('dialog_save_file', 1, 'Database export dialog did not complete')
  })

  it('opens a local desktop database via drag and drop', async () => {
    await waitForE2EMode('E2E mode did not initialize')
    await prepareFreshScenario(createDesktopDragDropScenario())

    await simulateDroppedFile('/tmp/flippio/local.db')
    await waitForCommand('db_get_tables', 1, 'Dropped desktop file did not load tables')
    await selectNthOptionByKeyboard('table-select', 1)
    await waitForCommand('db_get_table_data', 1, 'Dropped desktop file did not load table data')
    await waitForGridText('alice@flippio.dev', 'Dropped desktop database rows did not render')
  })
})
