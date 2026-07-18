import type { DatabaseFile, DatabaseTable } from '@renderer/types'
import { create } from 'zustand'

interface DatabaseStore {
  selectedDatabaseFile: DatabaseFile | null
  setSelectedDatabaseFile: (file: DatabaseFile | null) => void
  selectedDatabaseTable: DatabaseTable | null
  setSelectedDatabaseTable: (table: DatabaseTable | null) => void
}

export const useCurrentDatabaseSelection = create<DatabaseStore>((set, _get) => ({
  selectedDatabaseFile: null,
  setSelectedDatabaseFile: file => set({ selectedDatabaseFile: file }),
  selectedDatabaseTable: null,
  setSelectedDatabaseTable: table => set({ selectedDatabaseTable: table }),
}))
