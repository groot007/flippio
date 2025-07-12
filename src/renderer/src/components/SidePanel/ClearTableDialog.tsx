import {
  Text,
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
  if (isLoading) {
    return <>Loading..</>
  }

  return (
    <FLModal
      isOpen={isOpen}
      body={(
        <Text>
          Are you sure you want to clear this table? This will delete all rows in the table and cannot be undone.
        </Text>
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
  )
}
