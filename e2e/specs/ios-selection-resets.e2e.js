/* global describe, it */

const { $, expect } = require('@wdio/globals')
const {
  openIOSHappyPathToGrid,
  prepareScenario,
  selectNthOption,
  waitForCommand,
  waitForE2EMode,
  waitForGridText,
  waitForTextToDisappear,
} = require('../helpers/flows.cjs')
const {
  createIOSAppChangeResetScenario,
  createIOSDeviceChangeResetScenario,
} = require('../helpers/scenarios.cjs')

describe('Flippio E2E iPhone selection resets', () => {
  it('clears app/database/table/grid when device changes', async () => {
    await waitForE2EMode('E2E mode did not initialize')
    await prepareScenario(createIOSDeviceChangeResetScenario())

    await openIOSHappyPathToGrid()
    await waitForGridText('user1@flippio.dev', 'Initial iPhone grid did not render')

    await selectNthOption('device-select', 2)
    await waitForCommand('device_get_ios_device_packages', 2, 'Second device app fetch did not complete')
    await waitForTextToDisappear('user1@flippio.dev', 'Old grid data was not cleared after device switch')

    const bodyText = await $('body').getText()
    await expect(bodyText).toContain('Select app to load data')
    await expect(bodyText).not.toContain('first.db')
  })

  it('clears database/table/grid when app changes on same iphone-device', async () => {
    await waitForE2EMode('E2E mode did not initialize')
    await prepareScenario(createIOSAppChangeResetScenario())

    await openIOSHappyPathToGrid()
    await waitForGridText('user1@flippio.dev', 'Initial iPhone grid did not render')

    await selectNthOption('app-select', 2)
    await waitForCommand('get_ios_device_database_files', 2, 'Second app database-file fetch did not complete')
    await waitForTextToDisappear('user1@flippio.dev', 'Old grid data was not cleared after app switch')

    const bodyText = await $('body').getText()
    await expect(bodyText).toContain('Select database')
    await expect(bodyText).not.toContain('first.db')
  })
})
