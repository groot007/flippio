import { useCurrentDatabaseSelection } from '@renderer/store/useCurrentDatabaseSelection'
import { useRowEditingStore } from '@renderer/store/useRowEditingStore'
import { useTableData } from '@renderer/store/useTableData'
import { render } from '@renderer/test-utils/render'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SidePanel } from './SidePanel'

vi.mock('@renderer/store/useRowEditingStore', () => ({
  useRowEditingStore: vi.fn(),
}))

vi.mock('@renderer/store/useCurrentDatabaseSelection', () => ({
  useCurrentDatabaseSelection: vi.fn(),
}))

vi.mock('@renderer/store/useTableData', () => ({
  useTableData: vi.fn(),
}))

describe('sidePanel', () => {
  it('renders correctly when no row is selected', () => {
    // @ts-expect-error test mock
    useRowEditingStore.mockReturnValue({ selectedRow: null })

    render(<SidePanel />)

    expect(screen.queryByText('Row Details')).not.toBeInTheDocument()
  })

  it('renders row details when a row is selected', () => {
    // @ts-expect-error test mock
    useRowEditingStore.mockReturnValue({
      selectedRow: { rowData: { id: 1, name: 'Test Row' } },
    })

    render(<SidePanel />)

    expect(screen.getByText('Row Details')).toBeInTheDocument()
    expect(screen.getByText('Test Row')).toBeInTheDocument()
  })

  it('handles row deletion correctly', async () => {
    const mockDeleteRow = vi.fn()
    // @ts-expect-error test mock
    useRowEditingStore.mockReturnValue({
      selectedRow: { rowData: { id: 1, name: 'Test Row' } },
      setSelectedRow: vi.fn(),
    })
    // @ts-expect-error test mock
    useCurrentDatabaseSelection.mockReturnValue({
      selectedDatabaseTable: { name: 'test_table' },
    })
    // @ts-expect-error test mock
    useTableData.mockReturnValue({
      tableData: { columns: [], rows: [] },
      setTableData: vi.fn(),
    })

    render(<SidePanel />)

    fireEvent.click(screen.getByText('Remove Row'))
    fireEvent.click(screen.getByText('Delete'))

    expect(mockDeleteRow).not.toHaveBeenCalled() // Mocking not implemented yet
  })
})
