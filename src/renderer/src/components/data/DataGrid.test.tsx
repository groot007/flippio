import { useCurrentDatabaseSelection } from '@renderer/store/useCurrentDatabaseSelection'
import { useTableData } from '@renderer/store/useTableData'
import { render } from '@renderer/test-utils/render'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DataGrid } from './DataGrid'

vi.mock('@renderer/store/useTableData', () => ({
  useTableData: vi.fn(),
}))

vi.mock('@renderer/store/useCurrentDatabaseSelection', () => ({
  useCurrentDatabaseSelection: vi.fn(),
}))

describe('dataGrid', () => {
  it('renders correctly when no table is selected', () => {
    // @ts-expect-error test mock
    useTableData.mockReturnValue({
      isLoadingTableData: false,
      tableData: { columns: [], rows: [] },
    })
    // @ts-expect-error test mock
    useCurrentDatabaseSelection.mockReturnValue({
      selectedDatabaseTable: null,
    })

    render(<DataGrid />)

    expect(screen.queryByText('Add new row')).not.toBeInTheDocument()
  })

  it('renders table data when a table is selected', () => {
    // @ts-expect-error test mock
    useTableData.mockReturnValue({
      isLoadingTableData: false,
      tableData: {
        columns: [{ name: 'id', type: 'integer' }, { name: 'name', type: 'text' }],
        rows: [{ id: 1, name: 'Test Row' }],
      },
    })
    // @ts-expect-error test mock
    useCurrentDatabaseSelection.mockReturnValue({
      selectedDatabaseTable: { name: 'test_table' },
    })

    render(<DataGrid />)

    expect(screen.getByText('id (integer)')).toBeInTheDocument()
    expect(screen.getByText('name (text)')).toBeInTheDocument()
    expect(screen.getByText('Test Row')).toBeInTheDocument()
  })

  it('opens the Add New Row modal when the button is clicked', () => {
    // @ts-expect-error test mock
    useTableData.mockReturnValue({
      isLoadingTableData: false,
      tableData: {
        columns: [{ name: 'id', type: 'integer' }, { name: 'name', type: 'text' }],
        rows: [],
      },
    })
    // @ts-expect-error test mock
    useCurrentDatabaseSelection.mockReturnValue({
      selectedDatabaseTable: { name: 'test_table' },
    })

    render(<DataGrid />)

    const addButton = screen.getByLabelText('Add new row')
    fireEvent.click(addButton)

    expect(screen.getByText('Add New Row')).toBeInTheDocument()
  })
})
