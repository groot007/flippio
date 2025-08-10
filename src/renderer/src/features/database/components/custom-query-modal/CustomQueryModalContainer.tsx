import type { CustomQueryModalProps } from './types'

import { useChangeHistoryRefresh } from '@renderer/features/change-history/hooks'

import { useCurrentDatabaseSelection, useTableData } from '@renderer/features/database/stores'
import { toaster } from '@renderer/ui/toaster'
import { useCallback, useState } from 'react'

import { CustomQueryModalPresenter } from './CustomQueryModalPresenter'

/**
 * CustomQueryModalContainer - Business logic container for SQL query modal
 * 
 * Manages query state, database operations, and side effects.
 * Delegates UI rendering to CustomQueryModalPresenter.
 */
export const CustomQueryModalContainer: React.FC<CustomQueryModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('')
  const { selectedDatabaseFile } = useCurrentDatabaseSelection()
  const setTableData = useTableData(state => state.setTableData)
  const { refreshChangeHistory } = useChangeHistoryRefresh()

  const isDisabled = !query.trim() || !selectedDatabaseFile?.path

  const handleExecute = useCallback(async () => {
    if (isDisabled) 
      return

    try {
      const result = await window.api.executeQuery(query, selectedDatabaseFile!.path)

      if (!result.success) {
        throw new Error(result.error || 'Failed to execute query')
      }

      // Extract the actual data from the nested result structure
      const queryData = result.result || result

      setTableData({
        rows: queryData.rows || [],
        columns: queryData.columns || [],
        isCustomQuery: true,
        customQuery: query,
        tableName: 'Custom Query Result',
      })

      // Refresh change history if the query might have modified data
      const queryUpperCase = query.trim().toUpperCase()
      if (queryUpperCase.startsWith('INSERT') || queryUpperCase.startsWith('UPDATE') || queryUpperCase.startsWith('DELETE')) {
        refreshChangeHistory()
      }

      onClose()
    }
    catch (error: any) {
      console.error('CustomQueryModal - Query error:', error)
      toaster.create({
        title: 'Query error',
        description: error.message,
        type: 'error',
        duration: 5000,
      })
    }
  }, [query, selectedDatabaseFile, setTableData, refreshChangeHistory, onClose, isDisabled])

  return (
    <CustomQueryModalPresenter
      isOpen={isOpen}
      query={query}
      onQueryChange={setQuery}
      onExecute={handleExecute}
      onClose={onClose}
      isDisabled={isDisabled}
    />
  )
}
