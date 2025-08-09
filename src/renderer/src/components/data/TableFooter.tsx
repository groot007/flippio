import type { AgGridReact } from 'ag-grid-react'
import {
  Box,
  Button,
  Flex,
  Text,
} from '@chakra-ui/react'
import FLSelect from '@renderer/components/common/FLSelect'
import { useRowEditingStore } from '@renderer/store/useRowEditingStore'
import { useColorMode } from '@renderer/ui/color-mode'
import { useCallback, useEffect, useState } from 'react'
import { LuChevronLeft, LuChevronRight, LuTrash2 } from 'react-icons/lu'
import { useClearTableMutation } from '@/hooks/useTableMutations'
import { useCurrentDatabaseSelection } from '@/store/useCurrentDatabaseSelection'
import { useCurrentDeviceSelection } from '@/store/useCurrentDeviceSelection'
import { ChangeHistoryIndicator } from '../ChangeHistory'
import { ClearTableDialog } from '../SidePanel/ClearTableDialog'

interface TableFooterProps {
  gridRef: React.RefObject<AgGridReact>
  totalRows: number
  onPageSizeChange?: (pageSize: number) => void
}

export function TableFooter({ gridRef, totalRows, onPageSizeChange }: TableFooterProps) {
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

  const getDisplayedRowRange = () => {
    if (totalRows === 0) 
      return '0 to 0 of 0'
    
    const startRow = (currentPage - 1) * pageSize + 1
    const endRow = Math.min(currentPage * pageSize, totalRows)
    return `${startRow} to ${endRow} of ${totalRows}`
  }

  return (
    <Box
      height="50px"
      borderTop="1px solid"
      borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
      bg={colorMode === 'dark' ? 'gray.800' : 'gray.50'}
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      px={4}
      py={2}
    >
      {/* Left side controls */}
      <Flex alignItems="center" gap={2}>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleOpenClearTableDialog}
          title="Clear table"
          disabled={!selectedDatabaseTable?.name || isLoading}
          _hover={{ bg: colorMode === 'dark' ? 'gray.700' : 'gray.100' }}
        >
          <LuTrash2 color="flipioAccent.purple" />
        </Button>
      </Flex>

      <Flex alignItems="center" gap={2} marginLeft={6}>
        <ChangeHistoryIndicator />
      </Flex>

      {/* Center pagination controls */}
      <Flex alignItems="center" gap={4} marginLeft="auto">
        <Flex alignItems="center" gap={2}>
          <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.300' : 'gray.600'}>
            Page Size:
          </Text>
          <FLSelect
            variant="small"
            label="Page Size"
            options={[
              { label: '10', value: '10' },
              { label: '20', value: '20' },
              { label: '50', value: '50' },
              { label: '100', value: '100' },
            ]}
            value={{ label: pageSize.toString(), value: pageSize.toString() }}
            onChange={selected => handlePageSizeChange(Number(selected.value))}
            width="80px"
            searchable={false}
            placeholder="Select page size"
          />
        </Flex>

        <Flex alignItems="center">
         
          <Button
            size="xs"
            w={5}
            variant="ghost"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            _hover={{ bg: colorMode === 'dark' ? 'gray.700' : 'gray.100' }}
          >
            <LuChevronLeft size={12} />
          </Button>

          <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.300' : 'gray.600'} mx={2}>
            {getDisplayedRowRange()}
          </Text>

          <Button
            size="xs"
            w={5}
            variant="ghost"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
            _hover={{ bg: colorMode === 'dark' ? 'gray.700' : 'gray.100' }}
          >
            <LuChevronRight size={12} />
          </Button>
        </Flex>

        <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.300' : 'gray.600'}>
          Page 
          {' '}
          {currentPage}
          {' '}
          of 
          {' '}
          {totalPages || 1}
        </Text>
      </Flex>
      <ClearTableDialog
        isOpen={isClearTableDialogOpen}
        onClose={() => setIsClearTableDialogOpen(false)}
        onClear={handleClearTable}
        isLoading={isLoading}
      />
    </Box>
  )
}
