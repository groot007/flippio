import { DialogBackdrop, DialogCloseTrigger, DialogContent, DialogHeader, DialogRoot, DialogTitle } from '@chakra-ui/react'

import { memo } from 'react'
import { LuX } from 'react-icons/lu'

export interface SharedModalProps {
  'isOpen': boolean
  'onClose': () => void
  'title'?: string
  'size'?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full' | 'cover'
  'children': React.ReactNode
  'closeOnOverlayClick'?: boolean
  'closeOnEsc'?: boolean
  'data-testid'?: string
}

function SharedModalImpl({
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
  closeOnOverlayClick = true,
  closeOnEsc = true,
  'data-testid': testId,
}: SharedModalProps) {
  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(details) => {
        if (!details.open) {
          onClose()
        }
      }}
      size={size}
      closeOnInteractOutside={closeOnOverlayClick}
      closeOnEscape={closeOnEsc}
      data-testid={testId}
    >
      <DialogBackdrop />
      <DialogContent>
        {title && (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogCloseTrigger asChild>
              <button
                type="button"
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  color: 'var(--chakra-colors-textSecondary)',
                }}
                aria-label="Close"
              >
                <LuX size={16} />
              </button>
            </DialogCloseTrigger>
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </DialogRoot>
  )
}

export const SharedModal = memo(SharedModalImpl)
