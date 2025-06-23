import { useCallback, useEffect, useState } from 'react'

interface UpdateInfo {
  available: boolean
  version?: string
  releaseNotes?: string
  releaseDate?: string
}

interface UseAutoUpdaterReturn {
  updateInfo: UpdateInfo | null
  isChecking: boolean
  isDownloading: boolean
  checkForUpdates: () => Promise<void>
  downloadAndInstall: () => Promise<void>
  error: string | null
}

export function useAutoUpdater(): UseAutoUpdaterReturn {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkForUpdates = useCallback(async () => {
    setIsChecking(true)
    setError(null)

    try {
      const result = await window.api.checkForUpdates()

      if (result.success) {
        setUpdateInfo({
          available: result.updateAvailable,
          version: result.version,
          releaseNotes: result.releaseNotes,
          releaseDate: result.releaseDate,
        })
      }
      else {
        setError(result.error || 'Failed to check for updates')
      }
    }
    catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check for updates')
    }
    finally {
      setIsChecking(false)
    }
  }, [])

  const downloadAndInstall = useCallback(async () => {
    setIsDownloading(true)
    setError(null)

    try {
      const result = await window.api.downloadAndInstallUpdate()

      if (!result.success) {
        setError(result.error || 'Failed to download and install update')
      }
      // If successful, the app will restart automatically
    }
    catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download and install update')
    }
    finally {
      setIsDownloading(false)
    }
  }, [])

  // Check for updates on app start
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      checkForUpdates()
    }, 3000) // Wait 3 seconds after app start

    return () => clearTimeout(timeoutId)
  }, [checkForUpdates])

  return {
    updateInfo,
    isChecking,
    isDownloading,
    checkForUpdates,
    downloadAndInstall,
    error,
  }
}
