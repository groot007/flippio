import { isE2EModeEnabled, registerE2EEventListener } from '@renderer/e2e/mockRuntime'
import { listen } from '@tauri-apps/api/event'

export async function listenAppEvent<T>(
  eventName: string,
  handler: (event: { payload: T }) => void,
): Promise<() => void> {
  if (isE2EModeEnabled()) {
    return registerE2EEventListener(eventName, handler as (event: { payload: unknown }) => void)
  }

  return listen<T>(eventName, handler)
}
