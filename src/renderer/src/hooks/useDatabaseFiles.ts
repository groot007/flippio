import type { DatabaseFile } from '@renderer/types'
import { transformToCamelCase } from '@renderer/utils/caseTransformer'
import { useQuery } from '@tanstack/react-query'
import { listen } from '@tauri-apps/api/event'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface Device {
  id: string
  deviceType: 'iphone' | 'android' | 'desktop' | 'iphone-device' | 'emulator' | 'simulator'
}

interface Application {
  bundleId: string
  name: string
}

interface DatabaseFilesResponse {
  success: boolean
  files: DatabaseFile[]
  error?: string
}

interface IOSScanProgressPayload {
  scanKey: string
  scanRequestId: string
  mode: 'replace' | 'append'
  phase: string
  files: DatabaseFile[]
}

interface DatabaseFilesHookState {
  firstRoundComplete: boolean
}

function mergeDatabaseFiles(existing: DatabaseFile[], incoming: DatabaseFile[]) {
  const merged = [...existing]

  for (const file of incoming) {
    const index = merged.findIndex(candidate =>
      (file.remotePath && candidate.remotePath === file.remotePath)
      || candidate.path === file.path,
    )

    if (index >= 0) {
      merged[index] = file
    }
    else {
      merged.push(file)
    }
  }

  return merged
}

export async function fetchDatabaseFilesForSelection(
  selectedDevice: Device,
  selectedApplication: Application,
  scanRequestId?: string,
) {
  console.log('Fetching database files for device:', selectedDevice, 'and application:', selectedApplication)
  if (!selectedDevice?.id || !selectedApplication?.bundleId) {
    throw new Error('Device or application not selected')
  }

  console.log('Selected device:', selectedDevice)

  let fetchFunction: (deviceId: string, bundleId: string) => Promise<DatabaseFilesResponse>

  if (selectedDevice.deviceType === 'iphone-device') {
    fetchFunction = (deviceId, bundleId) => window.api.getIOSDeviceDatabaseFiles(deviceId, bundleId, scanRequestId)
  }
  else if (selectedDevice.deviceType.includes('simulator')) {
    console.log('Fetching iOS simulator database files_____')
    fetchFunction = window.api.getIOSSimulatorDatabaseFiles
  }
  else {
    fetchFunction = window.api.getAndroidDatabaseFiles
  }

  const response = await fetchFunction(selectedDevice.id, selectedApplication.bundleId)

  if (!response.success) {
    throw new Error(response.error || 'Failed to fetch database files')
  }

  return transformToCamelCase(response.files)
}

