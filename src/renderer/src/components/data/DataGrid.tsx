import {
  Box,
  Button,
  Center,
  Flex,
  Spinner,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import { useCurrentDatabaseSelection, useTableData } from '@renderer/store'
import { useRowEditingStore } from '@renderer/store/useRowEditingStore'
import { useColorMode } from '@renderer/ui/color-mode'
import { colorSchemeDark, colorSchemeLight, themeQuartz } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LuPlus } from 'react-icons/lu'
import { AddNewRowModal } from './AddNewRowModal'

export function DataGrid() {
  const { colorMode } = useColorMode()
  const {
    isLoadingTableData,
    setIsLoadingTableData,
    tableData,
    setTableData,
  } = useTableData()
  const { setSelectedRow, selectedRow } = useRowEditingStore()
  const { selectedDatabaseTable } = useCurrentDatabaseSelection()
  const [error, setError] = useState<string | null>(null)
  const gridTheme = themeQuartz.withPart(colorMode === 'dark' ? colorSchemeDark : colorSchemeLight)
  const gridRef = useRef<AgGridReact>(null)
  const { open, onOpen, onClose } = useDisclosure()

  const fetchTableData = useCallback(async (tableName: string) => {
    setError(null)

    try {
      const response = await window.api.getTableInfo(tableName)

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch table data')
      }

      if (response.columns && response.rows) {
        setTableData({
          columns: response.columns,
          rows: response.rows,
        })
      }
      else {
        throw new Error('Invalid data structure received')
      }
    }
    catch (error) {
      console.error('Error fetching table data:', error)
      setError(error instanceof Error ? error.message : 'Unknown error occurred')
      setTableData({ columns: [], rows: [] })
    }
    finally {
      setIsLoadingTableData(false)
    }
  }, [setIsLoadingTableData, setTableData])

  useEffect(() => {
    if (selectedDatabaseTable?.name) {
      fetchTableData(selectedDatabaseTable.name)
    }
    else {
      setTableData({ columns: [], rows: [] })
    }
  }, [selectedDatabaseTable, fetchTableData, selectedRow])

  const columnDefs = useMemo(() => {
    if (!tableData?.columns?.length)
      return []

    return tableData.columns?.map(col => ({
      field: col.name,
      headerName: `${col.name} (${col.type})`,
      sortable: true,
      filter: true,
      resizable: true,
      editable: true,
      tooltipValueGetter: params => params.value,
    }))
  }, [tableData?.columns])

  const defaultColDef = useMemo(() => ({
    filter: true,
    flex: 1,
  }), [])

  const onRowClicked = useCallback((event: Record<string, any>) => {
    setSelectedRow({
      rowData: event.data,
    })
  }, [setSelectedRow])

  const getRowStyle = useCallback((params) => {
    return params.node.rowIndex % 2 === 0
      ? { backgroundColor: colorMode === 'dark' ? '#1A202C' : '#FFFFFF' }
      : { backgroundColor: colorMode === 'dark' ? '#121212' : '#F7FAFC' }
  }, [colorMode])

  if (isLoadingTableData) {
    return (
      <Flex
        justifyContent="center"
        alignItems="center"
        height="calc(100vh - 140px)"
      >
        <Spinner size="xl" color="flipioPrimary" />
      </Flex>
    )
  }

  if (error) {
    return (
      <Center height="calc(100vh - 140px)" flexDirection="column">
        <Text fontSize="xl" mb={4} color="red.500">Error loading data</Text>
        <Text color="gray.500">{error}</Text>
      </Center>
    )
  }

  return (
    <Box flex={1} height="full" width="full" position="relative">
      <Box
        height="100%"
        width="100%"
        onDragOver={e => e.preventDefault()}
      >
        <AgGridReact
          ref={gridRef}
          rowData={tableData?.rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          animateRows={true}
          theme={gridTheme}
          getRowStyle={getRowStyle}
          rowSelection="single"
          onRowClicked={onRowClicked}
          pagination={true}
          paginationPageSize={20}
          suppressCellFocus={false}
        />
      </Box>

      {selectedDatabaseTable && (
        <Button
          aria-label="Add new row"
          size="lg"
          position="absolute"
          bottom="12"
          right="6"
          backgroundColor="flipioPrimary"
          boxShadow="lg"
          borderRadius="full"
          p={0}
          onClick={onOpen}
          _hover={{ transform: 'scale(1.05)' }}
          transition="all 0.2s"
        >
          <LuPlus size={24} />
        </Button>
      )}

      <AddNewRowModal
        isOpen={open}
        onClose={onClose}
        onRowCreated={() => {
          if (selectedDatabaseTable?.name) {
            fetchTableData(selectedDatabaseTable.name)
          }
        }}
      />
    </Box>
  )
}
