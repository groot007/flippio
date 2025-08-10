/**
 * TableFooter Component
 * 
 * This component provides table pagination controls and action buttons.
 * The business logic is handled in TableFooterContainer, while the UI rendering is in TableFooterPresenter.
 */

import type { AgGridReact } from 'ag-grid-react'
import { TableFooterContainer } from '@renderer/features/database/components'

export function TableFooter(props: { 
  gridRef: React.RefObject<AgGridReact>
  totalRows: number
  onPageSizeChange?: (pageSize: number) => void
}) {
  return <TableFooterContainer {...props} />
}
