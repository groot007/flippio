import {
  Box,
  Flex,
  Spinner,
} from '@chakra-ui/react'
import { useCurrentDatabaseSelection, useTableData } from '@renderer/store'
import { useRowEditingStore } from '@renderer/store/useRowEditingStore'
import { useColorMode } from '@renderer/ui/color-mode'
import { colorSchemeDark, colorSchemeLight, themeQuartz } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { SidePanel } from './SidePanel'

export function DataGrid() {
  const { colorMode } = useColorMode()
  const {
    isLoadingTableData,
    setIsLoadingTableData,
    tableData,
    setTableData,
  } = useTableData()

  const { setSelectedRow } = useRowEditingStore()

  const { selectedDatabaseTable } = useCurrentDatabaseSelection()

  const myTheme = themeQuartz.withPart(colorMode === 'dark' ? colorSchemeDark : colorSchemeLight)

  const gridRef = useRef<AgGridReact>(null)

  const getDatabaseInfo = useCallback(async (tableName) => {
    try {
      // setIsLoadingTableData(true)
      const response = await window.api.getTableInfo(tableName)
      if (response && response.columns && response.rows) {
        setTableData({
          columns: response.columns.map((col: any) => col.name),
          rows: response.rows,
        })
      }
    }
    catch (error) {
      console.error('Error fetching table data:', error)
    }
    finally {
      setIsLoadingTableData(false)
    }
  }, [setIsLoadingTableData])

  useEffect(() => {
    if (!isLoadingTableData && selectedDatabaseTable && gridRef.current) {
      getDatabaseInfo(selectedDatabaseTable.name)
    }
  }, [isLoadingTableData, selectedDatabaseTable])

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

  const onRowClicked = useCallback((event: any) => {
    setSelectedRow({
      rowData: event.data,
    })
  }, [setSelectedRow])

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

  const rowsData = selectedDatabaseTable ? tableData?.rows : []
  return (
    <Box flex={1} height="full" width="full">
      <Box
        className={colorMode === 'dark' ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'}
        height="100%"
        width="100%"
      >
        <AgGridReact
          ref={gridRef}
          rowData={rowsData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          animateRows={true}
          theme={myTheme}
          rowSelection="single"
          onRowClicked={onRowClicked}
          pagination={true}
          paginationPageSize={10}
          suppressCellFocus={false}
        />
      </Box>

      <SidePanel />
    </Box>
  )
}
