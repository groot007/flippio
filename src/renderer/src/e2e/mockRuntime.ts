import { fetchDevices } from '@renderer/hooks/useDevices'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection, useTableData } from '@renderer/store'
import { useRowEditingStore } from '@renderer/store/useRowEditingStore'
import { queryClient } from '../queryClient'

const E2E_MODE_ENABLED = import.meta.env.VITE_E2E_MODE === 'true'
const STORAGE_KEY = 'flippio:e2e:scenario'

export interface E2ECommandResponse {
  delayMs?: number
  error?: string
  result?: unknown
}

export interface E2ECommandMock {
  default?: E2ECommandResponse
  queue?: E2ECommandResponse[]
}

export interface E2EScenario {
  commands?: Record<string, E2ECommandMock>
  meta?: Record<string, unknown>
  name?: string
  strict?: boolean
}

interface E2EEvent {
  payload: unknown
}

type E2EEventHandler = (event: E2EEvent) => void

interface CommandHistoryEntry {
  command: string
  handled: boolean
  params: Record<string, unknown>
  timestamp: string
}

interface E2ERuntimeState {
  commandHistory: CommandHistoryEntry[]
  scenario: E2EScenario
}

const UNHANDLED_COMMAND = Symbol('UNHANDLED_COMMAND')

const bootstrapScenario: E2EScenario = {
  name: 'bootstrap-empty',
  strict: false,
  commands: {
    adb_get_devices: {
      default: {
        result: {
          success: true,
          devices: [],
        },
      },
    },
    device_get_ios_devices: {
      default: {
        result: {
          success: true,
          devices: [],
        },
      },
    },
    get_ios_simulators: {
      default: {
        result: {
          success: true,
          simulators: [],
        },
      },
    },
  },
}

const runtimeState: E2ERuntimeState = {
  commandHistory: [],
  scenario: readStoredScenario(),
}
const eventListeners = new Map<string, Set<E2EEventHandler>>()

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
}

function sleep(delayMs = 0) {
  if (!delayMs) {
    return Promise.resolve()
  }

  return new Promise(resolve => setTimeout(resolve, delayMs))
}

function resetHistory() {
  runtimeState.commandHistory = []
}

function resetEventListeners() {
  eventListeners.clear()
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined' || !('localStorage' in window)) {
    return null
  }

  try {
    return window.localStorage ?? null
  }
  catch {
    return null
  }
}

function readStoredScenario(): E2EScenario {
  const storage = getStorage()
  if (!storage) {
    return cloneValue(bootstrapScenario)
  }

  const rawScenario = storage.getItem(STORAGE_KEY)
  if (!rawScenario) {
    return cloneValue(bootstrapScenario)
  }

  try {
    return cloneValue({
      ...bootstrapScenario,
      ...JSON.parse(rawScenario),
    })
  }
  catch {
    storage.removeItem(STORAGE_KEY)
    return cloneValue(bootstrapScenario)
  }
}

function persistScenario(scenario: E2EScenario) {
  const storage = getStorage()
  if (!storage) {
    return
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(scenario))
}

function getCommandMock(command: string) {
  return runtimeState.scenario.commands?.[command]
}

function emitE2EEvent(name: string, payload: unknown) {
  const handlers = eventListeners.get(name)
  if (!handlers) {
    return
  }

  for (const handler of handlers) {
    handler({ payload: cloneValue(payload) })
  }
}

function resetRendererState() {
  useCurrentDeviceSelection.setState({
    selectedDevice: null,
    selectedApplication: null,
  })
  useCurrentDatabaseSelection.setState({
    selectedDatabaseFile: null,
    selectedDatabaseTable: null,
  })
  useTableData.setState({
    tableData: null,
    isLoadingTableData: false,
    isRefreshingTableData: false,
  })
  useRowEditingStore.setState({
    selectedRow: null,
  })
}

async function prepareScenario(scenario: unknown): Promise<void> {
  runtimeState.scenario = cloneValue({
    ...bootstrapScenario,
    ...(scenario as E2EScenario),
  })
  persistScenario(runtimeState.scenario)
  resetHistory()
  void queryClient.cancelQueries()
  queryClient.clear()
  resetEventListeners()
  resetRendererState()
  void queryClient.fetchQuery({
    queryKey: ['devices'],
    queryFn: fetchDevices,
    staleTime: 0,
  }).catch((error) => {
    console.error('Failed to prefetch devices after preparing E2E scenario', error)
  })
}

export function isE2EModeEnabled() {
  return E2E_MODE_ENABLED
}

export async function registerE2EEventListener(
  eventName: string,
  handler: E2EEventHandler,
): Promise<() => void> {
  const handlers = eventListeners.get(eventName) ?? new Set<E2EEventHandler>()
  handlers.add(handler)
  eventListeners.set(eventName, handlers)

  return () => {
    const currentHandlers = eventListeners.get(eventName)
    if (!currentHandlers) {
      return
    }

    currentHandlers.delete(handler)
    if (currentHandlers.size === 0) {
      eventListeners.delete(eventName)
    }
  }
}

export async function maybeHandleE2ECommand(
  command: string,
  params: Record<string, unknown> = {},
): Promise<typeof UNHANDLED_COMMAND | unknown> {
  if (!E2E_MODE_ENABLED) {
    return UNHANDLED_COMMAND
  }

  const commandMock = getCommandMock(command)
  const nextResponse = commandMock?.queue?.length
    ? commandMock.queue.shift()
    : commandMock?.default

  const handled = !!nextResponse
  runtimeState.commandHistory.push({
    command,
    handled,
    params: cloneValue(params),
    timestamp: new Date().toISOString(),
  })

  if (!nextResponse) {
    if (runtimeState.scenario.strict) {
      throw new Error(`No E2E mock registered for command: ${command}`)
    }

    return UNHANDLED_COMMAND
  }

  await sleep(nextResponse.delayMs)

  if (nextResponse.error) {
    throw new Error(nextResponse.error)
  }

  return cloneValue(nextResponse.result)
}

export function getUnhandledCommandSentinel() {
  return UNHANDLED_COMMAND
}

export function installE2EController() {
  if (!E2E_MODE_ENABLED || typeof window === 'undefined') {
    return
  }

  window.__FLIPPIO_E2E__ = {
    enabled: true,
    loadScenario: (scenario: unknown) => {
      runtimeState.scenario = cloneValue({
        ...bootstrapScenario,
        ...(scenario as E2EScenario),
      })
      persistScenario(runtimeState.scenario)
      resetHistory()
      resetEventListeners()
    },
    prepareScenario,
    resetScenario: () => {
      runtimeState.scenario = cloneValue(bootstrapScenario)
      getStorage()?.removeItem(STORAGE_KEY)
      resetHistory()
      resetEventListeners()
      resetRendererState()
    },
    getCommandHistory: () => cloneValue(runtimeState.commandHistory),
    getScenarioState: () => cloneValue(runtimeState.scenario),
    emitTauriEvent: (eventName: string, payload: unknown) => {
      emitE2EEvent(eventName, payload)
    },
  }
}
