import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../appStore'

describe('appStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      isDarkMode: true,
      devices: [],
      selectedDevice: '',
      applications: [],
      selectedApplication: null,
      databaseFiles: [],
      selectedDatabaseFile: null,
      databaseTables: [],
      selectedDatabaseTable: null,
      tableData: null,
      currentPage: 0,
      pageSize: 25,
      selectedRow: null,
      isLoadingApps: false,
      isLoadingDatabase: false,
      isLoadingTableData: false,
    })
  })

  describe('theme management', () => {
    it('should initialize with dark mode enabled', () => {
      const { isDarkMode } = useAppStore.getState()
      expect(isDarkMode).toBe(true)
    })

    it('should toggle theme mode', () => {
      const { toggleTheme } = useAppStore.getState()
      
      toggleTheme()
      expect(useAppStore.getState().isDarkMode).toBe(false)
      
      toggleTheme()
      expect(useAppStore.getState().isDarkMode).toBe(true)
    })
  })

  describe('device management', () => {
    it('should set devices', () => {
      const { setDevices } = useAppStore.getState()
      const testDevices = [
        { value: 'device1', label: 'iPhone 14', description: 'iOS Device' },
        { value: 'device2', label: 'Pixel 7', description: 'Android Device' },
      ]
      
      setDevices(testDevices)
      expect(useAppStore.getState().devices).toEqual(testDevices)
    })

    it('should set selected device', () => {
      const { setSelectedDevice } = useAppStore.getState()
      
      setSelectedDevice('device1')
      expect(useAppStore.getState().selectedDevice).toBe('device1')
    })
  })

  describe('application management', () => {
    it('should set applications', () => {
      const { setApplications } = useAppStore.getState()
      const testApps = [
        { id: 'app1', name: 'Test App 1', deviceId: 'device1' },
        { id: 'app2', name: 'Test App 2', deviceId: 'device1' },
      ]
      
      setApplications(testApps)
      expect(useAppStore.getState().applications).toEqual(testApps)
    })

    it('should set selected application', () => {
      const { setSelectedApplication } = useAppStore.getState()
      
      setSelectedApplication('app1')
      expect(useAppStore.getState().selectedApplication).toBe('app1')
    })
  })

  describe('database file management', () => {
    it('should set database files', () => {
      const { setDatabaseFiles } = useAppStore.getState()
      const testFiles = [
        { id: 'file1', name: 'test.db', applicationId: 'app1' },
        { id: 'file2', name: 'backup.db', applicationId: 'app1' },
      ]
      
      setDatabaseFiles(testFiles)
      expect(useAppStore.getState().databaseFiles).toEqual(testFiles)
    })

    it('should set selected database file', () => {
      const { setSelectedDatabaseFile } = useAppStore.getState()
      const testFile = { id: 'file1', name: 'test.db', applicationId: 'app1' }
      
      setSelectedDatabaseFile(testFile)
      expect(useAppStore.getState().selectedDatabaseFile).toEqual(testFile)
    })
  })

  describe('database table management', () => {
    it('should set database tables', () => {
      const { setDatabaseTables } = useAppStore.getState()
      const testTables = [
        { id: 'table1', name: 'users', databaseId: 'file1' },
        { id: 'table2', name: 'posts', databaseId: 'file1' },
      ]
      
      setDatabaseTables(testTables)
      expect(useAppStore.getState().databaseTables).toEqual(testTables)
    })

    it('should set selected database table', () => {
      const { setSelectedDatabaseTable } = useAppStore.getState()
      const testTable = { id: 'table1', name: 'users', databaseId: 'file1' }
      
      setSelectedDatabaseTable(testTable)
      expect(useAppStore.getState().selectedDatabaseTable).toEqual(testTable)
    })
  })

  describe('table data management', () => {
    it('should set table data', () => {
      const { setTableData } = useAppStore.getState()
      const testData = {
        columns: ['id', 'name', 'email'],
        rows: [
          { id: 1, name: 'John Doe', email: 'john@example.com' },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
        ],
        totalRows: 2,
      }
      
      setTableData(testData)
      expect(useAppStore.getState().tableData).toEqual(testData)
    })

    it('should clear table data when set to null', () => {
      const { setTableData } = useAppStore.getState()
      
      setTableData(null)
      expect(useAppStore.getState().tableData).toBeNull()
    })

    it('should set current page', () => {
      const { setPage } = useAppStore.getState()
      
      setPage(5)
      expect(useAppStore.getState().currentPage).toBe(5)
    })
  })

  describe('row selection and editing', () => {
    it('should select a row', () => {
      const { selectRow } = useAppStore.getState()
      const testRowData = { id: 1, name: 'John Doe', email: 'john@example.com' }
      
      selectRow(testRowData)
      
      const { selectedRow } = useAppStore.getState()
      expect(selectedRow).toEqual({
        rowData: testRowData,
        isEditing: false,
        originalData: testRowData,
      })
    })

    it('should close row panel', () => {
      const { selectRow, closeRowPanel } = useAppStore.getState()
      const testRowData = { id: 1, name: 'John Doe' }
      
      selectRow(testRowData)
      expect(useAppStore.getState().selectedRow).not.toBeNull()
      
      closeRowPanel()
      expect(useAppStore.getState().selectedRow).toBeNull()
    })

    it('should start editing row', () => {
      const { selectRow, startEditingRow } = useAppStore.getState()
      const testRowData = { id: 1, name: 'John Doe' }
      
      selectRow(testRowData)
      startEditingRow()
      
      const { selectedRow } = useAppStore.getState()
      expect(selectedRow?.isEditing).toBe(true)
      expect(selectedRow?.originalData).toEqual(testRowData)
    })

    it('should not start editing if no row selected', () => {
      const { startEditingRow } = useAppStore.getState()
      
      startEditingRow()
      
      const { selectedRow } = useAppStore.getState()
      expect(selectedRow).toBeNull()
    })

    it('should set edited row data', () => {
      const { selectRow, setEditedRowData } = useAppStore.getState()
      const originalData = { id: 1, name: 'John Doe' }
      const editedData = { id: 1, name: 'John Smith' }
      
      selectRow(originalData)
      setEditedRowData(editedData)
      
      const { selectedRow } = useAppStore.getState()
      expect(selectedRow?.rowData).toEqual(editedData)
      expect(selectedRow?.isEditing).toBe(false)
      expect(selectedRow?.originalData).toEqual(editedData)
    })

    it('should cancel editing row', () => {
      const { selectRow, startEditingRow, cancelEditingRow } = useAppStore.getState()
      const testRowData = { id: 1, name: 'John Doe' }
      
      selectRow(testRowData)
      startEditingRow()
      
      // Simulate some edits by directly modifying the state
      useAppStore.setState(state => ({
        selectedRow: state.selectedRow
          ? {
              ...state.selectedRow,
              rowData: { id: 1, name: 'John Smith' },
            }
          : null,
      }))
      
      cancelEditingRow()
      
      const { selectedRow } = useAppStore.getState()
      expect(selectedRow?.rowData).toEqual(testRowData)
      expect(selectedRow?.isEditing).toBe(false)
    })

    it('should not cancel editing if no row selected', () => {
      const { cancelEditingRow } = useAppStore.getState()
      
      cancelEditingRow()
      
      const { selectedRow } = useAppStore.getState()
      expect(selectedRow).toBeNull()
    })
  })

  describe('loading states', () => {
    it('should set loading apps state', () => {
      const { setIsLoadingApps } = useAppStore.getState()
      
      setIsLoadingApps(true)
      expect(useAppStore.getState().isLoadingApps).toBe(true)
      
      setIsLoadingApps(false)
      expect(useAppStore.getState().isLoadingApps).toBe(false)
    })

    it('should set loading database state', () => {
      const { setIsLoadingDatabase } = useAppStore.getState()
      
      setIsLoadingDatabase(true)
      expect(useAppStore.getState().isLoadingDatabase).toBe(true)
      
      setIsLoadingDatabase(false)
      expect(useAppStore.getState().isLoadingDatabase).toBe(false)
    })

    it('should set loading table data state', () => {
      const { setIsLoadingTableData } = useAppStore.getState()
      
      setIsLoadingTableData(true)
      expect(useAppStore.getState().isLoadingTableData).toBe(true)
      
      setIsLoadingTableData(false)
      expect(useAppStore.getState().isLoadingTableData).toBe(false)
    })
  })
})
