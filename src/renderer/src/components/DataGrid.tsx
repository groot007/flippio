import {
  Box,
  Button,
  Center,
  Flex,
  Input,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection, useTableData } from '@renderer/store'
import { useRowEditingStore } from '@renderer/store/useRowEditingStore'
import { useColorMode } from '@renderer/ui/color-mode'
import { toaster } from '@renderer/ui/toaster'
import { colorSchemeDark, colorSchemeLight, themeQuartz } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LuPlus } from 'react-icons/lu'
import FLModal from './FLModal'

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
  const { selectedDevice } = useCurrentDeviceSelection()
  const { selectedDatabaseFile, pulledDatabaseFilePath } = useCurrentDatabaseSelection()
  const [error, setError] = useState<string | null>(null)
  const gridTheme = themeQuartz.withPart(colorMode === 'dark' ? colorSchemeDark : colorSchemeLight)
  const gridRef = useRef<AgGridReact>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newRowData, setNewRowData] = useState<Record<string, any>>({})

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

  // Effect to fetch data when table selection changes
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
    // Return different styles for even and odd rows
    return params.node.rowIndex % 2 === 0
      ? { backgroundColor: colorMode === 'dark' ? '#1A202C' : '#FFFFFF' } // even rows
      : { backgroundColor: colorMode === 'dark' ? '#121212' : '#F7FAFC' } // odd rows
  }, [colorMode])

  // Initialize new row data with empty values for each column
  const initializeNewRowData = useCallback(() => {
    if (!tableData?.columns)
      return

    const initialData: Record<string, any> = {}
    tableData.columns.forEach((col) => {
      // Set default values based on column type
      switch (col.type.toLowerCase()) {
        case 'integer':
        case 'int':
        case 'numeric':
          initialData[col.name] = null
          break
        case 'text':
        case 'varchar':
        case 'char':
          initialData[col.name] = ''
          break
        case 'boolean':
          initialData[col.name] = false
          break
        case 'real':
        case 'float':
        case 'double':
          initialData[col.name] = null
          break
        case 'blob':
          initialData[col.name] = null
          break
        case 'date':
        case 'datetime':
        case 'timestamp':
          initialData[col.name] = ''
          break
        default:
          initialData[col.name] = ''
      }
    })

    setNewRowData(initialData)
  }, [tableData?.columns])

  // Handle opening the new row modal
  const handleOpenNewRowModal = useCallback(() => {
    initializeNewRowData()
    setIsModalOpen(true)
  }, [initializeNewRowData])

  // Handle input change for new row form
  const handleNewRowInputChange = useCallback((columnName: string, value: any) => {
    setNewRowData(prev => ({
      ...prev,
      [columnName]: value,
    }))
  }, [])

  // Create a new row
  const handleCreateRow = useCallback(async () => {
    if (!selectedDatabaseTable?.name)
      return

    try {
      // Call the API to insert the new row
      const result = await window.api.insertTableRow(selectedDatabaseTable.name, newRowData)

      if (!result.success) {
        throw new Error(result.error || 'Failed to create new row')
      }

      // Push changes back to device if needed
      if (selectedDatabaseFile && selectedDevice && selectedDatabaseFile.packageName && selectedDatabaseFile?.deviceType !== 'iphone') {
        await window.api.pushDatabaseFile(
          selectedDevice.id,
          pulledDatabaseFilePath,
          selectedDatabaseFile.packageName,
          selectedDatabaseFile.path,
        )
      }

      // Show success message
      toaster.create({
        title: 'Row created',
        description: 'New row has been successfully created',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })

      // Refresh table data to show the new row
      if (selectedDatabaseTable?.name) {
        fetchTableData(selectedDatabaseTable.name)
      }

      // Close modal and reset form
      setNewRowData({})
    }
    catch (error) {
      console.error('Error creating row:', error)
      toaster.create({
        title: 'Creation failed',
        description: error instanceof Error ? error.message : 'Failed to create new row',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }, [selectedDatabaseTable, newRowData, selectedDatabaseFile, selectedDevice, pulledDatabaseFilePath, fetchTableData])

  const rowsData = selectedDatabaseTable ? tableData?.rows : []

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
          rowData={rowsData}
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

      {/* Add New Row Button */}
      {selectedDatabaseTable && (
        <Button

          aria-label="Add new row"
          colorScheme="teal"
          title="+"
          size="lg"
          position="absolute"
          bottom="12"
          right="6"
          boxShadow="lg"
          borderRadius="full"
          p={0}
          onClick={handleOpenNewRowModal}
          bg="flipioPrimary"
          _hover={{ transform: 'scale(1.05)' }}
          transition="all 0.2s"
        >
          <LuPlus size={20} />
        </Button>

      )}
      <FLModal
        isOpen={isModalOpen}
        body={(
          <VStack gap={4} align="stretch">
            {tableData?.columns?.map(column => (
              <>
                {column.name}
                {' '}
                <Text as="span" fontSize="xs" color="gray.500">
                  (
                  {column.type}
                  )
                </Text>
                <Input
                  value={newRowData[column.name] || ''}
                  onChange={e => handleNewRowInputChange(column.name, e.target.value)}
                  placeholder={`Enter value for ${column.name}`}
                />
              </>
            ))}
          </VStack>
        )}
        title="Add New Row"
        acceptBtn="Create"
        onAccept={() => {
          handleCreateRow()
          setIsModalOpen(false)
        }}
        rejectBtn="Cancel"
        onReject={() => {
          setIsModalOpen(false)
        }}
      />
    </Box>
  )
}
