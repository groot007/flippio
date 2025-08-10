import type { ChangeEvent } from '@renderer/types/changeHistory'
import type { ChangeHistoryPanelProps } from './types'

import { useChangeHistory, useClearAllChangeHistoryMutation } from '@renderer/features/change-history/hooks'
import { useCurrentDatabaseSelection } from '@renderer/features/database/stores'
import { useCurrentDeviceSelection } from '@renderer/features/devices/stores'
import { useColorMode } from '@renderer/ui/color-mode'

import { useQueryClient } from '@tanstack/react-query'

import { useState } from 'react'
import { ChangeHistoryPanelPresenter } from './ChangeHistoryPanelPresenter'

export function ChangeHistoryPanel({ isOpen, onClose }: ChangeHistoryPanelProps) {
  const { colorMode } = useColorMode()
  const isDark = colorMode === 'dark'
  const [selectedChange, setSelectedChange] = useState<ChangeEvent | null>(null)
  const queryClient = useQueryClient()
  
  const { selectedDevice, selectedApplication } = useCurrentDeviceSelection()
  const { selectedDatabaseFile } = useCurrentDatabaseSelection()
  
  const {
    data: changes = [],
    isLoading,
    error,
    refetch,
  } = useChangeHistory(50, 0)
  
  const clearHistoryMutation = useClearAllChangeHistoryMutation()

  const handleClearHistory = async () => {
    try {
      console.log('🧹 [UI] User confirmed - starting clear mutation...')
        
      const deviceId = selectedDevice?.id
      const packageName = selectedApplication?.bundleId || selectedDatabaseFile?.packageName
      const databasePath = selectedDatabaseFile?.path
        
      if (deviceId && packageName && databasePath) {
        queryClient.setQueryData(['changeHistory', deviceId, packageName, databasePath, 50, 0], [])
      }
        
      await clearHistoryMutation.mutateAsync()
        
      if (deviceId && packageName && databasePath) {
        queryClient.removeQueries({
          queryKey: ['changeHistory'],
        })
          
        queryClient.setQueryData(['changeHistory', deviceId, packageName, databasePath, 50, 0], [])
      }
        
      await refetch()        
    }
    catch (error) {
      console.error('🧹 [UI] Failed to clear history:', error)
    }
  }

  const handleRefresh = async () => {
    console.log('🔄 [UI] Refresh button clicked')
    try {
      console.log('🔄 [UI] Calling refetch...')
      const result = await refetch()
      console.log('🔄 [UI] Refetch result:', result)
    }
    catch (error) {
      console.error('🔄 [UI] Failed to refresh history:', error)
    }
  }

  const handleSelectChange = (change: ChangeEvent | null) => {
    setSelectedChange(selectedChange?.id === change?.id ? null : change)
  }

  return (
    <ChangeHistoryPanelPresenter
      isOpen={isOpen}
      onClose={onClose}
      changes={changes}
      isLoading={isLoading}
      error={error}
      selectedChange={selectedChange}
      isClearHistoryPending={clearHistoryMutation.isPending}
      isDark={isDark}
      selectedDevice={selectedDevice}
      selectedApplication={selectedApplication}
      selectedDatabaseFile={selectedDatabaseFile}
      onSelectChange={handleSelectChange}
      onClearHistory={handleClearHistory}
      onRefresh={handleRefresh}
    />
  )
}
