import {
  Box,
  Flex,
  Spinner,
} from '@chakra-ui/react'
import { useColorMode } from '@renderer/ui/color-mode'
import { colorSchemeDark, colorSchemeLight, themeQuartz } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { SidePanel } from './SidePanel'

export function DataGrid() {
  const { colorMode } = useColorMode()
  const {
    isLoadingTableData,
    pageSize,
    selectedDatabaseTable,
    setPage,
    selectRow,
    tableData,
    setTableData,
    selectedRow,
    setIsLoadingTableData,
  } = useAppStore()

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

  // Refresh data when the selected table changes
  useEffect(() => {
    if (selectedDatabaseTable) {
      getDatabaseInfo(selectedDatabaseTable.name)
    }
  }, [selectedDatabaseTable])

  // Monitor loading state and refresh data if it changes from true to false
  // This allows the SidePanel to trigger a data refresh
  useEffect(() => {
    if (!isLoadingTableData && selectedDatabaseTable && gridRef.current) {
      // Only refresh if we have a grid and a selected table
      getDatabaseInfo(selectedDatabaseTable.name)
    }
  }, [isLoadingTableData, selectedDatabaseTable])

  // Column definitions
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
      cellStyle: (params) => {
        if (params.value == 0) {
          // mark police cells as red
          return { color: 'blue' }
        }
        if (typeof params.value == 'string' && params.value.startsWith('{"')) {
          // mark police cells as red
          return { color: 'green' }
        }

        return null
      },
      // Special rendering for JSON data
      cellRenderer: (params: any) => {
        const value = params.value
        return value
      },
    }))
  }, [tableData?.columns])

  // Default column definition
  const defaultColDef = useMemo(() => ({
    flex: 1,
    minWidth: 100,
    filter: true,
  }), [])

  // Row click handler
  const onRowClicked = useCallback((event: any) => {
    selectRow(event.data)
  }, [selectRow])

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
          paginationPageSize={pageSize}
          onPaginationChanged={() => {
            if (gridRef.current) {
              setPage(gridRef.current.api.paginationGetCurrentPage())
            }
          }}
          suppressCellFocus={false}
        />
      </Box>

      {/* Side Panel */}
      <SidePanel />
    </Box>
  )
}
