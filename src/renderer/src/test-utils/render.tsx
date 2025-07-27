import type { RenderOptions } from '@testing-library/react'
import { Provider } from '@renderer/ui/provider'
import { act, render as rtlRender } from '@testing-library/react'

export function render(ui: React.ReactNode, options?: RenderOptions) {
  return rtlRender(<>{ui}</>, {
    wrapper: (props: React.PropsWithChildren) => (
      <Provider>{props.children}</Provider>
    ),
    ...options,
  })
}

// Export a wrapped version of act for convenience
export async function actAsync(fn: () => Promise<void>) {
  await act(async () => {
    await fn()
  })
}

// Export a helper for waiting for async operations
export function waitForAsyncUpdates() {
  return act(async () => {
    // Wait for any pending promises and timers
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

// Re-export everything from testing library
export * from '@testing-library/react'
export { act }
