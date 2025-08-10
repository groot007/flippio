import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock Tauri APIs before importing the module
const mockInvoke = vi.fn()
const mockListen = vi.fn()
const mockUnlisten = vi.fn()

// Mock console methods
const consoleSpy = {
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
}

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen,
}))

describe('tauri-api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    consoleSpy.log.mockClear()
    consoleSpy.warn.mockClear()
    consoleSpy.error.mockClear()
  })

  describe('window.api initialization', () => {
    it('should create window.api object', async () => {
      // Clear any existing window.api
      if (globalThis.window?.api) {
        delete (globalThis.window as any).api
      }
      
      // Import the module to trigger initialization
      await import('../tauri-api')
      
      // Check that window.api exists and has expected methods
      expect(globalThis.window?.api).toBeDefined()
      expect(typeof globalThis.window?.api?.getDevices).toBe('function')
      expect(typeof globalThis.window?.api?.openDatabase).toBe('function')
      expect(typeof globalThis.window?.api?.getTables).toBe('function')
    })
  })
})

beforeAll(() => {
  // Setup default mock behaviors
  mockListen.mockResolvedValue(mockUnlisten)
  mockUnlisten.mockResolvedValue(undefined)
})

beforeEach(() => {
  vi.clearAllMocks()
  consoleSpy.log.mockClear()
  consoleSpy.warn.mockClear() 
  consoleSpy.error.mockClear()
  // Reset default mock behaviors
  mockListen.mockResolvedValue(mockUnlisten)
  mockInvoke.mockResolvedValue({ success: true, data: null })
})

describe('tauri-api initialization', () => {
  it('should initialize event system successfully', async () => {
    // Clear previous calls to get fresh state
    vi.clearAllMocks()
    consoleSpy.log.mockClear()
    
    // Import the initialization function and call it
    const { initializeEventSystem } = await import('../tauri-api')
    await initializeEventSystem()
    
    // The function should have called listen during initialization
    expect(mockListen).toHaveBeenCalledWith('tauri://test-event', expect.any(Function))
    expect(consoleSpy.log).toHaveBeenCalledWith('Event system initialized successfully')
  })

  it('should handle event system initialization failure', async () => {
    // Clear previous calls
    vi.clearAllMocks()
    consoleSpy.warn.mockClear()
    
    // Make listen fail
    mockListen.mockRejectedValueOnce(new Error('Event system failed'))
    
    // Import the initialization function and call it
    const { initializeEventSystem } = await import('../tauri-api')
    await initializeEventSystem()
    
    expect(consoleSpy.warn).toHaveBeenCalledWith('Event system initialization failed:', expect.any(Error))
  })
})
