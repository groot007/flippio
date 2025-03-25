import { create } from 'zustand'

interface DatabaseStore {
  selectedDatabaseFile: any
  setSelectedDatabaseFile: (file: any) => void
  selectedDatabaseTable: any
  setSelectedDatabaseTable: (table: any) => void
  databaseFiles: any[]
  setDatabaseFiles: (files: any[]) => void
  databaseTables: any[]
  setDatabaseTables: (tables: any[]) => void
  pulledDatabaseFilePath: string
  setPulledDatabaseFilePath: (path: string) => void
  isDBPulling: boolean
  setIsDBPulling: (isPulling: boolean) => void
}

export const useCurrentDatabaseSelection = create<DatabaseStore>((set, _get) => ({
  selectedDatabaseFile: '',
  setSelectedDatabaseFile: file => set({ selectedDatabaseFile: file }),
  selectedDatabaseTable: '',
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
