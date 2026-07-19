/* global describe, it */

const { $, browser, expect } = require('@wdio/globals')
const {
  prepareScenario,
  selectFirstOption,
  selectNthOption,
  waitForCommand,
  waitForE2EMode,
} = require('../helpers/flows.cjs')
const { createIOSScanRaceScenario } = require('../helpers/scenarios.cjs')

describe('Flippio E2E iPhone scan races', () => {
  it('cancels old scan and ignores stale progress when switching fast', async () => {
    await waitForE2EMode('E2E mode did not initialize')
    await prepareScenario(createIOSScanRaceScenario())

    await waitForCommand('device_get_ios_devices', 1, 'Initial iPhone device fetch did not complete')
    await selectFirstOption('device-select')
    await waitForCommand('device_get_ios_device_packages', 1, 'iPhone app fetch did not complete')
    await selectFirstOption('app-select')
    await waitForCommand('get_ios_device_database_files', 1, 'First iPhone scan did not start')

    await selectNthOption('app-select', 2)
    await waitForCommand('get_ios_device_database_files', 2, 'Second iPhone scan did not start')
    await waitForCommand('cancel_ios_device_database_scan', 1, 'Old iPhone scan was not canceled')

    await browser.waitUntil(async () => {
      return (await $('[data-testid="database-file-select"]').getText()).includes('Select Database')
    }, {
      timeout: 15000,
      timeoutMsg: 'Database select did not remain available after scan switch',
    })

    await selectFirstOption('database-file-select')
    await expect($('[data-testid="database-file-select"]')).toHaveText(expect.stringContaining('second.db'))
    await expect($('[data-testid="database-file-select"]')).not.toHaveText(expect.stringContaining('first.db'))
  })
})
