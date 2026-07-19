const { $, $$, browser } = require('@wdio/globals')

let supportsOptionTestIds = null
let supportsGridShellTestId = null

const DEFAULT_TIMEOUT = 15000
const FAST_INTERVAL = 150

async function loadScenario(scenario) {
  await browser.execute((nextScenario) => {
    window.__FLIPPIO_E2E__?.loadScenario(nextScenario)
  }, scenario)
}

async function prepareScenario(scenario) {
  const usedPrepareScenario = await browser.execute((nextScenario) => {
    if (typeof window.__FLIPPIO_E2E__?.prepareScenario === 'function') {
      window.__FLIPPIO_E2E__.prepareScenario(nextScenario)
      return true
    }

    window.__FLIPPIO_E2E__?.loadScenario(nextScenario)
    return false
  }, scenario)
  if (!usedPrepareScenario) {
    await browser.refresh()
    await waitForE2EMode('E2E mode did not reinitialize after refresh fallback')
  }
}

async function getCommandHistory() {
  return browser.execute(() => window.__FLIPPIO_E2E__?.getCommandHistory() ?? [])
}

async function waitForE2EMode(timeoutMsg) {
  await browser.waitUntil(async () => {
    return browser.execute(() => window.__FLIPPIO_E2E__?.enabled === true)
  }, {
    timeout: DEFAULT_TIMEOUT,
    interval: FAST_INTERVAL,
    timeoutMsg,
  })
}

async function waitForCommand(command, minimumCount = 1, timeoutMsg = `Command ${command} did not complete`) {
  await browser.waitUntil(async () => {
    const history = await getCommandHistory()
    return history.filter(entry => entry.command === command).length >= minimumCount
  }, {
    timeout: DEFAULT_TIMEOUT,
    interval: FAST_INTERVAL,
    timeoutMsg,
  })
}

async function selectFirstOption(testId) {
  const select = $(`[data-testid="${testId}"]`)
  const input = $(`#${testId}`)

  await select.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })

  if (await input.isExisting()) {
    await input.click()
  }
  else {
    await select.click()
  }

  if (supportsOptionTestIds !== false) {
    const firstOptions = await $$(`[data-testid^="${testId}-option-"]`)
    for (const firstOption of firstOptions) {
      if (await firstOption.isDisplayed().catch(() => false)) {
        supportsOptionTestIds = true
        await firstOption.click()
        return
      }
    }

    const firstOption = $(`[data-testid^="${testId}-option-"]`)
    if (await firstOption.waitForDisplayed({ timeout: 1500, reverse: false }).catch(() => false)) {
      supportsOptionTestIds = true
      await firstOption.click()
      return
    }

    supportsOptionTestIds = false
  }

  const legacyOptions = await $$('//*[@role="option"]')

  for (const legacyOption of legacyOptions) {
    if (await legacyOption.isDisplayed().catch(() => false)) {
      await legacyOption.click()
      return
    }
  }

  const legacyFirstOption = $('(//*[@role="option"])[1]')

  try {
    await legacyFirstOption.waitForDisplayed({ timeout: 500 })
    await legacyFirstOption.click()
  }
  catch {
    await browser.keys('ArrowDown')
    await browser.keys('Enter')
  }
}

async function selectOptionByValue(testId, optionValue) {
  const select = $(`[data-testid="${testId}"]`)
  const input = $(`#${testId}`)

  await select.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })

  if (await input.isExisting()) {
    await input.click()
  }
  else {
    await select.click()
  }

  const option = $(`[data-testid="${testId}-option-${optionValue}"]`)
  await option.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })
  await option.click()
}

async function selectOptionByText(testId, optionText) {
  const select = $(`[data-testid="${testId}"]`)
  const input = $(`#${testId}`)

  await select.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })

  if (await input.isExisting()) {
    await input.click()
  }
  else {
    await select.click()
  }

  const exactOption = $(`//*[@role="option"]//*[contains(normalize-space(.), "${optionText}")]`)
  if (await exactOption.waitForDisplayed({ timeout: 1000 }).catch(() => false)) {
    await exactOption.click()
    return
  }

  const directOption = $(`//*[@role="option" and contains(normalize-space(.), "${optionText}")]`)
  await directOption.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })
  await directOption.click()
}

async function selectNthOption(testId, optionIndex) {
  const select = $(`[data-testid="${testId}"]`)
  const input = $(`#${testId}`)

  await select.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })

  if (await input.isExisting()) {
    await input.click()
  }
  else {
    await select.click()
  }

  const option = $(`(//*[@role="option"])[${optionIndex}]`)
  if (await option.waitForDisplayed({ timeout: 1000 }).catch(() => false)) {
    await option.click()
    return
  }

  for (let index = 0; index < optionIndex; index += 1) {
    await browser.keys('ArrowDown')
  }
  await browser.keys('Enter')
}

async function waitForTextToDisappear(text, timeoutMsg = `Text "${text}" did not disappear`) {
  await browser.waitUntil(async () => {
    return !(await $('body').getText()).includes(text)
  }, {
    timeout: DEFAULT_TIMEOUT,
    interval: FAST_INTERVAL,
    timeoutMsg,
  })
}

async function emitTauriEvent(eventName, payload) {
  await browser.execute((nextEventName, nextPayload) => {
    window.__FLIPPIO_E2E__?.emitTauriEvent(nextEventName, nextPayload)
  }, eventName, payload)
}

async function waitForGridText(text, timeoutMsg = `Grid text "${text}" did not appear`) {
  await browser.waitUntil(async () => {
    return (await getGridText()).includes(text)
  }, {
    timeout: DEFAULT_TIMEOUT,
    interval: FAST_INTERVAL,
    timeoutMsg,
  })
}

