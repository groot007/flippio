import type { DatabaseFile } from '@renderer/types'
import { useSqlcipherUnlock } from '@renderer/store/useSqlcipherUnlock'

export class SqlcipherKeyRequiredError extends Error {
  constructor(public databaseFile: DatabaseFile, message = 'SQLCipher key required') {
    super(message)
    this.name = 'SqlcipherKeyRequiredError'
  }
}

type DatabaseKeySource = Pick<DatabaseFile, 'deviceId' | 'filename' | 'packageName' | 'path' | 'remotePath'>

export function getDatabaseKeyIdentifier(databaseFile: DatabaseKeySource) {
  return [
    databaseFile.deviceId || 'local',
    databaseFile.packageName || 'local',
    databaseFile.remotePath || databaseFile.path || databaseFile.filename,
  ].join('::')
}

export function getRememberedDatabaseKey(databaseFile: DatabaseKeySource) {
  const identifier = getDatabaseKeyIdentifier(databaseFile)
  return useSqlcipherUnlock.getState().keyByIdentifier[identifier]
}

export function rememberDatabaseKey(
  databaseFile: DatabaseKeySource,
  key: string,
) {
  useSqlcipherUnlock.getState().rememberKey(getDatabaseKeyIdentifier(databaseFile), key)
}

export function forgetDatabaseKey(databaseFile: DatabaseKeySource) {
  useSqlcipherUnlock.getState().forgetKey(getDatabaseKeyIdentifier(databaseFile))
}

export async function ensureDatabaseUnlocked(databaseFile: DatabaseFile) {
  const key = getRememberedDatabaseKey(databaseFile)
  const response = await window.api.openDatabase(databaseFile.path, key)

  if (response.success) {
    return response
  }

  if (response.requiresKey) {
    if (key) {
      forgetDatabaseKey(databaseFile)
    }
    throw new SqlcipherKeyRequiredError(databaseFile, response.error)
  }

  throw new Error(response.error || 'Failed to open database')
}
