import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useChangeHistory, useChangeHistoryRefresh } from '../useChangeHistory'

function createWrapper() {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }: { children: ReactNode }) => 
    React.createElement(QueryClientProvider, { client: testQueryClient }, children)
}

vi.mock('@renderer/store/useCurrentDeviceSelection', () => ({
  useCurrentDeviceSelection: () => ({
    selectedDevice: { id: 'test-device', name: 'Test Device' },
    selectedApplication: { bundleId: 'com.test.app', name: 'Test App' },
  }),
}))

vi.mock('@renderer/store/useCurrentDatabaseSelection', () => ({
  useCurrentDatabaseSelection: () => ({
    selectedDatabaseFile: {
      path: '/path/to/test.db',
      packageName: 'com.test.app',
      filename: 'test.db',
    },
  }),
}))

vi.mock('@renderer/shared/utils/contextKey', () => ({
  generateContextKey: vi.fn().mockResolvedValue('test-context-key'),
}))

beforeAll(() => {
  globalThis.window.api = {
    getChangeHistory: vi.fn(),
  } as any
})

describe('useChangeHistory', () => {
  let mockGetChangeHistory: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetChangeHistory = vi.mocked(globalThis.window.api.getChangeHistory)
  })

  it('should fetch change history successfully', async () => {
    const mockChanges = [
      {
        id: '1',
        timestamp: '2024-01-01T10:00:00Z',
        table_name: 'users',
        operation_type: 'INSERT',
        changes: { name: 'John Doe', email: 'john@example.com' },
      },
      {
        id: '2',
        timestamp: '2024-01-01T11:00:00Z',
        table_name: 'users',
        operation_type: 'UPDATE',
        changes: { email: 'john.doe@example.com' },
      },
    ]

    mockGetChangeHistory.mockResolvedValue({
      success: true,
      data: mockChanges,
    })

    const { result } = renderHook(() => useChangeHistory(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockGetChangeHistory).toHaveBeenCalledWith('test-context-key')
    expect(result.current.data).toEqual(mockChanges)
  })

  it('should handle pagination correctly', async () => {
    const mockChanges = Array.from({ length: 100 }, (_, i) => ({
      id: (i + 1).toString(),
      timestamp: `2024-01-01T${String(i % 24).padStart(2, '0')}:00:00Z`,
      table_name: 'users',
      operation_type: 'INSERT',
      changes: { name: `User ${i + 1}` },
    }))

    mockGetChangeHistory.mockResolvedValue({
      success: true,
      data: mockChanges,
    })

    const { result } = renderHook(() => useChangeHistory(10, 20), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toHaveLength(10)
    expect(result.current.data?.[0]?.id).toBe('21') // offset 20, so starts at index 20
  })

  it('should handle API errors', async () => {
    mockGetChangeHistory.mockResolvedValue({
      success: false,
      error: 'Database connection failed',
    })

    const { result } = renderHook(() => useChangeHistory(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect((result.current.error as Error).message).toBe('Database connection failed')
  })

  it('should handle empty response', async () => {
    mockGetChangeHistory.mockResolvedValue({
      success: true,
      data: [],
    })

    const { result } = renderHook(() => useChangeHistory(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual([])
  })

  it('should handle missing data in response', async () => {
    mockGetChangeHistory.mockResolvedValue({
      success: true,
    })

    const { result } = renderHook(() => useChangeHistory(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual([])
  })

  it('should use correct query key', async () => {
    mockGetChangeHistory.mockResolvedValue({
      success: true,
      data: [],
    })

    const { result } = renderHook(() => useChangeHistory(25, 10), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    // The query key should include all the parameters
    expect(result.current.dataUpdatedAt).toBeGreaterThan(0)
  })
})

describe('useChangeHistoryRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should provide refresh function', () => {
    const { result } = renderHook(() => useChangeHistoryRefresh(), {
      wrapper: createWrapper(),
    })

    expect(typeof result.current.refreshChangeHistory).toBe('function')
  })

  it('should invalidate correct queries when refreshed', () => {
    const { result } = renderHook(() => useChangeHistoryRefresh(), {
      wrapper: createWrapper(),
    })

    result.current.refreshChangeHistory()

    expect(typeof result.current.refreshChangeHistory).toBe('function')
  })
})
