import type { RowEditorPresenterProps } from './types'
import { Button, Flex, Spinner } from '@chakra-ui/react'
import { memo } from 'react'
import { LuPencil, LuSave } from 'react-icons/lu'

function RowEditorPresenterImpl({
  isEditing,
  isLoading,
  onStartEditing,
  onSave,
  onCancel,
}: RowEditorPresenterProps) {
  return (
    <Flex gap={2}>
      {!isEditing
        ? (
            <Button
              size="sm"
              onClick={onStartEditing}
              disabled={isLoading}
            >
              <LuPencil />
              {' '}
              Edit
            </Button>
          )
        : (
            <>
              <Button
                colorScheme="green"
                size="sm"
                onClick={onSave}
                disabled={isLoading}
              >
                {isLoading
                  ? (
                      <>
                        <Spinner size="sm" />
                        Saving...
                      </>
                    )
                  : (
                      <>
                        Save
                        <LuSave />
                      </>
                    )}
              </Button>
              <Button
                size="sm"
                colorPalette="pink"
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </>
          )}
    </Flex>
  )
}

export const RowEditorPresenter = memo(RowEditorPresenterImpl)
