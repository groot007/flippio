import { fetchDatabaseFilesForSelection } from '@renderer/hooks/useDatabaseFiles'
import type { DatabaseFile, DeviceInfo } from '@renderer/types/devices'
import type { QueryClient } from '@tanstack/react-query'

interface ApplicationSelection {
  bundleId: string
  name: string
}

interface ResolveActiveDatabaseFileParams {
  databaseFile: DatabaseFile
  selectedDevice: DeviceInfo | null
  selectedApplication: ApplicationSelection | null
  queryClient?: QueryClient
  setSelectedDatabaseFile?: (file: DatabaseFile) => void
  forceRefresh?: boolean
}

function isMissingDatabaseFileError(error: Error) {
  return error.message.includes('Database file does not exist')
}

async function openDatabaseFile(candidatePath: string) {
  const response = await window.api.openDatabase(candidatePath)

  if (response === true) {
    return
  }

  if (!response?.success) {
    throw new Error(response?.error || 'Failed to open database')
  }
}

function findMatchingDatabaseFile(databaseFile: DatabaseFile, refreshedFiles: DatabaseFile[]) {
  return refreshedFiles.find(candidate =>
    (databaseFile.remotePath && candidate.remotePath === databaseFile.remotePath)
    || candidate.path === databaseFile.path
    || candidate.filename === databaseFile.filename,
  ) ?? null
}

export async function ensureActiveDatabaseFile({
  databaseFile,
  selectedDevice,
  selectedApplication,
  queryClient,
  setSelectedDatabaseFile,
  forceRefresh = false,
}: ResolveActiveDatabaseFileParams) {
  if (!databaseFile.path || databaseFile.deviceType === 'desktop') {
    return databaseFile
  }

  try {
    if (!forceRefresh) {
      await openDatabaseFile(databaseFile.path)
      return databaseFile
    }
  }
  catch (error) {
    const resolvedError = error instanceof Error ? error : new Error(String(error))

    if (
      !isMissingDatabaseFileError(resolvedError)
      || !selectedDevice?.id
      || !selectedApplication?.bundleId
    ) {
      throw resolvedError
    }

    console.warn('CriticalPath: selected temp database file missing, refetching database files', {
      missingPath: databaseFile.path,
      remotePath: databaseFile.remotePath ?? null,
      filename: databaseFile.filename,
    })

    const refreshedFiles = queryClient
      ? await queryClient.fetchQuery({
          queryKey: ['databaseFiles', selectedDevice.id, selectedApplication.bundleId],
          queryFn: () => fetchDatabaseFilesForSelection(selectedDevice, selectedApplication),
          staleTime: 0,
        })
      : await fetchDatabaseFilesForSelection(selectedDevice, selectedApplication)

    const matchedDatabaseFile = findMatchingDatabaseFile(databaseFile, refreshedFiles)

    if (!matchedDatabaseFile) {
      throw resolvedError
    }

    setSelectedDatabaseFile?.(matchedDatabaseFile)
    await openDatabaseFile(matchedDatabaseFile.path)

    return matchedDatabaseFile
  }

  if (
    !selectedDevice?.id
    || !selectedApplication?.bundleId
  ) {
    return databaseFile
  }

  console.warn('CriticalPath: forcing database file refresh for current selection', {
    stalePath: databaseFile.path,
    remotePath: databaseFile.remotePath ?? null,
    filename: databaseFile.filename,
  })

  const refreshedFiles = queryClient
    ? await queryClient.fetchQuery({
        queryKey: ['databaseFiles', selectedDevice.id, selectedApplication.bundleId],
        queryFn: () => fetchDatabaseFilesForSelection(selectedDevice, selectedApplication),
        staleTime: 0,
      })
    : await fetchDatabaseFilesForSelection(selectedDevice, selectedApplication)

  const matchedDatabaseFile = findMatchingDatabaseFile(databaseFile, refreshedFiles)

  if (!matchedDatabaseFile) {
    return databaseFile
  }

  setSelectedDatabaseFile?.(matchedDatabaseFile)
  await openDatabaseFile(matchedDatabaseFile.path)

  return matchedDatabaseFile
}
