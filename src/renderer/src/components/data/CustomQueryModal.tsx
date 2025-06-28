import {

  Textarea,
} from '@chakra-ui/react'
import { useCurrentDatabaseSelection, useTableData } from '@renderer/store'
import { toaster } from '@renderer/ui/toaster'
import { useState } from 'react'
import FLModal from '../common/FLModal'

interface CustomQueryModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CustomQueryModal({ isOpen, onClose }: CustomQueryModalProps) {
  const [query, setQuery] = useState('')
  const { selectedDatabaseFile } = useCurrentDatabaseSelection()
  const setTableData = useTableData(state => state.setTableData)

  const handleExecute = async () => {
    if (!query.trim() || !selectedDatabaseFile?.path)
      return

    try {
      const result = await window.api.executeQuery(query, selectedDatabaseFile?.path)

      if (!result.success) {
        throw new Error(result.error || 'Failed to execute query')
      }

      setTableData({
        rows: result.rows || [],
        columns: result.columns || [],
        isCustomQuery: true,
        customQuery: query,
        tableName: 'Custom Query Result',
      })

      onClose()
    }
    catch (error: any) {
      toaster.create({
        title: 'Query error',
        description: error.message,
        type: 'error',
        duration: 5000,
      })
    }
  }

  return (
    <FLModal
      isOpen={isOpen}
      body={(
        <Textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="SELECT * FROM table_name WHERE condition"
          height="200px"
          fontFamily="monospace"
        />
      )}
      title="Run Query"
      acceptBtn="Run Query"
      onAccept={() => {
        handleExecute()
      }}

      rejectBtn="Cancel"
      onReject={() => {
        onClose()
      }}
    />
  )
}
