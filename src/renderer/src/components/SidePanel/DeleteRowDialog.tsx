import {
  HStack,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react'
import FLModal from '../common/FLModal'

interface DeleteRowDialogProps {
  isOpen: boolean
  onClose: () => void
  onDelete: () => void
  isLoading: boolean
}

export const DeleteRowDialog: React.FC<DeleteRowDialogProps> = ({
  isOpen,
  onClose,
  onDelete,
  isLoading,
}) => {
  return (
    <>

      <FLModal
        isOpen={isOpen}
        disabled={isLoading}
        body={(
          <VStack gap={4} align="stretch">
            <Text>
              Are you sure you want to delete this row? This action cannot be undone.
            </Text>
            
            {isLoading && (
              <HStack gap={2} p={3} bg="bgSecondary" borderRadius="md">
                <Spinner size="sm" color="flipioPrimary" />
                <Text fontSize="sm" color="textSecondary">
                  Deleting row and syncing changes to device...
                </Text>
              </HStack>
            )}
          </VStack>
        )}
        title="Delete Row"
        acceptBtn="Delete"
        onAccept={() => {
          onDelete()
        }}
        rejectBtn="Cancel"
        onReject={() => {
          onClose()
        }}
      />
    </>
  )
}
