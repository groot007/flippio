/* global describe, it */

const { expect } = require('@wdio/globals')
const {
  openSimulatorHappyPathToGrid,
  prepareScenario,
  waitForCommand,
  waitForE2EMode,
  waitForGridText,
} = require('../helpers/flows.cjs')
const { createSimulatorHappyPathScenario } = require('../helpers/scenarios.cjs')

describe('Flippio E2E simulator happy path', () => {
  it('loads a booted iPhone simulator through to the data grid', async () => {
    await waitForE2EMode('E2E mode did not initialize')
    await prepareScenario(createSimulatorHappyPathScenario())

    await openSimulatorHappyPathToGrid()
    await waitForCommand('device_get_ios_packages', 1, 'Simulator package fetch did not complete')
    await waitForCommand('get_ios_simulator_database_files', 1, 'Simulator database file fetch did not complete')
    await waitForGridText('alice@flippio.dev', 'Simulator rows did not render')

    await expect($('[data-testid="device-select"]')).toHaveText(expect.stringContaining('iPhone 15 Simulator'))
  })
})
