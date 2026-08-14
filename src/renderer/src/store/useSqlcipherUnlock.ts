import type { DatabaseFile } from '@renderer/types'
import { create } from 'zustand'

interface SqlcipherUnlockRequest {
  databaseFile: DatabaseFile
  onUnlocked: (databaseFile: DatabaseFile, key: string) => Promise<void> | void
}

interface SqlcipherUnlockStore {
  error: string | null
  isSubmitting: boolean
  keyByIdentifier: Record<string, string>
  request: SqlcipherUnlockRequest | null
  clearError: () => void
  clearRequest: () => void
  forgetKey: (identifier: string) => void
  rememberKey: (identifier: string, key: string) => void
  setError: (error: string | null) => void
  setRequest: (request: SqlcipherUnlockRequest | null) => void
  setSubmitting: (isSubmitting: boolean) => void
}

export const useSqlcipherUnlock = create<SqlcipherUnlockStore>(set => ({
  error: null,
  isSubmitting: false,
  keyByIdentifier: {},
  request: null,
  clearError: () => set({ error: null }),
  clearRequest: () => set({ error: null, isSubmitting: false, request: null }),
  forgetKey: identifier => set(state => ({
    keyByIdentifier: Object.fromEntries(
      Object.entries(state.keyByIdentifier).filter(([key]) => key !== identifier),
    ),
  })),
  rememberKey: (identifier, key) => set(state => ({
    keyByIdentifier: {
      ...state.keyByIdentifier,
      [identifier]: key,
    },
  })),
  setError: error => set({ error }),
  setRequest: request => set({ error: null, request }),
  setSubmitting: isSubmitting => set({ isSubmitting }),
}))
