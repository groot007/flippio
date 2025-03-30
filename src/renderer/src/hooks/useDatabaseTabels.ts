import type { DatabaseTable } from '@renderer/types'
import { useCurrentDatabaseSelection } from '@renderer/store'
import { useEffect, useState } from 'react'

export function useDatabaseTables(selectedDatabaseFile, selectedDevice) {
  const [tables, setTables] = useState<DatabaseTable[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const setPulledDatabaseFilePath = useCurrentDatabaseSelection(state => state.setPulledDatabaseFilePath)

  useEffect(() => {
    async function fetchTables() {
      if (!selectedDatabaseFile?.path)
        return

      setIsLoading(true)
      setError(null)

      try {
        let dbPath = selectedDatabaseFile.path

        if (selectedDatabaseFile?.deviceType !== 'iphone') {
          const pull = await window.api.pullDatabaseFile(selectedDevice.id, selectedDatabaseFile.path)
          if (!pull.success) {
            throw new Error(pull.error || 'Failed to pull database file')
          }
          dbPath = pull.path
        }

        setPulledDatabaseFilePath(dbPath)

        await window.api.openDatabase(dbPath)
        const response = await window.api.getTables()

        if (response.success) {
          setTables(response.tables)
        }
        else {
          setError(response.error || 'Failed to fetch tables')
        }
      }
      catch (err: any) {
        setError(err.message)
      }
      finally {
        setIsLoading(false)
      }
    }

    fetchTables()
  }, [selectedDatabaseFile, selectedDevice])

  return { tables, isLoading, error }
}
