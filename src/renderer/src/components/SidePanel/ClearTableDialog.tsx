import {
  HStack,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react'
import FLModal from '../common/FLModal'

interface ClearTableDialogProps {
  isOpen: boolean
  onClose: () => void
  onClear: () => void
  isLoading: boolean
}

export const ClearTableDialog: React.FC<ClearTableDialogProps> = ({
  isOpen,
  onClose,
  onClear,
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
              Are you sure you want to clear this table? This will delete all rows in the table and cannot be undone.
            </Text>
            
            {isLoading && (
              <HStack gap={2} p={3} bg="bgSecondary" borderRadius="md">
                <Spinner size="sm" color="flipioPrimary" />
                <Text fontSize="sm" color="textSecondary">
                  Clearing table and syncing changes to device...
                </Text>
              </HStack>
            )}
          </VStack>
        )}
        title="Clear Table"
        acceptBtn="Clear Table"
        onAccept={() => {
          onClear()
        }}
        rejectBtn="Cancel"
        onReject={() => {
          onClose()
        }}
      />
    </>
  )
}
