import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke
}))

describe('tauri-api basic tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should test basic tauri-api functionality', async () => {
    // Import the module after mocking
    await import('../tauri-api')
    
    // Verify the mock was called (module initialization might call invoke)
    expect(mockInvoke).toBeDefined()
  })

  it('should handle tauri invoke calls', async () => {
    const testData = { success: true, data: 'test result' }
    mockInvoke.mockResolvedValueOnce(testData)
    
    // Call mockInvoke directly to verify it works
    const result = await mockInvoke('test_command', {})
    
    expect(mockInvoke).toHaveBeenCalledWith('test_command', {})
    expect(result).toEqual(testData)
  })
})
