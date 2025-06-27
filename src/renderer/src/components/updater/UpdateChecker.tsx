import { Button, HStack, Text } from '@chakra-ui/react'
import { toaster } from '@renderer/ui/toaster'
import { useState } from 'react'
import { LuDownload, LuRefreshCw } from 'react-icons/lu'

export function UpdateChecker() {
  const [isChecking, setIsChecking] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<any>(null)

  const checkForUpdates = async () => {
    setIsChecking(true)
    try {
      const result = await window.api.checkForUpdates()
      if (result.success) {
        setUpdateAvailable(result.updateAvailable)
        setUpdateInfo(result)
        if (result.updateAvailable) {
          toaster.create({
            title: 'Update Available',
            description: `Version ${result.version} is available`,
            duration: 5000,
          })
        }
        else {
          toaster.create({
            title: 'No Updates',
            description: 'You are running the latest version',
            duration: 3000,
          })
        }
      }
      else {
        toaster.create({
          title: 'Update Check Failed',
          description: result.error,
          duration: 5000,
        })
      }
    }
    catch {
      toaster.create({
        title: 'Update Check Failed',
        description: 'Unable to check for updates',
        duration: 5000,
      })
    }
    finally {
      setIsChecking(false)
    }
  }

  const downloadAndInstall = async () => {
    setIsUpdating(true)
    try {
      const result = await window.api.downloadAndInstallUpdate()
      if (result.success) {
        toaster.create({
          title: 'Update Downloaded',
          description: 'The app will restart to complete the update',
          duration: 3000,
        })
      }
      else {
        toaster.create({
          title: 'Update Failed',
          description: result.error,
          duration: 5000,
        })
      }
    }
    catch {
      toaster.create({
        title: 'Update Failed',
        description: 'Unable to download update',
        duration: 5000,
      })
    }
    finally {
      setIsUpdating(false)
    }
  }

  return (
    <HStack gap={2}>
      <Button
        size="sm"
        variant="ghost"
        onClick={checkForUpdates}
        loading={isChecking}
        color="textSecondary"
        _hover={{ color: 'flipioPrimary', bg: 'bgTertiary' }}
      >
        <LuRefreshCw />
        {isChecking ? 'Checking...' : 'Check for Updates'}
      </Button>

      {updateAvailable && (
        <>
          <Text fontSize="sm" color="flipioPrimary">
            v
            {updateInfo?.version}
            {' '}
            available
          </Text>
          <Button
            size="sm"
            variant="solid"
            bg="flipioPrimary"
            color="white"
            onClick={downloadAndInstall}
            loading={isUpdating}
            _hover={{ bg: 'flipioSecondary' }}
          >
            <LuDownload />
            {isUpdating ? 'Updating...' : 'Update Now'}
          </Button>
        </>
      )}
    </HStack>
  )
}
