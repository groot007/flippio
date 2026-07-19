import type { ChangeHistoryContext } from '@renderer/types/changeHistory'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBaseDatabaseMutation } from '../useBaseDatabaseMutation'

const {
  mockEnsureActiveDatabaseFile,
  mockRefreshChangeHistory,
  mockSetSelectedDatabaseFile,
  mockSetSelectedRow,
  mockToasterCreate,
} = vi.hoisted(() => ({
  mockEnsureActiveDatabaseFile: vi.fn(),
  mockRefreshChangeHistory: vi.fn(),
  mockSetSelectedDatabaseFile: vi.fn(),
  mockSetSelectedRow: vi.fn(),
  mockToasterCreate: vi.fn(),
}))

vi.mock('@renderer/store', () => ({
  useCurrentDatabaseSelection: (selector: any) => selector({
    setSelectedDatabaseFile: mockSetSelectedDatabaseFile,
  }),
}))

vi.mock('@renderer/store/useRowEditingStore', () => ({
  useRowEditingStore: () => ({
    setSelectedRow: mockSetSelectedRow,
  }),
}))

vi.mock('@renderer/ui/toaster', () => ({
  toaster: {
    create: mockToasterCreate,
  },
}))

vi.mock('../useChangeHistory', () => ({
  useChangeHistoryRefresh: () => ({
    refreshChangeHistory: mockRefreshChangeHistory,
  }),
}))

vi.mock('@renderer/utils/databaseFileResolver', () => ({
  ensureActiveDatabaseFile: (...args: any[]) => mockEnsureActiveDatabaseFile(...args),
}))

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve
  })

  return { promise, resolve }
}

describe('useBaseDatabaseMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    globalThis.window.api.pushDatabaseFile = vi.fn()
    mockEnsureActiveDatabaseFile.mockImplementation(async ({ databaseFile }: { databaseFile: any }) => databaseFile)
  })

  it('keeps the panel open until push and active table refetch finish, then shows success', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    })

    const pushDeferred = createDeferred<{ success: boolean }>()
    const refetchDeferred = createDeferred<void>()
    const steps: string[] = []

    vi.mocked(globalThis.window.api.pushDatabaseFile).mockImplementation(async () => {
      steps.push('push:start')
      const result = await pushDeferred.promise
      steps.push('push:end')
      return result
    })

    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(async (filters: any) => {
      if (filters?.queryKey?.[0] === 'tableData') {
        steps.push(`invalidate:${filters.queryKey.join(':')}`)
      }
      return undefined as any
    })

    vi.spyOn(queryClient, 'refetchQueries').mockImplementation(async (filters: any) => {
      if (filters?.queryKey?.[0] === 'tableData') {
        steps.push(`refetch:${filters.queryKey.join(':')}`)
        await refetchDeferred.promise
        steps.push('refetch:end')
      }
      return undefined as any
    })

    mockRefreshChangeHistory.mockImplementation(() => {
      steps.push('history')
    })
    mockSetSelectedRow.mockImplementation(() => {
      steps.push('close')
    })
    mockToasterCreate.mockImplementation(() => {
      steps.push('toast')
    })

    const wrapper = createWrapper(queryClient)
    const { result } = renderHook(() =>
      useBaseDatabaseMutation<ChangeHistoryContext, { ok: boolean }>({
        mutationFn: async () => {
          steps.push('mutation')
          return { ok: true }
        },
        successMessage: 'Row deleted',
        errorMessage: 'Delete failed',
        shouldClosePanel: true,
      }), { wrapper })

    const variables: ChangeHistoryContext = {
      selectedApplication: { bundleId: 'com.test.app', name: 'Test App' } as any,
      selectedDatabaseFile: {
        path: '/tmp/current.db',
        remotePath: '/data/data/com.test.app/databases/current.db',
        packageName: 'com.test.app',
        location: 'databases',
        filename: 'current.db',
        deviceType: 'android',
      } as any,
      selectedDatabaseTable: { name: 'items' } as any,
      selectedDevice: { id: 'device-1', name: 'Pixel', deviceType: 'android' } as any,
    }

    let mutationPromise!: Promise<any>
    await act(async () => {
      mutationPromise = result.current.mutateAsync(variables)
      await Promise.resolve()
    })

    expect(steps).toEqual(['mutation', 'push:start'])
    expect(mockSetSelectedRow).not.toHaveBeenCalled()
    expect(mockToasterCreate).not.toHaveBeenCalled()

    await act(async () => {
      pushDeferred.resolve({ success: true })
      await Promise.resolve()
    })

    expect(steps).toEqual([
      'mutation',
      'push:start',
      'push:end',
      'invalidate:tableData:items:/tmp/current.db',
      'refetch:tableData:items:/tmp/current.db',
    ])
    expect(mockSetSelectedRow).not.toHaveBeenCalled()
    expect(mockToasterCreate).not.toHaveBeenCalled()

    await act(async () => {
      refetchDeferred.resolve()
      await mutationPromise
    })

    expect(steps).toEqual([
      'mutation',
      'push:start',
      'push:end',
      'invalidate:tableData:items:/tmp/current.db',
      'refetch:tableData:items:/tmp/current.db',
      'refetch:end',
      'history',
      'close',
      'toast',
    ])
    expect(mockSetSelectedRow).toHaveBeenCalledWith(null)
    expect(mockToasterCreate).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Row deleted',
      type: 'success',
    }))
  })
})
