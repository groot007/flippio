import type { TableFooterPresenterProps } from './types'

import {
  Box,
  Button,
  Flex,
  Text,
} from '@chakra-ui/react'
import { ChangeHistoryIndicator } from '@renderer/features/change-history/components/change-history-indicator'
import { FLSelect } from '@renderer/shared/components/ui'

import { memo } from 'react'
import { LuChevronLeft, LuChevronRight, LuTrash2 } from 'react-icons/lu'

/**
 * TableFooterPresenter - Pure UI component for table footer with pagination controls
 * 
 * Renders pagination controls, page size selector, and action buttons.
 * Contains no business logic - all state and actions are managed by the Container.
 */
const TableFooterPresenterImpl: React.FC<TableFooterPresenterProps> = ({
  colorMode,
  pageSize,
  currentPage,
  totalPages,
  _totalRows,
  isLoading,
  selectedTableName,
  onPageSizeChange,
  onPageChange,
  onOpenClearTableDialog,
  getDisplayedRowRange,
}) => {
  return (
    <Box
      height="50px"
      borderTop="1px solid"
      borderColor="borderPrimary"
      bg="bgSecondary"
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
          onClick={onOpenClearTableDialog}
          title="Clear table"
          disabled={!selectedTableName || isLoading}
          _hover={{ bg: colorMode === 'dark' ? 'flipioDark.400' : 'flipioLight.200' }}
        >
          <LuTrash2 color="remove" />
        </Button>
      </Flex>

      <Flex alignItems="center" gap={2} marginLeft={6}>
        <ChangeHistoryIndicator />
      </Flex>

      {/* Center pagination controls */}
      <Flex alignItems="center" gap={4} marginLeft="auto">
        <Flex alignItems="center" gap={2}>
          <Text fontSize="sm" color="textSecondary">
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
            onChange={selected => onPageSizeChange(Number(selected.value))}
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
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            _hover={{ bg: colorMode === 'dark' ? 'flipioDark.400' : 'flipioLight.200' }}
          >
            <LuChevronLeft size={12} />
          </Button>

          <Text fontSize="sm" color="textSecondary" mx={2}>
            {getDisplayedRowRange()}
          </Text>

          <Button
            size="xs"
            w={5}
            variant="ghost"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
            _hover={{ bg: colorMode === 'dark' ? 'flipioDark.400' : 'flipioLight.200' }}
          >
            <LuChevronRight size={12} />
          </Button>
        </Flex>

        <Text fontSize="sm" color="textSecondary">
          Page 
          {' '}
          {currentPage}
          {' '}
          of 
          {' '}
          {totalPages || 1}
        </Text>
      </Flex>
    </Box>
  )
}

export const TableFooterPresenter = memo(TableFooterPresenterImpl)
