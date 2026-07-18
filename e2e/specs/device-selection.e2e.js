/* global describe, it */

const { $, expect } = require('@wdio/globals')
const {
  getCommandHistory,
  prepareScenario,
  selectFirstOption,
  waitForCommand,
  waitForE2EMode,
} = require('../helpers/flows.cjs')
const { createAndroidDeviceSelectionScenario } = require('../helpers/scenarios.cjs')

describe('Flippio E2E smoke', () => {
  it('loads mocked devices and unlocks app selection after selecting a device', async () => {
    await waitForE2EMode('E2E mode did not initialize')

    await prepareScenario(createAndroidDeviceSelectionScenario())

    await expect($('[data-testid="app-shell"]')).toBeExisting()
    await expect($('body')).toHaveAttribute('data-e2e-mode', 'true')

    const appSelect = $('[data-testid="app-select"]')
    await expect(appSelect).toHaveAttribute('data-e2e-disabled', 'true')

    await waitForCommand('adb_get_devices', 1, 'Initial device fetch did not complete')
    await selectFirstOption('device-select')

    await waitForCommand('adb_get_packages', 1, 'Package fetch did not complete after selecting device')
    await expect(appSelect).toHaveAttribute('data-e2e-disabled', 'false')
    await expect($('[data-testid="device-select"]')).toHaveText(expect.stringContaining('Pixel 8 API 35'))

    const history = await getCommandHistory()
    const commands = history.map(entry => entry.command)
    await expect(commands).toEqual(expect.arrayContaining([
      'adb_get_devices',
      'device_get_ios_devices',
      'get_ios_simulators',
      'adb_get_packages',
    ]))
    await expect(commands.indexOf('adb_get_packages')).toBeGreaterThan(commands.indexOf('adb_get_devices'))
  })
})
