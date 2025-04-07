import {
  Text,
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
  if (isLoading) {
    return <>Loading..</>
  }

  return (
    <FLModal
      isOpen={isOpen}
      body={(
        <Text>
          Are you sure you want to delete this row? This action cannot be undone.
        </Text>
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
  )
}
