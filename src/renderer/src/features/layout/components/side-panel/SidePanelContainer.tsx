import { useClearTableMutation, useDeleteRowMutation } from '@renderer/features/database/hooks'
import { useCurrentDatabaseSelection, useRowEditingStore, useTableData } from '@renderer/features/database/stores'
import { useCurrentDeviceSelection } from '@renderer/features/devices/stores'
import { useColorMode } from '@renderer/ui/color-mode'
import { useCallback, useState } from 'react'

import { SidePanelPresenter } from './SidePanelPresenter'

export function SidePanelContainer() {
  const { colorMode } = useColorMode()
  const isDark = colorMode === 'dark'
  const { selectedRow, setSelectedRow } = useRowEditingStore()
  const isOpen = !!selectedRow
  const { selectedDevice, selectedApplication } = useCurrentDeviceSelection()
  const { selectedDatabaseFile, selectedDatabaseTable } = useCurrentDatabaseSelection()
  const tableData = useTableData(state => state.tableData)
  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedData, setEditedData] = useState<Record<string, any>>({})
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isClearTableDialogOpen, setIsClearTableDialogOpen] = useState(false)

  const closePanel = useCallback(() => {
    setSelectedRow(null)
    setIsEditing(false)
  }, [setSelectedRow])

  const clearTableMutation = useClearTableMutation()

  const handleClearTable = useCallback(async () => {
    if (!selectedDatabaseTable) 
      return

    setIsLoading(true)
    try {
      await clearTableMutation.mutateAsync({
        selectedDatabaseTable,
        selectedDatabaseFile,
        selectedDevice,
        selectedApplication,
      })
    }
    catch (error) {
      console.error('Failed to clear table:', error)
    }
    finally {
      setIsLoading(false)
      setIsClearTableDialogOpen(false)
    }
  }, [
    selectedDatabaseTable,
    selectedDatabaseFile,
    selectedDevice,
    selectedApplication,
    clearTableMutation,
  ])

  const deleteRowMutation = useDeleteRowMutation()

  const handleDeleteRow = useCallback(async () => {
    if (!selectedRow || !selectedDatabaseTable) 
      return

    setIsLoading(true)
    try {
      await deleteRowMutation.mutateAsync({
        selectedRow,
        selectedDatabaseTable,
        selectedDatabaseFile,
        selectedDevice,
        selectedApplication,
        tableColumns: tableData?.columns || [],
      })
    }
    catch (error) {
      console.error('Failed to delete row:', error)
    }
    finally {
      setIsLoading(false)
      setIsDeleteDialogOpen(false)
    }
  }, [
    selectedRow,
    selectedDatabaseTable,
    selectedDatabaseFile,
    selectedDevice,
    selectedApplication,
    tableData?.columns,
    deleteRowMutation,
  ])

  const handleFieldChange = useCallback((key: string, value: any) => {
    setEditedData(prev => ({
      ...prev,
      [key]: value,
    }))
  }, [])

  return (
    <SidePanelPresenter
      selectedRow={selectedRow}
      tableData={tableData}
      isOpen={isOpen}
      isDark={isDark}
      isLoading={isLoading}
      isEditing={isEditing}
      editedData={editedData}
      isDeleteDialogOpen={isDeleteDialogOpen}
      isClearTableDialogOpen={isClearTableDialogOpen}
      onClosePanel={closePanel}
      onDeleteRow={handleDeleteRow}
      onClearTable={handleClearTable}
      onDeleteDialogOpen={() => setIsDeleteDialogOpen(true)}
      onDeleteDialogClose={() => setIsDeleteDialogOpen(false)}
      onClearTableDialogOpen={() => setIsClearTableDialogOpen(true)}
      onClearTableDialogClose={() => setIsClearTableDialogOpen(false)}
      onEditingChange={setIsEditing}
      onLoadingChange={setIsLoading}
      onEditedDataChange={setEditedData}
      onFieldChange={handleFieldChange}
    />
  )
}