async function getGridText() {
  if (supportsGridShellTestId !== false) {
    const gridShell = $('[data-testid="data-grid-shell"]')
    if (await gridShell.isExisting()) {
      supportsGridShellTestId = true
      return gridShell.getText()
    }

    supportsGridShellTestId = false
  }

  const legacyGrid = $('.ag-root-wrapper')
  if (await legacyGrid.isExisting()) {
    return legacyGrid.getText()
  }

  return $('body').getText()
}

async function clickText(text) {
  const element = $(`//*[contains(normalize-space(.), "${text}")]`)
  await element.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })
  await element.click()
}

async function clickButtonByText(text) {
  const dialogButton = $(`//*[@role="dialog"]//button[contains(normalize-space(.), "${text}")]`)
  if (await dialogButton.isExisting()) {
    await dialogButton.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })
    await dialogButton.click()
    return
  }

  const button = $(`//button[contains(normalize-space(.), "${text}")]`)
  await button.waitForDisplayed({ timeout: DEFAULT_TIMEOUT })
  await button.click()
}

async function clickActionButton(options) {
  for (const selector of options.testIds ?? []) {
    const element = $(`[data-testid="${selector}"]`)
    if (await element.isDisplayed().catch(() => false)) {
      await element.click()
      return
    }
  }

  for (const selector of options.selectors ?? []) {
    const element = $(selector)
    if (await element.isDisplayed().catch(() => false)) {
      await element.click()
      return
    }
  }

  for (const text of options.texts ?? []) {
    const button = $(`//button[contains(normalize-space(.), "${text}")]`)
    if (await button.isDisplayed().catch(() => false)) {
      await button.click()
      return
    }
  }

  throw new Error(options.timeoutMsg || 'Action button not found')
}

async function clickGridCell(text) {
  const cells = await $$(`//*[contains(@class, "ag-cell") and contains(normalize-space(.), "${text}")]`)

  for (const cell of cells) {
    if (await cell.isDisplayed().catch(() => false)) {
      await cell.click()
      return
    }
  }

  const fallbackCell = $(`//*[contains(@class, "ag-cell") and contains(normalize-space(.), "${text}")]`)
  await fallbackCell.waitForDisplayed({ timeout: 5000 })
  await fallbackCell.click()
}

async function waitForRowDetailsPanel(rowText) {
  return browser.waitUntil(async () => {
    const editButton = $('[data-testid="edit-row-button"]')
    if (await editButton.isDisplayed().catch(() => false)) {
      return true
    }

    const removeButton = $('[data-testid="remove-row-button"]')
    if (await removeButton.isDisplayed().catch(() => false)) {
      return true
    }

    const drawerTitle = $('//*[contains(normalize-space(.), "Row Details") or contains(normalize-space(.), "Edit Row Data")]')
    if (await drawerTitle.isDisplayed().catch(() => false)) {
      return true
    }

    const bodyText = await $('body').getText()
    return bodyText.includes(rowText)
      && (bodyText.includes('Row Details') || bodyText.includes('Remove Row'))
  }, {
    timeout: 3000,
    interval: FAST_INTERVAL,
    timeoutMsg: `Row details did not open for "${rowText}"`,
  })
}

async function openHappyPathToGrid() {
  await waitForCommand('adb_get_devices', 1, 'Initial device fetch did not complete')
  await selectFirstOption('device-select')
  await waitForCommand('adb_get_packages', 1, 'Package fetch did not complete after selecting device')
  await selectFirstOption('app-select')
  await waitForCommand('adb_get_android_database_files', 1, 'Database file fetch did not complete after selecting app')
  await selectFirstOption('database-file-select')
  await waitForCommand('db_get_tables', 1, 'Table fetch did not complete after selecting database')
  await selectFirstOption('table-select')
  await waitForCommand('db_get_table_data', 1, 'Table data fetch did not complete after selecting table')
}

async function openIOSHappyPathToGrid(options = {}) {
  const {
    appText,
    deviceText,
  } = options

  await waitForCommand('device_get_ios_devices', 1, 'Initial iPhone device fetch did not complete')
  if (deviceText) {
    await selectOptionByText('device-select', deviceText)
  }
  else {
    await selectFirstOption('device-select')
  }
  await waitForCommand('device_get_ios_device_packages', 1, 'iPhone app fetch did not complete')
  if (appText) {
    await selectOptionByText('app-select', appText)
  }
  else {
    await selectFirstOption('app-select')
  }
  await waitForCommand('get_ios_device_database_files', 1, 'iPhone database file fetch did not complete')
  await selectFirstOption('database-file-select')
  await waitForCommand('db_get_tables', 1, 'Table fetch did not complete')
  await selectFirstOption('table-select')
  await waitForCommand('db_get_table_data', 1, 'Table data fetch did not complete')
}

async function openRowDetails(rowText) {
  await waitForGridText(rowText, `Grid row "${rowText}" did not render`)
  await clickGridCell(rowText)
  if (await waitForRowDetailsPanel(rowText).then(() => true).catch(() => false)) {
    return
  }

  await clickGridCell(rowText)
  await waitForRowDetailsPanel(rowText)
}

module.exports = {
  clickButtonByText,
  clickActionButton,
  clickGridCell,
  clickText,
  emitTauriEvent,
  getGridText,
  getCommandHistory,
  loadScenario,
  openHappyPathToGrid,
  openIOSHappyPathToGrid,
  openRowDetails,
  prepareScenario,
  selectFirstOption,
  selectNthOption,
  selectOptionByText,
  selectOptionByValue,
  waitForGridText,
  waitForCommand,
  waitForE2EMode,
  waitForTextToDisappear,
}