export function useDatabaseFiles(
  selectedDevice: Device | null,
  selectedApplication: Application | null,
) {
  const [streamedFiles, setStreamedFiles] = useState<DatabaseFile[]>([])
  const [activeScanRequestId, setActiveScanRequestId] = useState<string | null>(null)
  const [scanState, setScanState] = useState<DatabaseFilesHookState>({
    firstRoundComplete: false,
  })
  const activeScanRequestIdRef = useRef<string | null>(null)
  const previousScanKeyRef = useRef<string | null>(null)

  const createScanRequestId = useCallback((nextScanKey: string) => {
    return `${nextScanKey}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`
  }, [])

  useEffect(() => {
    setStreamedFiles([])
    setScanState({
      firstRoundComplete: false,
    })
  }, [selectedDevice?.id, selectedApplication?.bundleId])

  const scanKey = useMemo(() => {
    if (selectedDevice?.deviceType !== 'iphone-device' || !selectedDevice.id || !selectedApplication?.bundleId) {
      return null
    }

    return `${selectedDevice.id}:${selectedApplication.bundleId}`
  }, [selectedApplication?.bundleId, selectedDevice?.deviceType, selectedDevice?.id])

  useEffect(() => {
    const previousScanKey = previousScanKeyRef.current

    if (
      previousScanKey
      && previousScanKey !== scanKey
      && window.api.cancelIOSDeviceDatabaseScan
    ) {
      void window.api.cancelIOSDeviceDatabaseScan(previousScanKey).catch((error) => {
        console.warn('Failed to cancel previous iOS database scan:', error)
      })
    }

    previousScanKeyRef.current = scanKey

    if (!scanKey) {
      activeScanRequestIdRef.current = null
      setActiveScanRequestId(null)
      return
    }

    const nextScanRequestId = createScanRequestId(scanKey)
    activeScanRequestIdRef.current = nextScanRequestId
    setActiveScanRequestId(nextScanRequestId)
  }, [createScanRequestId, scanKey])

  useEffect(() => {
    if (!scanKey) {
      return
    }

    let isMounted = true
    let unlistenPromise: Promise<() => void> | null = null

    unlistenPromise = listen<IOSScanProgressPayload>('ios-db-scan-progress', (event) => {
      if (
        !isMounted
        || event.payload.scanKey !== scanKey
        || event.payload.scanRequestId !== activeScanRequestIdRef.current
      ) {
        return
      }

      const incomingFiles = transformToCamelCase(event.payload.files ?? []) as DatabaseFile[]

      if (event.payload.phase === 'documents-root') {
        setScanState(() => ({
          firstRoundComplete: true,
        }))
      }

      setStreamedFiles((currentFiles) => {
        if (event.payload.mode === 'replace') {
          return incomingFiles
        }

        return mergeDatabaseFiles(currentFiles, incomingFiles)
      })
    })

    return () => {
      isMounted = false
      if (unlistenPromise) {
        void unlistenPromise.then(unlisten => unlisten())
      }
    }
  }, [scanKey])

  const query = useQuery({
    queryKey: ['databaseFiles', selectedDevice?.id, selectedApplication?.bundleId],
    queryFn: () => fetchDatabaseFilesForSelection(
      selectedDevice as Device,
      selectedApplication as Application,
      activeScanRequestIdRef.current ?? undefined,
    ),
    enabled: !!selectedDevice?.id && !!selectedApplication?.bundleId && (!scanKey || !!activeScanRequestId),
    gcTime: 0,
    staleTime: 0,
    retry: 1,
  })

  const refetch = useCallback(async () => {
    if (selectedDevice?.deviceType === 'iphone-device') {
      if (scanKey && window.api.cancelIOSDeviceDatabaseScan) {
        await window.api.cancelIOSDeviceDatabaseScan(scanKey).catch((error) => {
          console.warn('Failed to cancel iOS database scan before restart:', error)
        })
      }

      const nextScanRequestId = scanKey ? createScanRequestId(scanKey) : null
      activeScanRequestIdRef.current = nextScanRequestId
      setActiveScanRequestId(nextScanRequestId)
      setStreamedFiles([])
      setScanState({
        firstRoundComplete: false,
      })
    }

    return query.refetch()
  }, [createScanRequestId, query, scanKey, selectedDevice?.deviceType])

  const isIosDeviceScan = selectedDevice?.deviceType === 'iphone-device'
  const isScanFetching = query.isFetching

  const data = useMemo(() => {
    if (isIosDeviceScan && isScanFetching) {
      return streamedFiles
    }

    if (query.data && streamedFiles.length > 0) {
      return mergeDatabaseFiles(query.data, streamedFiles)
    }

    if (query.data) {
      return query.data
    }

    return streamedFiles
  }, [isIosDeviceScan, isScanFetching, query.data, streamedFiles])

  const isFirstRoundLoading = isIosDeviceScan
    ? isScanFetching && !scanState.firstRoundComplete
    : isScanFetching
  const isBackgroundScanning = isIosDeviceScan
    ? isScanFetching && scanState.firstRoundComplete
    : false
  const isLoading = isFirstRoundLoading
  const isScanComplete = !isScanFetching

  return {
    ...query,
    data,
    isFirstRoundLoading,
    isBackgroundScanning,
    isScanComplete,
    isLoading,
    refetch,
  }
}
