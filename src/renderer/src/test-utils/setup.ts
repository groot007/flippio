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

// Mock next-themes to prevent window.matchMedia issues
vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
    resolvedTheme: 'light',
    themes: ['light', 'dark'],
    systemTheme: 'light',
  }),
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
  ;(globalThis as any).__TAURI_INTERNALS__ = {
    metadata: {
      currentWindow: { label: 'test-window' },
      webviews: [{ label: 'test-webview' }],
    },
    transformCallback: vi.fn(),
    invoke: vi.fn().mockResolvedValue({ success: true }),
  }

  // Mock window.api for all tests
  globalThis.window.api = {
    getDevices: vi.fn(),
    getIOSPackages: vi.fn(),
    getIOsDevicePackages: vi.fn(),
    getAndroidPackages: vi.fn(),
    getAndroidDatabaseFiles: vi.fn(),
    getIOSDeviceDatabaseFiles: vi.fn(),
    getIOSSimulatorDatabaseFiles: vi.fn(),
    checkAppExistence: vi.fn(),
    uploadIOSDbFile: vi.fn(),
    pushDatabaseFile: vi.fn(),
    getTables: vi.fn(),
    openDatabase: vi.fn(),
    getTableInfo: vi.fn(),
    updateTableRow: vi.fn(),
    executeQuery: vi.fn(),
    insertTableRow: vi.fn(),
    addNewRowWithDefaults: vi.fn(),
    deleteTableRow: vi.fn(),
    clearTable: vi.fn(),
    switchDatabase: vi.fn(),
    getChangeHistory: vi.fn(),
    getContextSummaries: vi.fn(),
    getChangeHistoryDiagnostics: vi.fn(),
    clearContextChanges: vi.fn(),
    clearAllChangeHistory: vi.fn(),
    openFile: vi.fn(),
    exportFile: vi.fn(),
    webUtils: vi.fn(),
    getAndroidEmulators: vi.fn(),
    getIOSSimulators: vi.fn(),
    launchAndroidEmulator: vi.fn(),
    launchIOSSimulator: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadAndInstallUpdate: vi.fn(),
  }
})

// Auto cleanup after each test
afterEach(() => {
  cleanup()
})
