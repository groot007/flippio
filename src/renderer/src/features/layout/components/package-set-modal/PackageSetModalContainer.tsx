import type { PackageSetModalProps } from './types'

import { useCurrentDeviceSelection } from '@renderer/features/devices/stores'

import { toaster } from '@renderer/ui/toaster'
import { useCallback, useEffect, useState } from 'react'

import { PackageSetModalPresenter } from './PackageSetModalPresenter'

const RECENT_BUNDLE_IDS_KEY = 'flippio_recent_bundle_ids'
const MAX_RECENT_IDS = 3

/**
 * Get recent bundle IDs from localStorage
 */
function getRecentBundleIds(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_BUNDLE_IDS_KEY)
    return stored ? JSON.parse(stored) : []
  }
  catch {
    return []
  }
}

/**
 * Add a bundle ID to the recent list
 */
function addRecentBundleId(bundleId: string): void {
  if (!bundleId.trim())
    return

  try {
    const recent = getRecentBundleIds()

    // Remove if already exists (to move to top)
    const filtered = recent.filter(id => id !== bundleId)

    // Add to beginning and keep only the most recent entries
    const updated = [bundleId, ...filtered].slice(0, MAX_RECENT_IDS)

    localStorage.setItem(RECENT_BUNDLE_IDS_KEY, JSON.stringify(updated))
  }
  catch (error) {
    console.error('Failed to save recent bundle ID:', error)
  }
}

/**
 * PackageSetModalContainer - Business logic container for package bundle ID setting modal
 * 
 * Manages bundle ID state, localStorage operations, and device selection.
 * Delegates UI rendering to PackageSetModalPresenter.
 */
export const PackageSetModalContainer: React.FC<PackageSetModalProps> = ({ 
  isOpen, 
  isLoading, 
  onClose, 
  onPackageSet, 
}) => {
  const setSelectedApplication = useCurrentDeviceSelection(state => state.setSelectedApplication)
  const selectedDevice = useCurrentDeviceSelection(state => state.selectedDevice)

  const [recentBundleIds, setRecentBundleIds] = useState<string[]>([])
  const [bundleIDInput, setBundleIdInput] = useState('')

  const handleBundleIdChange = useCallback(async () => {
    if (!selectedDevice?.id) {
      toaster.create({
        title: 'Error',
        description: 'No device selected',
        type: 'error',
      })
      return
    }

    addRecentBundleId(bundleIDInput)

    setSelectedApplication({
      bundleId: bundleIDInput,
      name: bundleIDInput,
      // @ts-expect-error selectedDevice
      label: bundleIDInput,
      value: bundleIDInput,
      description: bundleIDInput,
    })

    onPackageSet()
  }, [selectedDevice, bundleIDInput, setSelectedApplication, onPackageSet])

  const selectRecentBundleId = useCallback((bundleId: string) => {
    setBundleIdInput(bundleId)
  }, [])

  useEffect(() => {
    setRecentBundleIds(getRecentBundleIds())
  }, [])

  return (
    <PackageSetModalPresenter
      isOpen={isOpen}
      isLoading={isLoading}
      bundleIDInput={bundleIDInput}
      recentBundleIds={recentBundleIds}
      onBundleIdChange={setBundleIdInput}
      onSelectRecentBundleId={selectRecentBundleId}
      onAccept={handleBundleIdChange}
      onReject={onClose}
    />
  )
}
