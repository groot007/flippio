import {
  Box,
  Center,
  Flex,
  Spinner,
  Text,
} from '@chakra-ui/react'
import { useCurrentDatabaseSelection, useTableData } from '@renderer/store'
import { useRowEditingStore } from '@renderer/store/useRowEditingStore'
import { useColorMode } from '@renderer/ui/color-mode'
import { colorSchemeDark, colorSchemeLight, themeQuartz } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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

  const fetchTableData = useCallback(async (tableName: string) => {
    // setIsLoadingTableData(true)
    setError(null)

    try {
      const response = await window.api.getTableInfo(tableName)

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch table data')
      }

      if (response.columns && response.rows) {
        setTableData({
          columns: response.columns.map((col: { name: string }) => col.name),
          rows: [...response.rows, ...response.rows, ...response.rows, ...response.rows, ...response.rows],
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

  // Effect to fetch data when table selection changes
  useEffect(() => {
    console.log("selectedDatabaseTable", selectedDatabaseTable)
    if (selectedDatabaseTable?.name) {
      fetchTableData(selectedDatabaseTable.name)
    }
  }, [selectedDatabaseTable, fetchTableData, selectedRow])

  const columnDefs = useMemo(() => {
    if (!tableData?.columns?.length)
      return []

    return tableData.columns?.map(col => ({
      field: col,
      headerName: col,
      sortable: true,
      filter: true,
      resizable: true,
      editable: true,
      tooltipValueGetter: params => params.value,
    }))
  }, [tableData?.columns])

  const defaultColDef = useMemo(() => ({
    flex: 1,
    minWidth: 100,
    filter: true,
  }), [])

  const onRowClicked = useCallback((event: Record<string, any>) => {
    setSelectedRow({
      rowData: event.data,
    })
  }, [setSelectedRow])

  const rowsData = selectedDatabaseTable ? tableData?.rows : []

  if (isLoadingTableData) {
    return (
      <Flex
        justifyContent="center"
        alignItems="center"
        height="calc(100vh - 140px)"
      >
        <Spinner size="xl" color="blue.500" />
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
    <Box flex={1} height="full" width="full">
      <Box
        height="100%"
        width="100%"
      >
        <AgGridReact
          ref={gridRef}
          rowData={rowsData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          animateRows={true}
          theme={gridTheme}
          rowSelection="single"
          onRowClicked={onRowClicked}
          pagination={true}
          paginationPageSize={20}
          suppressCellFocus={false}
        />
      </Box>

    </Box>
  )
}
