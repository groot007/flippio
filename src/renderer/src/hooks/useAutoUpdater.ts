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
      // Check if window.api is available (might not be in dev mode or browser)
      if (!window.api || !window.api.checkForUpdates) {
        console.warn('Auto-updater not available in this environment')
        setError('Auto-updater not available')
        return
      }

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
        console.warn('Update check failed:', result.error)
        setError(result.error || 'Failed to check for updates')
      }
    }
    catch (err) {
      console.warn('Update check error:', err)
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
      // Check if window.api is available
      if (!window.api || !window.api.downloadAndInstallUpdate) {
        console.warn('Auto-updater not available in this environment')
        setError('Auto-updater not available')
        return
      }

      const result = await window.api.downloadAndInstallUpdate()

      if (!result.success) {
        console.warn('Update download failed:', result.error)
        setError(result.error || 'Failed to download and install update')
      }
      // If successful, the app will restart automatically
    }
    catch (err) {
      console.warn('Update download error:', err)
      setError(err instanceof Error ? err.message : 'Failed to download and install update')
    }
    finally {
      setIsDownloading(false)
    }
  }, [])

  // Check for updates on app start (only in Tauri environment)
  useEffect(() => {
    // Only check for updates if we're in a Tauri environment
    const isProduction = import.meta.env.PROD
    const isTauri = typeof window !== 'undefined' && window.api && typeof window.api.checkForUpdates === 'function'

    if (!isProduction || !isTauri) {
      console.log('Skipping auto-update check in development/browser mode')
      return
    }

    const timeoutId = setTimeout(() => {
      console.log('Starting auto-update check...')
      checkForUpdates()
    }, 5000) // Wait 5 seconds after app start

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
