'use client'

import {
  Toaster as ChakraToaster,
  createToaster,
  Portal,
  Spinner,
  Stack,
  Toast,
} from '@chakra-ui/react'

export const toaster = createToaster({
  placement: 'bottom-end',
  pauseOnPageIdle: true,
})

export function Toaster() {
  return (
    <Portal>
      <ChakraToaster toaster={toaster}>
        {toast => (
          <Toast.Root width={{ md: 'sm' }}>
            {toast.type === 'loading'
              ? (
                  <Spinner size="sm" color="blue.solid" />
                )
              : (
                  <Toast.Indicator />
                )}
            <Stack gap="1" flex="1" maxWidth="100%">
              <Stack color={toast.type === 'success' ? 'green.500' : toast.type === 'error' ? 'red.500' : 'blue.500'}>{toast.title && <Toast.Title>{toast.title}</Toast.Title>}</Stack>
              {toast.description && (
                <Toast.Description>{toast.description}</Toast.Description>
              )}
            </Stack>
            {toast.action && (
              <Toast.ActionTrigger>{toast.action.label}</Toast.ActionTrigger>
            )}
            {toast.meta?.closable && <Toast.CloseTrigger />}
          </Toast.Root>
        )}
      </ChakraToaster>
    </Portal>
  )
}
