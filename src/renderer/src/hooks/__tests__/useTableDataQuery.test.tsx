import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTableDataQuery } from '../useTableDataQuery'

const mockSetSelectedDatabaseFile = vi.fn()
const mockSelectedDatabaseFile = {
  path: '/tmp/stale.db',
  filename: 'enablers_db.db',
  remotePath: '/data/data/com.test.app/databases/enablers_db.db',
  deviceType: 'android',
}

vi.mock('@renderer/store', () => ({
  useCurrentDatabaseSelection: selector => selector({
    selectedDatabaseFile: mockSelectedDatabaseFile,
    setSelectedDatabaseFile: mockSetSelectedDatabaseFile,
  }),
  useCurrentDeviceSelection: selector => selector({
    selectedDevice: { id: 'device-1', name: 'Pixel', deviceType: 'android' },
    selectedApplication: { bundleId: 'com.test.app', name: 'Test App' },
  }),
}))

vi.mock('@renderer/hooks/useDatabaseFiles', () => ({
  fetchDatabaseFilesForSelection: vi.fn().mockResolvedValue([
    {
      path: '/tmp/fresh.db',
      filename: 'enablers_db.db',
      remotePath: '/data/data/com.test.app/databases/enablers_db.db',
      deviceType: 'android',
    },
  ]),
}))

describe('useTableDataQuery critical path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.window.api = {
      openDatabase: vi.fn().mockResolvedValue({ success: true }),
      getTableInfo: vi.fn()
        .mockResolvedValueOnce({
          success: false,
          error: 'Database file does not exist: /tmp/stale.db',
        })
        .mockResolvedValueOnce({
          success: true,
          columns: [{ name: 'id', type: 'INTEGER' }],
          rows: [{ id: 1 }],
        }),
    } as any
  })

  it('recovers stale temp DB path and fetches fresh table data', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const wrapper = ({ children }: React.PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useTableDataQuery('config'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(globalThis.window.api.getTableInfo).toHaveBeenCalledWith('config', '/tmp/stale.db')
    expect(globalThis.window.api.getTableInfo).toHaveBeenLastCalledWith('config', '/tmp/fresh.db')
    expect(mockSetSelectedDatabaseFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/tmp/fresh.db' }),
    )
    expect(result.current.data).toEqual({
      columns: [{ name: 'id', type: 'INTEGER' }],
      rows: [{ id: 1 }],
    })
  })
})
