export interface DatabaseContext {
  deviceId: string
  deviceName: string
  deviceType: string
  packageName: string
  appName: string
  databasePath: string
}

export interface ChangeHistoryContext {
  selectedDevice: any
  selectedApplication: any
  selectedDatabaseFile: any
  selectedDatabaseTable?: any
}

export interface MutationContext extends ChangeHistoryContext {
  selectedRow?: any
  tableColumns?: any[]
}

export interface FieldChange {
  fieldName: string
  oldValue: any
  newValue: any
  dataType: string
}

export interface ChangeEvent {
  id: string
  timestamp: string
  contextKey: string
  databasePath: string
  databaseFilename: string
  tableName: string
  operationType: 
    | 'Insert' 
    | 'Update' 
    | 'Delete' 
    | 'Clear'
    | { BulkInsert: { count: number } }
    | { BulkUpdate: { count: number } }
    | { BulkDelete: { count: number } }
    | { Revert: { original_change_id: string; cascade_reverted_ids: string[] } }
  userContext: {
    deviceId: string
    deviceName: string
    deviceType: string
    appPackage: string
    appName: string
    sessionId: string
  }
  changes: FieldChange[]
  rowIdentifier?: string
  metadata: {
    affectedRows: number
    executionTimeMs: number
    sqlStatement?: string
    originalRemotePath?: string
    pullTimestamp: string
  }
}

export interface ContextSummary {
  contextKey: string
  deviceName: string
  appName: string
  databaseFilename: string
  totalChanges: number
  lastChangeTime?: string
}

export type OperationType = ChangeEvent['operationType']
