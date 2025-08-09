import {
  Box,
  Button,
  Center,
  Flex,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react'
import { useChangeHistoryRefresh } from '@renderer/hooks/useChangeHistory'
import { useTableDataQuery } from '@renderer/hooks/useTableDataQuery'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection, useTableData } from '@renderer/store'
import { useRowEditingStore } from '@renderer/store/useRowEditingStore'
import { useColorMode } from '@renderer/ui/color-mode'
import { toaster } from '@renderer/ui/toaster'
import { extractContextFromState } from '@renderer/utils/contextKey'
import { colorSchemeDark, colorSchemeLight, themeQuartz } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LuPlus } from 'react-icons/lu'
import { TableFooter } from './TableFooter'

export function CustomHeaderComponent(props: any) {
  return (
    <VStack display="flex" alignItems="center" justifyContent="center" gap={0}>
      <Text fontWeight="medium" fontSize="14px">{props.displayName}</Text>
      <Text fontSize="10px" color="gray.500" mt={0}>
        (
        {props.columnType?.toLowerCase()}
        )
      </Text>
    </VStack>
  )
}

export function DataGrid() {
  const { colorMode } = useColorMode()
  const {
    isLoadingTableData,
    setIsLoadingTableData,
    tableData,
    setTableData,
  } = useTableData()
  const { setSelectedRow } = useRowEditingStore()
  const { selectedDatabaseTable, selectedDatabaseFile } = useCurrentDatabaseSelection()
  const { selectedDevice, selectedApplication } = useCurrentDeviceSelection()
  const { refreshChangeHistory } = useChangeHistoryRefresh()
  const gridTheme = themeQuartz.withPart(colorMode === 'dark' ? colorSchemeDark : colorSchemeLight)
  const gridRef = useRef<AgGridReact>(null)
  const [isAddingRow, setIsAddingRow] = useState(false)
  const [pageSize, setPageSize] = useState(20)

  const { data, error, refetch: refetchTableData } = useTableDataQuery(selectedDatabaseTable?.name || '')

  // Function to create a new row with null values
  const handleAddNewRow = useCallback(async () => {
    if (!selectedDatabaseTable?.name || isAddingRow)
      return

    try {
      setIsAddingRow(true)

      // Extract context for change history
      const context = extractContextFromState(selectedDevice, selectedApplication, selectedDatabaseFile)

      // Use the new addNewRowWithDefaults method to let SQLite handle default values
      const result = await window.api.addNewRowWithDefaults(
        selectedDatabaseTable.name, 
        selectedDatabaseFile?.path,
        context.deviceId,
        context.deviceName,
        context.deviceType,
        context.packageName,
        context.appName,
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to create new row')
      }

      // Push changes back to device if needed
      if (
        selectedDatabaseFile
        && selectedDevice
        && selectedDatabaseFile.packageName
        && (selectedDatabaseFile?.deviceType === 'android'
          || selectedDatabaseFile?.deviceType === 'iphone'
          || selectedDatabaseFile?.deviceType === 'iphone-device'
          || selectedDatabaseFile?.deviceType === 'simulator')
      ) {
        await window.api.pushDatabaseFile(
          selectedDevice.id,
          selectedDatabaseFile.path,
          selectedDatabaseFile.packageName,
          selectedDatabaseFile.remotePath || selectedDatabaseFile.path,
          selectedDatabaseFile.deviceType,
        )
      }

      // Refresh the table data and change history
      refetchTableData()
      refreshChangeHistory()

      toaster.create({
        title: 'Row created',
        description: 'New row has been successfully created with default values',
        type: 'success',
        duration: 3000,
      })
    }
    catch (error: any) {
      toaster.create({
        title: 'Error',
        description: error.message || 'Failed to create new row',
        type: 'error',
        duration: 5000,
      })
    }
    finally {
      setIsAddingRow(false)
    }
  }, [selectedDatabaseTable, tableData?.columns, isAddingRow, selectedDatabaseFile, selectedDevice, refetchTableData])

  useEffect(() => {
    // Only update table data from the query hook if it's not a custom query
    if (data && !tableData?.isCustomQuery) {
      setTableData({
        rows: data.rows,
        columns: data.columns,
        isCustomQuery: false,
        tableName: selectedDatabaseTable?.name,
      })
      setIsLoadingTableData(false)
    }
    else if (!data && !tableData?.isCustomQuery) {
      setTableData({
        rows: [],
        columns: [],
        isCustomQuery: false,
        tableName: selectedDatabaseTable?.name,
      })
      setIsLoadingTableData(false)
    }
  }, [data, selectedDatabaseTable, tableData?.isCustomQuery, setTableData, setIsLoadingTableData])

  // Sync with AG Grid pagination events
  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.addEventListener('paginationChanged', () => {
        // Pagination state is now handled by the TableFooter component
      })
    }
  }, [tableData])

  const columnDefs = useMemo(() => {
    if (!tableData?.columns?.length)
      return []

    return tableData.columns?.map(col => ({
      field: col.name,
      // headerComponent: CustomHeaderComponent,
      headerComponentParams: {
        displayName: col.name,
        columnType: col.type,
      },
      sortable: true,
      filter: true,
      resizable: true,
      editable: true,

      tooltipValueGetter: params => params.value,
    }))
  }, [tableData?.columns])

  const defaultColDef = useMemo(() => ({
    filter: true,
  }), [])

  const onRowClicked = useCallback((event: Record<string, any>) => {
    setSelectedRow({
      rowData: event.data,
      columnInfo: tableData?.columns || [],
    })
  }, [setSelectedRow, tableData?.columns])

  const getRowStyle = useCallback((params) => {
    const mainStyle = {
      fontSize: '12px',
    }

    const bg = params.node.rowIndex % 2 === 0
      ? { backgroundColor: colorMode === 'dark' ? '#1A202C' : '#FFFFFF' }
      : { backgroundColor: colorMode === 'dark' ? '#121212' : '#F7FAFC' }

    return { ...mainStyle, ...bg }
  }, [colorMode])

  const totalRows = tableData?.rows?.length || 0
  
  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize)
  }, [])

  const columnsSizing = useCallback((params) => {
    const allColIds = params.api.getColumns()?.map(col => col.getColId()) || []

    allColIds.forEach((colId) => {
      const column = params.api.getColumn(colId)
      if (column) {
        const rowData = []
        params.api.forEachNodeAfterFilterAndSort((node) => {
          const value = node.data[colId]
          if (value !== null && value !== undefined) {
            rowData.push(String(value))
          }
        })
    
        const headerWidth = colId.length * 8 + 60 
      
        const maxContentLength = rowData.length > 0 
          ? Math.max(...rowData.map(content => content.length))
          : 0
        const contentWidth = maxContentLength * 8 + 20
      
        const calculatedWidth = Math.min(Math.max(headerWidth, contentWidth), 300)
            
        params.api.setColumnWidths([{ key: colId, newWidth: calculatedWidth }])
      }
    })
  }, [])

  useEffect(() => {
    if (gridRef.current?.api && tableData?.rows?.length) {
      const timeoutId = setTimeout(() => {
        if (gridRef.current?.api) {
          columnsSizing({ api: gridRef.current.api })
        }
      }, 0)

      return () => clearTimeout(timeoutId)
    }
  }, [tableData?.rows, tableData?.columns, columnsSizing])

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
        <Text color="gray.500">{String(error)}</Text>
      </Center>
    )
  }

  return (
    <Box flex={1} height="full" width="full" position="relative">
      <Box
        height="calc(100% - 50px)"
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
          paginationPageSize={pageSize}
          loading={false}
          suppressCellFocus={false}
          onFirstDataRendered={columnsSizing}
        />
      </Box>

      <TableFooter 
        gridRef={gridRef}
        totalRows={totalRows}
        onPageSizeChange={handlePageSizeChange}
      />

      {selectedDatabaseTable && (
        <Button
          aria-label="Add new row"
          size="lg"
          position="absolute"
          bottom="16" // Adjusted for the bottom panel
          right="6"
          backgroundColor="flipioPrimary"
          boxShadow="lg"
          borderRadius="full"
          p={0}
          onClick={handleAddNewRow}
          loading={isAddingRow}
          _hover={{ transform: 'scale(1.05)' }}
          transition="all 0.2s"
        >
          <LuPlus size={24} />
        </Button>
      )}
    </Box>
  )
}
