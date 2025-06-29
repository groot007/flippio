import { invoke } from '@tauri-apps/api/core'
import { useCallback, useState } from 'react'

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
  checkForUpdates: () => Promise<{
    success: boolean
    data?: {
      available: boolean
      version?: string
      notes?: string
      date?: string
    }
    error?: string
  }>
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
      // Use Tauri's invoke to call the check_for_updates command
      const result = await invoke<{
        success: boolean
        data?: {
          available: boolean
          version?: string
          notes?: string
          date?: string
        }
        error?: string
      }>('check_for_updates')

      if (result.success && result.data) {
        const updateData: UpdateInfo = {
          available: result.data.available,
          version: result.data.version,
          releaseNotes: result.data.notes,
          releaseDate: result.data.date,
        }
        setUpdateInfo(updateData)
        return result
      }
      else {
        console.warn('Update check failed:', result.error)
        setError(result.error || 'Failed to check for updates')
        return result
      }
    }
    catch (err) {
      console.warn('Update check error:', err)
      setError(err instanceof Error ? err.message : 'Failed to check for updates')
      throw err
    }
    finally {
      setIsChecking(false)
    }
  }, [])

  const downloadAndInstall = useCallback(async () => {
    setIsDownloading(true)
    setError(null)

    try {
      // Use Tauri's invoke to call the download_and_install_update command
      const result = await invoke<{
        success: boolean
        error?: string
      }>('download_and_install_update')

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

  return {
    updateInfo,
    isChecking,
    isDownloading,
    checkForUpdates,
    downloadAndInstall,
    error,
  }
}
