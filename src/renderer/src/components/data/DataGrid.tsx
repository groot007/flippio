/**
 * DataGrid Component
 * 
 * This component now uses the Container/Presenter pattern for better separation of concerns.
 * The business logic is handled in DataGridContainer, while the UI rendering is in DataGridPresenter.
 */

import { DataGridContainer } from '@renderer/features/database/components'

export function CustomHeaderComponent(props: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
      <span style={{ fontWeight: 'medium', fontSize: '14px' }}>{props.displayName}</span>
      <span style={{ fontSize: '10px', color: 'gray', marginTop: 0 }}>
        (
        {props.columnType?.toLowerCase()}
        )
      </span>
    </div>
  )
}

export function DataGrid() {
  return <DataGridContainer />
}
