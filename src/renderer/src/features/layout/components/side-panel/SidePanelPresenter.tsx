import type { FC } from 'react'
import type { SidePanelProps } from './types'

import { Button, Drawer, Flex, IconButton, Portal, Stack } from '@chakra-ui/react'

import { memo } from 'react'
import { LuX } from 'react-icons/lu'

import { ClearTableDialog, DeleteRowDialog, FieldItem, RowEditor } from './components'

const SidePanelPresenterImpl: FC<SidePanelProps> = ({
  selectedRow,
  tableData,
  isOpen,
  isDark,
  isLoading,
  isEditing,
  editedData,
  isDeleteDialogOpen,
  isClearTableDialogOpen,
  onClosePanel,
  onDeleteRow,
  onClearTable,
  onDeleteDialogOpen,
  onDeleteDialogClose,
  onClearTableDialogOpen,
  onClearTableDialogClose,
  onEditingChange,
  onLoadingChange,
  onEditedDataChange,
  onFieldChange,
}) => {
  return (
    <Drawer.Root open={isOpen} onOpenChange={onClosePanel} placement="end">
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content maxWidth="500px" width="100%">
            <Drawer.Header pr={16}>
              <Drawer.Title>{isEditing ? 'Edit Row Data' : 'Row Details'}</Drawer.Title>
              <Flex gap={2}>
                <RowEditor
                  isEditing={isEditing}
                  setIsEditing={onEditingChange}
                  isLoading={isLoading}
                  setIsLoading={onLoadingChange}
                  editedData={editedData}
                  setEditedData={onEditedDataChange}
                />
                <Drawer.CloseTrigger asChild>
                  <IconButton
                    aria-label="Close panel"
                    size="xl"
                    bg="transparent"
                    disabled={isLoading}
                    color="gray.400"
                  >
                    <LuX size={64} />
                  </IconButton>
                </Drawer.CloseTrigger>
              </Flex>
            </Drawer.Header>
            <Drawer.Body>
              {selectedRow && tableData?.columns && (
                <Stack gap="0">
                  {tableData.columns.map((column: any) => {
                    const key = column.name || column
                    const value = selectedRow.rowData?.[key]
                    const columnInfo = selectedRow.columnInfo?.find((col: any) => col.name === key)
                    
                    return (
                      <FieldItem
                        key={key}
                        fieldKey={key}
                        fieldType={columnInfo?.type || 'unknown'}
                        value={isEditing ? editedData[key] : value}
                        isEditing={isEditing}
                        onChange={onFieldChange}
                        isLoading={isLoading}
                        isDark={isDark}
                      />
                    )
                  })}
                  <Button
                    colorScheme="red"
                    variant="outline"
                    onClick={onDeleteDialogOpen}
                    size="md"
                    width="full"
                    mt={8}
                    mb={2}
                    _hover={{ bg: 'red.50', _dark: { bg: 'red.900' } }}
                  >
                    Remove Row
                  </Button>
                  <Button
                    colorScheme="orange"
                    variant="outline"
                    onClick={onClearTableDialogOpen}
                    size="md"
                    width="full"
                    mb={4}
                    _hover={{ bg: 'orange.50', _dark: { bg: 'orange.900' } }}
                  >
                    Clear Whole Table
                  </Button>
                  <DeleteRowDialog
                    isOpen={isDeleteDialogOpen}
                    onClose={onDeleteDialogClose}
                    onDelete={onDeleteRow}
                    isLoading={isLoading}
                  />
                  <ClearTableDialog
                    isOpen={isClearTableDialogOpen}
                    onClose={onClearTableDialogClose}
                    onClear={onClearTable}
                    isLoading={isLoading}
                  />
                </Stack>
              )}
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  )
}

export const SidePanelPresenter = memo(SidePanelPresenterImpl)
