import { create } from 'zustand'

interface Device {
  value: string
  label: string
  description?: string
}

interface Application {
  id: string
  name: string
  deviceId: string
}

interface DatabaseFile {
  id: string
  name: string
  applicationId: string
}

interface DatabaseTable {
  id: string
  name: string
  databaseId: string
}

interface TableData {
  columns: string[]
  rows: Record<string, any>[]
  totalRows: number
}

interface SelectedRow {
  rowData: Record<string, any>
  isEditing: boolean
  originalData?: Record<string, any>
}

interface AppState {
  // Theme
  isDarkMode: boolean
  toggleTheme: () => void

  // Device and application selection
  devices: Device[]
  setDevices: (devices: Device[]) => void
  selectedDevice: string
  applications: Application[]
  setApplications: (apps: Application[]) => void
  selectedApplication: string | null

  // Database files and tables
  databaseFiles: DatabaseFile[]
  setDatabaseFiles: (files: DatabaseFile[]) => void
  selectedDatabaseFile: Record<string, any> | null
  databaseTables: DatabaseTable[]
  setDatabaseTables: (tables: DatabaseTable[]) => void
  selectedDatabaseTable: Record<string, any> | null

  // Table data
  tableData: TableData | null
  setTableData: (data: TableData | null) => void
  currentPage: number
  pageSize: number

  // Side panel
  selectedRow: SelectedRow | null
  selectRow: (rowData: Record<string, any>) => void
  closeRowPanel: () => void
  startEditingRow: () => void
  setEditedRowData: (editedData: Record<string, any>) => void
  cancelEditingRow: () => void

  // Loading states
  isLoadingApps: boolean
  setIsLoadingApps: (loading: boolean) => void
  isLoadingDatabase: boolean
  setIsLoadingDatabase: (loading: boolean) => void
  isLoadingTableData: boolean
  setIsLoadingTableData: (loading: boolean) => void

  // Actions
  setSelectedDevice: (device: string) => void
  setSelectedApplication: (app: string) => void
  setSelectedDatabaseFile: (file: DatabaseFile | null) => void
  setSelectedDatabaseTable: (table: DatabaseTable | null) => void
  setPage: (page: number) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Theme
  isDarkMode: true,
  toggleTheme: () => set(state => ({ isDarkMode: !state.isDarkMode })),

  devices: [],
  selectedDevice: '',
  applications: [],
  selectedApplication: null,

  databaseFiles: [],
  setDatabaseFiles: files => set({ databaseFiles: files }),
  selectedDatabaseFile: null,
  databaseTables: [],
  setDatabaseTables: tables => set({ databaseTables: tables }),
  selectedDatabaseTable: null,

  tableData: null,
  setTableData: data => set({ tableData: data }),
  currentPage: 0,
  pageSize: 25,
  setPage: page => set({ currentPage: page }),

  selectedRow: null,
  selectRow: rowData => set({
    selectedRow: {
      rowData,
      isEditing: false,
      originalData: { ...rowData },
    },
  }),
  closeRowPanel: () => set({ selectedRow: null }),
  startEditingRow: () => {
    const { selectedRow } = get()
    if (selectedRow) {
      set({
        selectedRow: {
          ...selectedRow,
          isEditing: true,
          originalData: { ...selectedRow.rowData },
        },
      })
    }
  },
  setEditedRowData: (editedData) => {
    set({
      selectedRow: {
        rowData: editedData,
        isEditing: false,
        originalData: editedData,
      },
    })
  },
  cancelEditingRow: () => {
    const { selectedRow } = get()
    if (selectedRow && selectedRow.originalData) {
      set({
        selectedRow: {
          rowData: selectedRow.originalData,
          isEditing: false,
          originalData: selectedRow.originalData,
        },
      })
    }
    else if (selectedRow) {
      set({ selectedRow: { ...selectedRow, isEditing: false } })
    }
  },

  isLoadingApps: false,
  setIsLoadingApps: loading => set({ isLoadingApps: loading }),
  isLoadingDatabase: false,
  setIsLoadingDatabase: loading => set({ isLoadingDatabase: loading }),
  isLoadingTableData: false,
  setIsLoadingTableData: loading => set({ isLoadingTableData: loading }),

  setDevices: devices => set({ devices }),
  setApplications: applications => set({ applications, selectedDatabaseFile: null, selectedDatabaseTable: null }),

  setSelectedDevice: (device) => {
    set({
      selectedDevice: device,
      selectedApplication: null,
      selectedDatabaseFile: null,
      selectedDatabaseTable: null,
      tableData: null,
      databaseFiles: [],
      databaseTables: [],
    })
  },

  setSelectedApplication: (app) => {
    set({
      selectedApplication: app,
      selectedDatabaseFile: null,
      selectedDatabaseTable: null,
      tableData: null,
    })
  },

  setSelectedDatabaseFile: (file) => {
    set({
      selectedDatabaseFile: file,
      selectedDatabaseTable: null,
      isLoadingDatabase: false,
    })
  },

  setSelectedDatabaseTable: (table) => {
    set({
      selectedDatabaseTable: table,
      isLoadingTableData: false,
      selectedRow: null,
    })
  },
}))
