import type { FC } from 'react'
import type { SubHeaderProps } from './types'

import { Box, Button, Flex, HStack, Spinner, Text } from '@chakra-ui/react'

import { CustomQueryModalContainer } from '@renderer/features/database/components/custom-query-modal'
import { FLSelect } from '@renderer/shared/components/ui'
import { memo } from 'react'

import { LuDatabase, LuFilter, LuFolderOpen, LuRefreshCcw, LuTable, LuUpload, LuX } from 'react-icons/lu'

const SubHeaderPresenterImpl: FC<SubHeaderProps> = ({
  selectedDatabaseFile,
  selectedDatabaseTable,
  selectedApplication,
  databaseFiles,
  databaseTables,
  isLoading,
  isRefreshing,
  isQueryModalOpen,
  isCustomQuery,
  isDBPulling,
  isNoDB,
  isTableSelectDisabled,
  onDatabaseFileChange,
  onTableChange,
  onRefresh,
  onOpenFile,
  onExportDB,
  onOpenQueryModal,
  onCloseQueryModal,
  onClearCustomQuery,
}) => {
  const dbFileOptions = databaseFiles?.map(file => ({
    label: file.filename,
    value: file.path,
    ...file,
  })) ?? []

  const tableOptions = databaseTables?.map(table => ({
    label: table.name,
    value: table.name,
    ...table,
  })) ?? []

  return (
    <Box
      width="full"
      py={4}
      px={6}
      borderBottomWidth="1px"
      borderColor="borderPrimary"
      bg="bgSecondary"
    >
      {isNoDB && (
        <Box width="full" pb={4}>
          <Text fontSize="sm" fontWeight="medium" color="error">
            No database files available
          </Text>
        </Box>
      )}

      <Flex justifyContent="flex-start" alignItems="center">
        <HStack gap={4}>
          {selectedDatabaseFile?.deviceType === 'desktop'
            ? (
                <Text
                  fontSize="xs"
                  maxWidth={300}
                  color="textSecondary"
                  fontFamily="mono"
                  bg="bgTertiary"
                  px={2}
                  py={1}
                  borderRadius="sm"
                >
                  {selectedDatabaseFile?.path}
                </Text>
              )
            : (
                <FLSelect
                  label="Select Database"
                  options={dbFileOptions}
                  value={selectedDatabaseFile}
                  icon={<LuDatabase color="var(--chakra-colors-flipioPrimary)" />}
                  onChange={onDatabaseFileChange}
                  isDisabled={!selectedApplication?.bundleId || isDBPulling}
                />
              )}

          <Box>
            <FLSelect
              label="Select Table"
              options={tableOptions}
              value={selectedDatabaseTable}
              icon={<LuTable color="var(--chakra-colors-flipioPrimary)" />}
              onChange={onTableChange}
              isDisabled={isTableSelectDisabled}
            />
          </Box>

          <Button
            data-testid="refresh-db"
            data-state={isRefreshing || isLoading ? 'open' : 'closed'}
            onClick={onRefresh}
            variant="ghost"
            size="sm"
            color="textSecondary"
            _hover={{
              bg: 'bgTertiary',
              color: 'flipioPrimary',
            }}
            disabled={isLoading || isRefreshing || !selectedDatabaseTable}
            _disabled={{
              opacity: 0.5,
            }}
            _open={{
              animationName: 'rotate',
              animationIterationCount: 'infinite',
              animationDuration: '1100ms',
            }}
            title="Refresh database"
          >
            <LuRefreshCcw size={16} />
          </Button>

          {isDBPulling && <Spinner size="sm" color="flipioPrimary" />}

          <HStack>
            <Button
              onClick={onOpenQueryModal}
              variant="outline"
              size="sm"
              color="flipioPrimary"
              borderColor="borderPrimary"
              _hover={{
                borderColor: 'flipioPrimary',
                bg: 'bgTertiary',
              }}
              disabled={!selectedDatabaseFile?.path}
              fontSize="xs"
              fontWeight="medium"
            >
              <LuFilter size={14} />
              <Text ml={1}>SQL</Text>
            </Button>

            {isCustomQuery && (
              <Button
                onClick={onClearCustomQuery}
                variant="ghost"
                size="sm"
                color="red.400"
                fontSize="xs"
                fontWeight="medium"
                p={0}
                title="Clear SQL query and show default table rows"
                _hover={{ bg: 'bgTertiary', color: 'red.600' }}
              >
                <LuX size={12} />
              </Button>
            )}
          </HStack>
        </HStack>

        <HStack ml="auto" gap={3}>
          <Button
            onClick={onOpenFile}
            variant="ghost"
            size="sm"
            color="flipioPrimary"
            fontSize="xs"
            fontWeight="medium"
            _hover={{
              bg: 'bgTertiary',
            }}
          >
            <LuFolderOpen size={14} />
            <Text ml={1}>Open</Text>
          </Button>

          <Button
            onClick={onExportDB}
            variant="outline"
            size="sm"
            color="flipioPrimary"
            borderColor="borderPrimary"
            _hover={{
              borderColor: 'flipioPrimary',
              bg: 'bgTertiary',
            }}
            disabled={!selectedDatabaseFile?.path}
            fontSize="xs"
            fontWeight="medium"
          >
            <LuUpload size={14} />
            <Text ml={1}>Export</Text>
          </Button>
        </HStack>
      </Flex>

      <CustomQueryModalContainer
        isOpen={isQueryModalOpen}
        onClose={onCloseQueryModal}
      />
    </Box>
  )
}

export const SubHeaderPresenter = memo(SubHeaderPresenterImpl)
