import type { CustomHeaderComponentProps, DataGridPresenterProps } from './types'
import {
  Box,
  Button,
  Center,
  Flex,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react'
import { colorSchemeDark, colorSchemeLight, themeQuartz } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { memo, useRef } from 'react'

import { LuPlus } from 'react-icons/lu'

import { TableFooterContainer } from './table-footer'

/**
 * Custom header component for AG Grid columns - matches original structure
 */
const CustomHeaderComponent = memo(({ displayName, columnType }: CustomHeaderComponentProps) => (
  <VStack display="flex" alignItems="center" justifyContent="center" gap={0}>
    <Text fontWeight="medium" fontSize="14px">{displayName}</Text>
    <Text fontSize="10px" color="gray.500" mt={0}>
      (
      {columnType?.toLowerCase()}
      )
    </Text>
  </VStack>
))

CustomHeaderComponent.displayName = 'CustomHeaderComponent'

/**
 * Presenter component for DataGrid - matches original UI structure
 */
export const DataGridPresenter = memo<DataGridPresenterProps>(({
  colorMode,
  tableData,
  isLoadingTableData,
  isAddingRow,
  pageSize,
  onRowClick,
  onAddRow,
  onFirstDataRendered,
  onPageSizeChange,
  hasData,
  error,
  className,
  selectedDatabaseTable,
}) => {
  const gridTheme = themeQuartz.withPart(colorMode === 'dark' ? colorSchemeDark : colorSchemeLight)
  const gridRef = useRef<AgGridReact>(null)

  const getRowStyle = (params: any) => {
    return params.node.rowIndex % 2 === 0
      ? { backgroundColor: colorMode === 'dark' ? '#2D3748' : '#F7FAFC' }
      : { backgroundColor: colorMode === 'dark' ? '#1A202C' : '#FFFFFF' }
  }

  const columnDefs = tableData?.columns?.map((column: any) => ({
    field: column.name,
    headerName: column.name,
    headerComponent: CustomHeaderComponent,
    headerComponentParams: {
      displayName: column.name,
      columnType: column.type,
    },
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 100,
    flex: 1,
  })) || []

  if (isLoadingTableData) {
    return (
      <Flex
        justifyContent="center"
        alignItems="center"
        height="calc(100vh - 140px)"
        className={className}
      >
        <Spinner size="xl" color="flipioPrimary" />
      </Flex>
    )
  }

  if (error) {
    return (
      <Center height="calc(100vh - 140px)" flexDirection="column" className={className}>
        <Text fontSize="xl" mb={4} color="red.500">Error loading data</Text>
        <Text color="gray.500">{error.message || 'An unknown error occurred'}</Text>
      </Center>
    )
  }

  return (
    <Box flex={1} height="full" width="full" position="relative" className={className}>
      <Box
        height="calc(100% - 50px)"
        width="100%"
        onDragOver={e => e.preventDefault()}
      >
        <AgGridReact
          ref={gridRef}
          rowData={tableData?.rows || []}
          columnDefs={columnDefs}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
            minWidth: 100,
            flex: 1,
          }}
          animateRows={true}
          theme={gridTheme}
          getRowStyle={getRowStyle}
          rowSelection="single"
          onRowClicked={onRowClick}
          pagination={true}
          paginationPageSize={pageSize}
          loading={false}
          suppressCellFocus={false}
          onFirstDataRendered={onFirstDataRendered}
        />
      </Box>

      <TableFooterContainer
        gridRef={gridRef}
        totalRows={tableData?.rows?.length || 0}
        onPageSizeChange={onPageSizeChange}
      />

      {selectedDatabaseTable && hasData && (
        <Button
          aria-label="Add new row"
          size="lg"
          position="absolute"
          bottom="16"
          right="6"
          backgroundColor="flipioPrimary"
          boxShadow="lg"
          borderRadius="full"
          p={0}
          onClick={onAddRow}
          loading={isAddingRow}
          _hover={{ transform: 'scale(1.05)' }}
          transition="all 0.2s"
        >
          <LuPlus size={24} />
        </Button>
      )}
    </Box>
  )
})

DataGridPresenter.displayName = 'DataGridPresenter'
