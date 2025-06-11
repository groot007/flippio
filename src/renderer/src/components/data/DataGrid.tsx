import {
  Box,
  Button,
  Center,
  Flex,
  Spinner,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import { useTableDataQuery } from '@renderer/hooks/useTableDataQuery'
import { useCurrentDatabaseSelection, useTableData } from '@renderer/store'
import { useRowEditingStore } from '@renderer/store/useRowEditingStore'
import { useColorMode } from '@renderer/ui/color-mode'
import { colorSchemeDark, colorSchemeLight, themeQuartz } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { LuPlus } from 'react-icons/lu'
import { AddNewRowModal } from './AddNewRowModal'

export function CustomHeaderComponent(props: any) {
  return (
    <Box display="flex" alignItems="center" height="100%" padding="0 2px">
      <Text fontWeight="medium" fontSize="14px">{props.displayName}</Text>
      <Text fontSize="10px" color="gray.500" ml={1}>
        (
        {props.columnType?.toLowerCase()}
        )
      </Text>
    </Box>
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
  const { selectedDatabaseTable } = useCurrentDatabaseSelection()
  const gridTheme = themeQuartz.withPart(colorMode === 'dark' ? colorSchemeDark : colorSchemeLight)
  const gridRef = useRef<AgGridReact>(null)
  const { open, onOpen, onClose } = useDisclosure()

  const { data, error, refetch: refetchTableData } = useTableDataQuery(selectedDatabaseTable?.name || '')

  console.log('DataGrid rendered with data:', data)

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
      headerComponent: CustomHeaderComponent,
      headerComponentParams: {
        displayName: col.name,
        columnType: col.data_type,
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
    setSelectedRow({
      rowData: event.data,
    })
  }, [setSelectedRow])

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
          refetchTableData()
        }}
      />
    </Box>
  )
}
