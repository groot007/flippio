import type { ChangeHistoryContext, DatabaseContext } from '@renderer/types/changeHistory'

/**
 * Builds database context parameters from app state
 */
export function buildDatabaseContext(context: ChangeHistoryContext): DatabaseContext | null {
  const { selectedDevice, selectedApplication, selectedDatabaseFile } = context
  
  if (!selectedDevice?.id || !selectedApplication?.bundleId || !selectedDatabaseFile?.path) {
    return null
  }
  
  return {
    deviceId: selectedDevice.id,
    deviceName: selectedDevice.name,
    deviceType: selectedDevice.type,
    packageName: selectedApplication.bundleId,
    appName: selectedApplication.name,
    databasePath: selectedDatabaseFile.path,
  }
}

/**
 * Validates that all required context parameters are present
 */
export function validateDatabaseContext(context: ChangeHistoryContext): boolean {
  const dbContext = buildDatabaseContext(context)
  return dbContext !== null
}

/**
 * Extracts database context parameters as individual values for API calls
 */
export function extractContextParams(context: ChangeHistoryContext) {
  const dbContext = buildDatabaseContext(context)
  
  if (!dbContext) {
    return {
      deviceId: undefined,
      deviceName: undefined,
      deviceType: undefined,
      packageName: undefined,
      appName: undefined,
      databasePath: undefined,
    }
  }
  
  return {
    deviceId: dbContext.deviceId,
    deviceName: dbContext.deviceName,
    deviceType: dbContext.deviceType,
    packageName: dbContext.packageName,
    appName: dbContext.appName,
    databasePath: dbContext.databasePath,
  }
}
