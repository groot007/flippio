import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '../../../test-utils/render'
import { RowEditor } from '../RowEditor'

const mockRefetchTable = vi.fn()
const mockRefreshChangeHistory = vi.fn()
const mockSetSelectedRow = vi.fn()
const mockSetIsEditing = vi.fn()
const mockSetIsLoading = vi.fn()
const mockSetEditedData = vi.fn()

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  globalThis.window.api = {
    updateTableRow: vi.fn(),
    pushDatabaseFile: vi.fn(),
  } as any
})

vi.mock('@renderer/hooks/useTableDataQuery', () => ({
  useTableDataQuery: () => ({
    refetch: mockRefetchTable,
  }),
}))

vi.mock('@renderer/hooks/useChangeHistory', () => ({
  useChangeHistoryRefresh: () => ({
    refreshChangeHistory: mockRefreshChangeHistory,
  }),
}))

vi.mock('@renderer/store/useRowEditingStore', () => ({
  useRowEditingStore: () => ({
    selectedRow: {
      rowData: { id: 1, name: 'Old Name', email: 'old@example.com' },
      originalData: { id: 1, name: 'Old Name', email: 'old@example.com' },
      columnInfo: [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT' },
        { name: 'email', type: 'TEXT' },
      ],
    },
    setSelectedRow: mockSetSelectedRow,
  }),
}))

vi.mock('@renderer/store', () => ({
  useTableData: (selector) => selector({
    tableData: {
      columns: [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT' },
        { name: 'email', type: 'TEXT' },
      ],
    },
  }),
  useCurrentDeviceSelection: () => ({
    selectedDevice: { id: 'device-1', name: 'Pixel', deviceType: 'android' },
    selectedApplication: { bundleId: 'com.test.app', name: 'Test App' },
  }),
  useCurrentDatabaseSelection: () => ({
    selectedDatabaseFile: {
      path: '/tmp/test.db',
      remotePath: '/data/data/com.test.app/databases/test.db',
      packageName: 'com.test.app',
      deviceType: 'android',
    },
    selectedDatabaseTable: { name: 'users' },
  }),
}))

vi.mock('@renderer/ui/toaster', () => ({
  toaster: {
    create: vi.fn(),
  },
}))

describe('RowEditor critical path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(globalThis.window.api.updateTableRow).mockResolvedValue({ success: true })
    vi.mocked(globalThis.window.api.pushDatabaseFile).mockResolvedValue({ success: true })
  })

  it('saves edited row, pushes DB, and refetches fresh data', async () => {
    render(
      <RowEditor
        isEditing={true}
        setIsEditing={mockSetIsEditing}
        isLoading={false}
        setIsLoading={mockSetIsLoading}
        editedData={{ id: 1, name: 'New Name', email: 'new@example.com' }}
        setEditedData={mockSetEditedData}
      />,
    )

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(globalThis.window.api.updateTableRow).toHaveBeenCalledWith(
        'users',
        { id: 1, name: 'New Name', email: 'new@example.com' },
        expect.stringContaining('id'),
        '/tmp/test.db',
        'device-1',
        'Pixel',
        'android',
        'com.test.app',
        'Test App',
      )
    })

    expect(globalThis.window.api.pushDatabaseFile).toHaveBeenCalledWith(
      'device-1',
      '/tmp/test.db',
      'com.test.app',
      '/data/data/com.test.app/databases/test.db',
      'android',
    )
    expect(mockRefetchTable).toHaveBeenCalledTimes(1)
    expect(mockRefreshChangeHistory).toHaveBeenCalledTimes(1)
    expect(mockSetSelectedRow).toHaveBeenCalledWith(
      expect.objectContaining({
        rowData: { id: 1, name: 'New Name', email: 'new@example.com' },
      }),
    )
    expect(mockSetIsEditing).toHaveBeenCalledWith(false)
  })
})
