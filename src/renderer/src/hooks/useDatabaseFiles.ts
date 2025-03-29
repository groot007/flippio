import type { DatabaseFile } from '@renderer/types'
import { useEffect, useState } from 'react'

export function useDatabaseFiles(selectedDevice, selectedApplication) {
  const [databaseFiles, setDatabaseFiles] = useState<DatabaseFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchDatabaseFiles() {
      if (!selectedDevice?.id || !selectedApplication?.bundleId)
        return

      setIsLoading(true)
      setError(null)

      try {
        const fetchFunction = selectedDevice?.deviceType === 'iphone'
          ? window.api.getIOSDatabaseFiles
          : window.api.getAndroidDatabaseFiles

        const response = await fetchFunction(selectedDevice.id, selectedApplication.bundleId)

        if (response.success) {
          setDatabaseFiles(response.files)
        }
        else {
          setError(response.error || 'Failed to fetch database files')
        }
      }
      catch (err) {
        setError(err.message)
      }
      finally {
        setIsLoading(false)
      }
    }

    fetchDatabaseFiles()
  }, [selectedDevice, selectedApplication])

  return { databaseFiles, isLoading, error }
}
