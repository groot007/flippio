export interface SubHeaderProps {
  selectedDevice: any
  selectedApplication: any
  selectedDatabaseFile: any
  selectedDatabaseTable: any
  databaseFiles: any[]
  databaseTables: any[]
  isLoading: boolean
  isRefreshing: boolean
  isQueryModalOpen: boolean
  isCustomQuery: boolean
  isDBPulling: boolean
  isNoDB: boolean
  isTableSelectDisabled: boolean
  
  onDatabaseFileChange: (file: any) => void
  onTableChange: (table: any) => void
  onRefresh: () => void
  onOpenFile: () => void
  onExportDB: () => void
  onOpenQueryModal: () => void
  onCloseQueryModal: () => void
  onClearCustomQuery: () => void
}
