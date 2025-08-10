import { useDatabaseFiles, useDatabaseTables, useTableDataQuery } from '@renderer/features/database/hooks'
import { useCurrentDatabaseSelection, useTableData } from '@renderer/features/database/stores'
import { useCurrentDeviceSelection } from '@renderer/features/devices/stores'
import { useDatabaseRefresh } from '@renderer/shared/utils/databaseRefresh'
import { toaster } from '@renderer/ui/toaster'
import { useCallback, useEffect, useState } from 'react'

import { SubHeaderPresenter } from './SubHeaderPresenter'

export function SubHeaderContainer() {
  const selectedDevice = useCurrentDeviceSelection(state => state.selectedDevice)
  const selectedApplication = useCurrentDeviceSelection(state => state.selectedApplication)
  const setSelectedDevice = useCurrentDeviceSelection(state => state.setSelectedDevice)
  const setSelectedApplication = useCurrentDeviceSelection(state => state.setSelectedApplication)
  const {
    setTableData,
  } = useTableData()
  const tableDataStore = useTableData()
  const selectedDatabaseFile = useCurrentDatabaseSelection(state => state.selectedDatabaseFile)
  const setSelectedDatabaseFile = useCurrentDatabaseSelection(state => state.setSelectedDatabaseFile)
  const selectedDatabaseTable = useCurrentDatabaseSelection(state => state.selectedDatabaseTable)
  const setSelectedDatabaseTable = useCurrentDatabaseSelection(state => state.setSelectedDatabaseTable)

  const [isQueryModalOpen, setIsQueryModalOpen] = useState(false)
  const [isSettingCustomFile, setIsSettingCustomFile] = useState(false)

  // Handle custom file setting with proper sequencing
  useEffect(() => {
    if (isSettingCustomFile && selectedDatabaseFile?.deviceType === 'desktop' && selectedDatabaseFile?.packageName === '') {
      console.log('🔧 [SubHeader] Custom file detected, clearing device/application selections')
      setSelectedDevice(null)
      setSelectedApplication(null)
      
      setTimeout(() => {
        setIsSettingCustomFile(false)
        console.log('🔧 [SubHeader] Custom file setup complete')
      }, 100)
    }
  }, [selectedDatabaseFile, isSettingCustomFile, setSelectedDevice, setSelectedApplication])

  const {
    data: databaseFiles = [],
    isLoading,
  } = useDatabaseFiles(selectedDevice, selectedApplication)

  const { data: tableData, refetch: refetchTable } = useTableDataQuery(selectedDatabaseTable?.name || '')

  useEffect(() => {
    if (tableData && (!tableDataStore.tableData || !tableDataStore.tableData.isCustomQuery)) {
      setTableData({
        rows: tableData.rows,
        columns: tableData.columns,
        isCustomQuery: false,
        tableName: selectedDatabaseTable?.name,
      })
    }
  }, [tableData, selectedDatabaseTable?.name, setTableData])

  const isDBPulling = !!selectedApplication?.bundleId && !!selectedDevice?.id && isLoading

  const {
    data: tablesData,
    isError,
  } = useDatabaseTables(selectedDatabaseFile, selectedDevice)

  useEffect(() => {
    if (isError) {
      toaster.create({
        title: 'Error fetching database tables',
        description: 'Failed to fetch tables for the selected database file.',
        type: 'error',
        duration: 3000,
      })
    }
  }, [isError])

  const databaseTables = tablesData?.tables

  const handleDatabaseFileChange = useCallback(async (file: any) => {
    if (file?.path) {
      try {
        await window.api.switchDatabase(file.path)
        console.log('Database switch cleanup completed for:', file.path)
      }
      catch (error) {
        console.warn('Database switch cleanup failed (non-critical):', error)
      }
    }
    
    setSelectedDatabaseFile(file)
    setSelectedDatabaseTable(null)
  }, [setSelectedDatabaseFile, setSelectedDatabaseTable])

  const handleTableChange = useCallback((table: any) => {    
    if (table) {
      setTableData({
        rows: [],
        columns: [],
        isCustomQuery: false,
        tableName: table.name,
      })
    }
    
    setSelectedDatabaseTable(table)
  }, [setSelectedDatabaseTable, setTableData])

  const handleClearCustomQuery = useCallback(() => {
    if (!selectedDatabaseTable) 
      return
    refetchTable()
    tableDataStore.setTableData({
      rows: [],
      columns: [],
      isCustomQuery: false,
      customQuery: '',
      tableName: selectedDatabaseTable.name,
    })
  }, [selectedDatabaseTable, tableDataStore, refetchTable])

  useEffect(() => {
    if (!selectedDatabaseFile?.filename) {
      setSelectedDatabaseTable(null)
    }
  }, [selectedDatabaseFile])

  const { refresh: handleDBRefresh, isLoading: isRefreshing } = useDatabaseRefresh()

  const onRefreshClick = useCallback(async () => {
    await handleDBRefresh()
  }, [handleDBRefresh])

  const isNoDB = !databaseFiles?.length && !isDBPulling && !!selectedApplication?.bundleId && !!selectedDevice?.id

  const handleOpenDBFile = useCallback(() => {
    window.api.openFile().then((file) => {
      if (!file.canceled && file.filePaths.length) {
        const filePath = file.filePaths[0]

        setIsSettingCustomFile(true)
        console.log('🔧 [SubHeader] Setting custom file:', filePath)

        setSelectedDatabaseFile({
          path: filePath,
          filename: filePath.split('/').pop() || '',
          deviceType: 'desktop',
          packageName: '',
          remotePath: filePath,
          location: filePath,
        })
      }
    })
  }, [setSelectedDatabaseFile])

  const handleExportDB = useCallback(() => {
    if (!selectedDatabaseFile?.path) {
      return
    }

    window.api.exportFile({
      defaultPath: selectedDatabaseFile?.filename,
      filters: [
        {
          name: selectedDatabaseFile?.filename || 'Database',
          extensions: ['db', 'sqlite'],
        },
      ],
      dbFilePath: selectedDatabaseFile.path,
    }).then((savedFilePath) => {
      if (!savedFilePath) {
        return
      }
      toaster.create({
        title: 'Success',
        description: `Database file exported successfully to ${savedFilePath}`,
        type: 'success',
      })
    }).catch((error) => {
      toaster.create({
        title: 'Error exporting database',
        description: error.message,
        type: 'error',
      })
    })
  }, [selectedDatabaseFile])

  const isTableSelectDisabled = (!selectedApplication?.bundleId && selectedDatabaseFile?.deviceType !== 'desktop') || !selectedDatabaseFile?.path || isDBPulling

  return (
    <SubHeaderPresenter
      selectedDevice={selectedDevice}
      selectedApplication={selectedApplication}
      selectedDatabaseFile={selectedDatabaseFile}
      selectedDatabaseTable={selectedDatabaseTable}
      databaseFiles={databaseFiles}
      databaseTables={databaseTables}
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      isQueryModalOpen={isQueryModalOpen}
      isCustomQuery={tableDataStore.tableData?.isCustomQuery || false}
      isDBPulling={isDBPulling}
      isNoDB={isNoDB}
      isTableSelectDisabled={isTableSelectDisabled}
      onDatabaseFileChange={handleDatabaseFileChange}
      onTableChange={handleTableChange}
      onRefresh={onRefreshClick}
      onOpenFile={handleOpenDBFile}
      onExportDB={handleExportDB}
      onOpenQueryModal={() => setIsQueryModalOpen(true)}
      onCloseQueryModal={() => setIsQueryModalOpen(false)}
      onClearCustomQuery={handleClearCustomQuery}
    />
  )
}
