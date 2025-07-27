import { cleanup } from '@testing-library/react'
import { JSDOM } from 'jsdom'
import { afterEach, beforeAll, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

const { window } = new JSDOM()

// IntersectionObserver mock
const IntersectionObserverMock = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  takeRecords: vi.fn(),
  unobserve: vi.fn(),
}))
vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
window.IntersectionObserver = IntersectionObserverMock

// Scroll Methods mock
window.Element.prototype.scrollTo = () => {}
window.Element.prototype.scrollIntoView = () => {}

// requestAnimationFrame mock
window.requestAnimationFrame = cb => setTimeout(cb, 1000 / 60)

// URL object mock
window.URL.createObjectURL = () => 'https://i.pravatar.cc/300'
window.URL.revokeObjectURL = () => {}
window.matchMedia = vi.fn(() => ({
  matches: false,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  media: '',
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})) as any

// navigator mock
Object.defineProperty(window, 'navigator', {
  value: {
    clipboard: {
      writeText: vi.fn(),
    },
  },
})

// Mock Tauri APIs at module level before any imports
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: vi.fn(() => ({
    onDragDropEvent: vi.fn(() => Promise.resolve(() => {})),
    label: 'test-window',
  })),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({ success: true }),
}))

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  // Mock Tauri internals to prevent metadata access errors
  globalThis.__TAURI_INTERNALS__ = {
    metadata: {
      currentWindow: { label: 'test-window' },
      webviews: [{ label: 'test-webview' }],
    },
    transformCallback: vi.fn(),
    invoke: vi.fn().mockResolvedValue({ success: true }),
  }

  // Mock window.api for all tests
  globalThis.window.api = {
    getDevices: vi.fn().mockResolvedValue([]),
    getIOSPackages: vi.fn().mockResolvedValue({ success: true, packages: [] }),
    getIOsDevicePackages: vi.fn().mockResolvedValue({ success: true, packages: [] }),
    getAndroidPackages: vi.fn().mockResolvedValue({ success: true, packages: [] }),
    getAndroidDatabaseFiles: vi.fn().mockResolvedValue({ success: true, files: [] }),
    getIOSDeviceDatabaseFiles: vi.fn().mockResolvedValue({ success: true, files: [] }),
    getIOSSimulatorDatabaseFiles: vi.fn().mockResolvedValue({ success: true, files: [] }),
    checkAppExistence: vi.fn().mockResolvedValue({ success: true }),
    uploadIOSDbFile: vi.fn().mockResolvedValue({ success: true }),
    pushDatabaseFile: vi.fn().mockResolvedValue({ success: true }),
    getTables: vi.fn().mockResolvedValue({ success: true, tables: [] }),
    openDatabase: vi.fn().mockResolvedValue({ success: true }),
    getTableInfo: vi.fn().mockResolvedValue({ success: true, data: { rows: [], columns: [] } }),
    updateTableRow: vi.fn().mockResolvedValue({ success: true }),
    executeQuery: vi.fn().mockResolvedValue({ success: true }),
    insertTableRow: vi.fn().mockResolvedValue({ success: true }),
    addNewRowWithDefaults: vi.fn().mockResolvedValue({ success: true }),
    deleteTableRow: vi.fn().mockResolvedValue({ success: true }),
    switchDatabase: vi.fn().mockResolvedValue({ success: true }),
    openFile: vi.fn().mockResolvedValue({ success: true }),
    exportFile: vi.fn().mockResolvedValue({ success: true }),
    webUtils: {
      getPathForFile: vi.fn().mockResolvedValue('/test/path'),
    },
    getAndroidEmulators: vi.fn().mockResolvedValue({ 
      success: true, 
      emulators: [
        { name: 'Test Android Emulator', id: 'test-android', platform: 'android', state: 'Shutdown' },
      ], 
    }),
    getIOSSimulators: vi.fn().mockResolvedValue({ 
      success: true, 
      simulators: [
        { name: 'Test iOS Simulator', id: 'test-ios', platform: 'ios', state: 'Shutdown' },
      ], 
    }),
    launchAndroidEmulator: vi.fn().mockResolvedValue({ success: true }),
    launchIOSSimulator: vi.fn().mockResolvedValue({ success: true }),
    checkForUpdates: vi.fn().mockResolvedValue({ success: true, updateAvailable: false }),
    downloadAndInstallUpdate: vi.fn().mockResolvedValue({ success: true }),
  }
})

// Auto cleanup after each test
afterEach(() => {
  cleanup()
})
