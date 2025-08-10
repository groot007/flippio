import type { SettingsProps } from './types'
import { useAutoUpdater } from '@renderer/shared/hooks'
import { toaster } from '@renderer/ui/toaster'
import { useCallback, useEffect } from 'react'
import packageJSON from '../../../../../../../package.json' with { type: 'json' }
import { SettingsPresenter } from './SettingsPresenter'

export function SettingsContainer(_props: SettingsProps) {
  const { isChecking, checkForUpdates, downloadAndInstall } = useAutoUpdater()

  const handleCheckForUpdates = useCallback(async () => {
    try {
      const result = await checkForUpdates()

      if (result.error) {
        toaster.create({
          title: 'Update Check Failed',
          description: result.error,
          type: 'error',
          duration: 5000,
        })
      }
      else if (result?.data?.available) {
        toaster.create({
          title: 'Update Available',
          description: `Version ${result.data.version} is available!`,
          type: 'success',
          duration: 5000,
          action: {
            label: 'Install Now',
            onClick: downloadAndInstall,
          },
        })
      }
      else {
        toaster.create({
          title: 'No Updates',
          description: 'You are running the latest version.',
          type: 'info',
          duration: 3000,
        })
      }
    }
    catch {
      toaster.create({
        title: 'Update Check Failed',
        description: 'Unable to check for updates. Please try again later.',
        type: 'error',
        duration: 5000,
      })
    }
  }, [checkForUpdates, downloadAndInstall])

  useEffect(() => {
    setTimeout(() => {
      checkForUpdates().then((rez) => {
        if (rez.data?.available) {
          toaster.create({
            title: 'Update Available',
            description: `Version ${rez.data.version} is available!`,
            type: 'success',
            duration: 5000,
            action: {
              label: 'Install Now',
              onClick: downloadAndInstall,
            },
          })
        }
      })
    }, 5000)
  }, [checkForUpdates, downloadAndInstall])

  return (
    <SettingsPresenter
      version={packageJSON.version}
      isChecking={isChecking}
      onCheckForUpdates={handleCheckForUpdates}
    />
  )
}
