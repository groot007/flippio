import { Button, CloseButton, Dialog, Portal } from '@chakra-ui/react'

function FLModal({
  isOpen,
  body,
  title,
  acceptBtn,
  onAccept,
  rejectBtn,
  onReject,
}) {
  return (
    <Dialog.Root lazyMount open={isOpen} closeOnInteractOutside={true}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              {body}
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline" onClick={onReject}>{rejectBtn}</Button>
              </Dialog.ActionTrigger>
              <Button onClick={onAccept}>{acceptBtn}</Button>
            </Dialog.Footer>
            {/* @ts-expect-error chakra types */}
            <Dialog.CloseTrigger asChild>
              <CloseButton onClick={onReject} size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

export default FLModal
