import { debug as logDebug, error as logError, info as logInfo, trace as logTrace, warn as logWarn } from '@tauri-apps/plugin-log'

function formatConsoleArgs(args: unknown[]): string {
  return args.map((arg) => {
    if (arg instanceof Error) {
      return arg.stack || arg.message
    }

    if (typeof arg === 'string') {
      return arg
    }

    try {
      return JSON.stringify(arg)
    }
    catch {
      return String(arg)
    }
  }).join(' ')
}

function attachFrontendLogs() {
  if (import.meta.env.VITEST || typeof window === 'undefined') {
    return
  }

  const originalConsole = {
    debug: console.debug.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
    log: console.log.bind(console),
    trace: console.trace.bind(console),
    warn: console.warn.bind(console),
  }

  let isForwarding = false

  const forward = (method: keyof typeof originalConsole, writer: (message: string) => Promise<void>) => {
    return (...args: unknown[]) => {
      originalConsole[method](...args)

      if (isForwarding) {
        return
      }

      const message = formatConsoleArgs(args)
      if (!message) {
        return
      }

      isForwarding = true
      void writer(message)
        .catch(() => {})
        .finally(() => {
          isForwarding = false
        })
    }
  }

  console.log = forward('log', logInfo)
  console.info = forward('info', logInfo)
  console.debug = forward('debug', logDebug)
  console.warn = forward('warn', logWarn)
  console.error = forward('error', logError)
  console.trace = forward('trace', logTrace)
}

attachFrontendLogs()
