import {
  Box,
  Button,
  Center,
  Flex,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react'
import { useTableDataQuery } from '@renderer/hooks/useTableDataQuery'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection, useTableData } from '@renderer/store'
import { useRowEditingStore } from '@renderer/store/useRowEditingStore'
import { useColorMode } from '@renderer/ui/color-mode'
import { toaster } from '@renderer/ui/toaster'
import { colorSchemeDark, colorSchemeLight, themeQuartz } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LuPlus } from 'react-icons/lu'

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
  const { selectedDevice } = useCurrentDeviceSelection()
  const gridTheme = themeQuartz.withPart(colorMode === 'dark' ? colorSchemeDark : colorSchemeLight)
  const gridRef = useRef<AgGridReact>(null)
  const [isAddingRow, setIsAddingRow] = useState(false)

  const { data, error, refetch: refetchTableData } = useTableDataQuery(selectedDatabaseTable?.name || '')

  // Function to create a new row with null values
  const handleAddNewRow = useCallback(async () => {
    if (!selectedDatabaseTable?.name || isAddingRow)
      return

    try {
      setIsAddingRow(true)

      // Use the new addNewRowWithDefaults method to let SQLite handle default values
      const result = await window.api.addNewRowWithDefaults(selectedDatabaseTable.name)

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
          || selectedDatabaseFile?.deviceType === 'iphone-device')
      ) {
        await window.api.pushDatabaseFile(
          selectedDevice.id,
          selectedDatabaseFile.path,
          selectedDatabaseFile.packageName,
          selectedDatabaseFile.remotePath || selectedDatabaseFile.path,
          selectedDatabaseFile.deviceType,
        )
      }

      // Refresh the table data
      refetchTableData()

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
    if (data) {
      setTableData({
        rows: data.rows,
        columns: data.columns,
      })
      setIsLoadingTableData(false)
    }
    else {
      setTableData({
        rows: [],
        columns: [],
      })
      setIsLoadingTableData(false)
    }
  }, [data])

  useEffect(() => {
    if (tableData?.rows?.length) {
      gridRef.current?.api?.autoSizeAllColumns()
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
    maxWidth: 300,
  }), [])

  const onRowClicked = useCallback((event: Record<string, any>) => {
    console.log('Row clicked:', event.data)
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
          loading={false}
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
