import { Button, Dialog, Portal } from '@chakra-ui/react'

interface FLModalProps {
  isOpen: boolean
  body: React.ReactNode
  title: string
  acceptBtn: string
  onAccept: () => void
  rejectBtn?: string
  onReject?: () => void
  disabled?: boolean
}

function FLModal({
  isOpen,
  body,
  title,
  acceptBtn,
  onAccept,
  rejectBtn,
  onReject,
  disabled = false,
}: FLModalProps) {
  return (
    <Dialog.Root lazyMount open={isOpen} closeOnInteractOutside={true}>
      <Portal>
        <Dialog.Backdrop bg="rgba(0, 0, 0, 0.4)" />
        <Dialog.Positioner>
          <Dialog.Content
            bg="bgPrimary"
            border="1px solid"
            borderColor="borderPrimary"
            borderRadius="lg"
            boxShadow="xl"
            maxW="md"
            mx={4}
            p={0}
          >
            <Dialog.Header
              px={6}
              pt={6}
              pb={4}
              borderBottom="1px solid"
              borderColor="borderSecondary"
            >
              <Dialog.Title
                fontSize="lg"
                fontWeight="semibold"
                color="textPrimary"
              >
                {title}
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body
              px={6}
              py={4}
              color="textPrimary"
              fontSize="sm"
              lineHeight="relaxed"
            >
              {body}
            </Dialog.Body>
            <Dialog.Footer
              px={6}
              pb={6}
              pt={4}
              display="flex"
              gap={3}
              justifyContent="flex-end"
            >
              <Dialog.ActionTrigger asChild>
                <Button
                  variant="ghost"
                  onClick={onReject}
                  disabled={disabled}
                  color="textSecondary"
                  _hover={{
                    bg: 'bgTertiary',
                  }}
                >
                  {rejectBtn}
                </Button>
              </Dialog.ActionTrigger>
              <Button
                onClick={onAccept}
                disabled={disabled}
                bg="flipioPrimary"
                color="white"
                _hover={{
                  bg: 'flipioSecondary',
                }}
                fontWeight="medium"
              >
                {acceptBtn}
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger 
              position="absolute"
              top={4}
              right={4}
              onClick={onReject}
              color="textSecondary"
              _hover={{
                bg: 'bgTertiary',
                color: 'textPrimary',
              }}
              fontSize="sm"
              display="flex"
              alignItems="center"
              justifyContent="center"
              w={6}
              h={6}
              borderRadius="md"
              bg="transparent"
              border="none"
              cursor="pointer"
            >
              ×
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

export default FLModal
