import type { DatabaseFile, DatabaseTable } from '@renderer/types'
import { create } from 'zustand'

interface DatabaseStore {
  selectedDatabaseFile: DatabaseFile | null
  setSelectedDatabaseFile: (file: DatabaseFile | null) => void
  selectedDatabaseTable: DatabaseTable | null
  setSelectedDatabaseTable: (table: DatabaseTable | null) => void
  databaseFiles: DatabaseFile[]
  setDatabaseFiles: (files: DatabaseFile[]) => void
  databaseTables: DatabaseTable[]
  setDatabaseTables: (tables: DatabaseTable[]) => void
  pulledDatabaseFilePath: string
  setPulledDatabaseFilePath: (path: string) => void
  isDBPulling: boolean
  setIsDBPulling: (isPulling: boolean) => void
}

export const useCurrentDatabaseSelection = create<DatabaseStore>((set, _get) => ({
  selectedDatabaseFile: null,
  setSelectedDatabaseFile: file => set({ selectedDatabaseFile: file }),
  selectedDatabaseTable: null,
  setSelectedDatabaseTable: table => set({ selectedDatabaseTable: table }),
  databaseFiles: [],
  setDatabaseFiles: files => set({ databaseFiles: files }),
  databaseTables: [],
  setDatabaseTables: tables => set({ databaseTables: tables }),
  pulledDatabaseFilePath: '',
  setPulledDatabaseFilePath: path => set({ pulledDatabaseFilePath: path }),
  isDBPulling: false,
  setIsDBPulling: isPulling => set({ isDBPulling: isPulling }),
}))
