import { useChangeHistoryRefresh } from '@renderer/features/change-history/hooks'
import { useTableDataQuery } from '@renderer/features/database/hooks'
import { useCurrentDatabaseSelection, useRowEditingStore } from '@renderer/features/database/stores'
import { useCurrentDeviceSelection } from '@renderer/features/devices/stores'
import { useColorMode } from '@renderer/ui/color-mode'
import { toaster } from '@renderer/ui/toaster'
import React, { useState } from 'react'

import { DataGridPresenter } from './DataGridPresenter'

export const DataGridContainer: React.FC = () => {
  console.log('DataGridContainer: Component rendering')
  
  const { selectedDatabaseTable, selectedDatabaseFile } = useCurrentDatabaseSelection()
  const { selectedDevice, selectedApplication } = useCurrentDeviceSelection()
  const { setSelectedRow } = useRowEditingStore()
  const { refreshChangeHistory } = useChangeHistoryRefresh()
  const { colorMode } = useColorMode()
  const [isAddingRow, setIsAddingRow] = useState(false)

  console.log('DataGridContainer: Current state', {
    selectedDatabaseTable,
    selectedDatabaseFile,
    selectedDevice,
    selectedApplication,
  })

  const { data, isLoading, error, refetch } = useTableDataQuery(selectedDatabaseTable?.name || '')

  // Check for database corruption errors
  React.useEffect(() => {
    if (error) {
      const errorMessage = error.message || String(error)
      console.error('DataGridContainer: Database error detected:', errorMessage)
      
      if (errorMessage.includes('database disk image is malformed') || errorMessage.includes('code: 11')) {
        toaster.create({
          title: 'Database Corrupted',
          description: 'The database file appears to be corrupted. Please try opening a different database file or restore from a backup.',
          type: 'error',
          duration: 10000,
        })
      }
      else if (errorMessage.includes('database is locked')) {
        toaster.create({
          title: 'Database Locked',
          description: 'The database is currently locked by another process. Please try again in a moment.',
          type: 'warning',
          duration: 5000,
        })
      }
      else {
        toaster.create({
          title: 'Database Error',
          description: errorMessage,
          type: 'error',
          duration: 5000,
        })
      }
    }
  }, [error])

  const handleRowSelectionChange = (row: any) => {
    console.log('DataGridContainer: Row selection changed', row)
    setSelectedRow(row)
  }

  const handleAddRow = async () => {
    console.log('DataGridContainer: handleAddRow called')
    console.log('DataGridContainer: selectedDatabaseTable', selectedDatabaseTable)
    console.log('DataGridContainer: selectedDatabaseFile', selectedDatabaseFile)
    console.log('DataGridContainer: selectedDevice', selectedDevice)
    console.log('DataGridContainer: selectedApplication', selectedApplication)

    if (!selectedDatabaseTable) {
      console.log('DataGridContainer: No table selected')
      toaster.create({
        title: 'No table selected',
        type: 'error',
        duration: 3000,
      })
      return
    }

    if (!selectedDatabaseFile && !selectedDevice) {
      console.log('DataGridContainer: No database file or device selected')
      toaster.create({
        title: 'No database file or device selected',
        type: 'error',
        duration: 3000,
      })
      return
    }

    setIsAddingRow(true)

    try {
      // For custom files, extract context from file path
      if (selectedDatabaseFile && !selectedDevice) {
        console.log('DataGridContainer: Using custom file context')
        const fileName = selectedDatabaseFile.path.split('/').pop()?.replace('.db', '') || 'unknown'
        console.log('DataGridContainer: Extracted context:', fileName)
      }

      console.log('DataGridContainer: Calling addNewRowWithDefaults with params:', {
        tableName: selectedDatabaseTable.name,
        databasePath: selectedDatabaseFile?.path,
        deviceId: selectedDevice?.id,
        deviceName: selectedDevice?.name,
        deviceType: selectedDevice?.deviceType,
        bundleId: selectedApplication?.bundleId,
        appName: selectedApplication?.name,
      })

      const result = await window.api.addNewRowWithDefaults(
        selectedDatabaseTable.name,
        selectedDatabaseFile?.path,
        selectedDevice?.id,
        selectedDevice?.name,
        selectedDevice?.deviceType,
        selectedApplication?.bundleId,
        selectedApplication?.name,
      )

      console.log('DataGridContainer: addNewRowWithDefaults result', result)

      if (result.success) {
        toaster.create({
          title: 'Row added successfully',
          type: 'success',
          duration: 3000,
        })
        await refreshChangeHistory()
        await refetch()
      }
      else {
        toaster.create({
          title: 'Failed to add row',
          description: result.error || 'Unknown error occurred',
          type: 'error',
          duration: 3000,
        })
      }
    }
    catch (error) {
      console.error('DataGridContainer: Error adding row:', error)
      const errorMessage = (error as Error).message || String(error)
      
      if (errorMessage.includes('database disk image is malformed') || errorMessage.includes('code: 11')) {
        toaster.create({
          title: 'Database Corrupted',
          description: 'Cannot add row - the database file is corrupted. Please try opening a different database file.',
          type: 'error',
          duration: 10000,
        })
      }
      else if (errorMessage.includes('database is locked')) {
        toaster.create({
          title: 'Database Locked',
          description: 'Cannot add row - the database is locked. Please try again in a moment.',
          type: 'warning',
          duration: 5000,
        })
      }
      else {
        toaster.create({
          title: 'Failed to add row',
          description: errorMessage,
          type: 'error',
          duration: 5000,
        })
      }
    }
    finally {
      setIsAddingRow(false)
    }
  }

  return (
    <DataGridPresenter
      colorMode={colorMode}
      tableData={data}
      isLoadingTableData={isLoading}
      isAddingRow={isAddingRow}
      pageSize={50}
      onRowClick={handleRowSelectionChange}
      onAddRow={handleAddRow}
      onFirstDataRendered={() => {}}
      onPageSizeChange={() => {}}
      hasData={!!data?.rows?.length}
      error={error}
      selectedDatabaseTable={selectedDatabaseTable}
    />
  )
}
