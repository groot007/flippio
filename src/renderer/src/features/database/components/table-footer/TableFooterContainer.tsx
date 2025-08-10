import type { TableFooterProps } from './types'

import { useClearTableMutation } from '@renderer/features/database/hooks'

import { useCurrentDatabaseSelection, useRowEditingStore } from '@renderer/features/database/stores'
import { useCurrentDeviceSelection } from '@renderer/features/devices/stores'
import { ClearTableDialog } from '@renderer/features/layout/components/side-panel/components'
import { useColorMode } from '@renderer/ui/color-mode'

import { useCallback, useEffect, useState } from 'react'
import { TableFooterPresenter } from './TableFooterPresenter'

/**
 * TableFooterContainer - Business logic container for table footer
 * 
 * Manages pagination state, table operations, and clear table functionality.
 * Delegates UI rendering to TableFooterPresenter.
 */
export const TableFooterContainer: React.FC<TableFooterProps> = ({ 
  gridRef, 
  totalRows, 
  onPageSizeChange,
}) => {
  const { colorMode } = useColorMode()
  const { setSelectedRow } = useRowEditingStore()
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const { selectedDevice, selectedApplication } = useCurrentDeviceSelection()
  const { selectedDatabaseFile, selectedDatabaseTable } = useCurrentDatabaseSelection()
  const [isClearTableDialogOpen, setIsClearTableDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Update pagination info when AG Grid pagination changes
  useEffect(() => {
    const handlePaginationChanged = () => {
      if (gridRef.current?.api) {
        const api = gridRef.current.api
        const newCurrentPage = api.paginationGetCurrentPage() + 1 // AG Grid uses 0-based indexing
        const newPageSize = api.paginationGetPageSize()
        const newTotalPages = api.paginationGetTotalPages()
        
        setCurrentPage(newCurrentPage)
        setPageSize(newPageSize)
        setTotalPages(newTotalPages)
      }
    }

    if (gridRef.current?.api) {
      const api = gridRef.current.api
      
      // Initial sync
      handlePaginationChanged()
      
      // Listen for pagination changes
      api.addEventListener('paginationChanged', handlePaginationChanged)
      
      return () => {
        if (gridRef.current?.api) {
          gridRef.current.api.removeEventListener('paginationChanged', handlePaginationChanged)
        }
      }
    }
    
    // Return undefined if no cleanup needed
    return undefined
  }, [gridRef, totalRows])

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    if (onPageSizeChange) {
      onPageSizeChange(newPageSize)
    }
  }, [onPageSizeChange])

  const handlePageChange = useCallback((page: number) => {
    if (gridRef.current?.api) {
      gridRef.current.api.paginationGoToPage(page - 1) // AG Grid uses 0-based indexing
      // Current page will be automatically updated through the event listener
    }
  }, [gridRef])

  const clearTableMutation = useClearTableMutation()

  const handleClearTable = useCallback(async () => {
    if (gridRef.current?.api) {
      setIsLoading(true)
      const api = gridRef.current.api
      api.setFilterModel(null)
      api.deselectAll()
      api.applyColumnState({ defaultState: { sort: null } })
      
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
    }
  }, [gridRef, setSelectedRow, selectedApplication, selectedDatabaseFile, selectedDatabaseTable, selectedDevice, clearTableMutation])

  const handleOpenClearTableDialog = useCallback(() => {
    setIsClearTableDialogOpen(true)
  }, [])

  const getDisplayedRowRange = useCallback(() => {
    if (totalRows === 0) 
      return '0 to 0 of 0'
    
    const startRow = (currentPage - 1) * pageSize + 1
    const endRow = Math.min(currentPage * pageSize, totalRows)
    return `${startRow} to ${endRow} of ${totalRows}`
  }, [currentPage, pageSize, totalRows])

  return (
    <>
      <TableFooterPresenter
        colorMode={colorMode}
        pageSize={pageSize}
        currentPage={currentPage}
        totalPages={totalPages}
        _totalRows={totalRows}
        isLoading={isLoading}
        selectedTableName={selectedDatabaseTable?.name}
        onPageSizeChange={handlePageSizeChange}
        onPageChange={handlePageChange}
        onOpenClearTableDialog={handleOpenClearTableDialog}
        getDisplayedRowRange={getDisplayedRowRange}
      />
      <ClearTableDialog
        isOpen={isClearTableDialogOpen}
        onClose={() => setIsClearTableDialogOpen(false)}
        onClear={handleClearTable}
        isLoading={isLoading}
      />
    </>
  )
}
