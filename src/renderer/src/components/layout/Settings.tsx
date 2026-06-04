import { Box, Button, HStack, Link, Menu, Portal, Text, VStack } from '@chakra-ui/react'
import FLModal from '@renderer/components/common/FLModal'
import { useAutoUpdater } from '@renderer/hooks/useAutoUpdater'
import { ColorModeSwitcher } from '@renderer/ui/color-mode'
import { toaster } from '@renderer/ui/toaster'
import { useEffect, useMemo, useState } from 'react'
import { LuDownload, LuExternalLink, LuGithub, LuRefreshCw, LuSettings } from 'react-icons/lu'
import packageJSON from '../../../../../package.json' with { type: 'json' }

const PENDING_UPDATE_STORAGE_KEY = 'flippio.pending-update-changelog'

interface PendingUpdatePayload {
  version?: string
  notes?: string
}

function sanitizeReleaseNotes(notes?: string) {
  return notes?.trim() || 'Minor fixes and improvements.'
}

function getStoredPendingUpdate(): PendingUpdatePayload | null {
  try {
    const rawValue = window.localStorage.getItem(PENDING_UPDATE_STORAGE_KEY)
    if (!rawValue) {
      return null
    }

    const parsed = JSON.parse(rawValue) as PendingUpdatePayload
    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    return parsed
  }
  catch {
    return null
  }
}

function setStoredPendingUpdate(payload: PendingUpdatePayload) {
  window.localStorage.setItem(PENDING_UPDATE_STORAGE_KEY, JSON.stringify(payload))
}

function clearStoredPendingUpdate() {
  window.localStorage.removeItem(PENDING_UPDATE_STORAGE_KEY)
}

export function Settings() {
  const { isChecking, isDownloading, checkForUpdates, downloadAndInstall } = useAutoUpdater()
  const [availableUpdateModal, setAvailableUpdateModal] = useState<PendingUpdatePayload | null>(null)
  const [installedUpdateModal, setInstalledUpdateModal] = useState<PendingUpdatePayload | null>(null)

  const releaseNotesBody = useMemo(() => {
    const modalState = installedUpdateModal || availableUpdateModal
    const notes = sanitizeReleaseNotes(modalState?.notes)

    return (
      <VStack align="stretch" gap={4}>
        {modalState?.version && (
          <Text fontWeight="medium">
            Version
            {' '}
            {modalState.version}
          </Text>
        )}
        <Box
          bg="bgSecondary"
          border="1px solid"
          borderColor="borderSecondary"
          borderRadius="md"
          px={4}
          py={3}
          whiteSpace="pre-wrap"
          fontSize="sm"
          lineHeight="1.6"
        >
          {notes}
        </Box>
      </VStack>
    )
  }, [availableUpdateModal, installedUpdateModal])

  const openAvailableUpdateModal = (version?: string, notes?: string) => {
    setAvailableUpdateModal({
      version,
      notes: sanitizeReleaseNotes(notes),
    })
  }

  const handleCheckForUpdates = async () => {
    try {
      const result = await checkForUpdates()

      // The updateInfo will be automatically updated via the hook
      // Show appropriate message based on the result
      if (result.error) {
        toaster.create({
          title: 'Update Check Failed',
          description: result.error,
          type: 'error',
          duration: 5000,
        })
      }
      else if (result?.data?.available) {
        openAvailableUpdateModal(result.data.version, result.data.notes)
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
  }

  const handleExportLogs = async () => {
    try {
      console.info('CriticalPath: log export started')
      const exportedPath = await window.api.exportLogs()

      if (!exportedPath) {
        console.info('CriticalPath: log export canceled')
        return
      }

      console.info('CriticalPath: log export completed', {
        exportedPath,
      })
      toaster.create({
        title: 'Logs Exported',
        description: `Saved logs to ${exportedPath}`,
        type: 'success',
        duration: 5000,
      })
    }
    catch {
      console.error('CriticalPath: log export failed')
      toaster.create({
        title: 'Export Failed',
        description: 'Unable to export logs. Please try again later.',
        type: 'error',
        duration: 5000,
      })
    }
  }

  const handleInstallUpdate = async () => {
    if (!availableUpdateModal) {
      return
    }

    try {
      setStoredPendingUpdate(availableUpdateModal)
      await downloadAndInstall()
    }
    catch {
      clearStoredPendingUpdate()
      toaster.create({
        title: 'Update Failed',
        description: 'Unable to download and install the update. Please try again later.',
        type: 'error',
        duration: 5000,
      })
    }
  }

  useEffect(() => {
    const pendingUpdate = getStoredPendingUpdate()
    if (pendingUpdate?.version && pendingUpdate.version === packageJSON.version) {
      setInstalledUpdateModal({
        version: pendingUpdate.version,
        notes: sanitizeReleaseNotes(pendingUpdate.notes),
      })
      clearStoredPendingUpdate()
    }
    else if (pendingUpdate) {
      clearStoredPendingUpdate()
    }

    setTimeout(() => {
      checkForUpdates().then((rez) => {
        if (rez.data?.available) {
          openAvailableUpdateModal(rez.data.version, rez.data.notes)
        }
      })
    }, 5000)
  }, [])

  return (
    <>
      <Menu.Root>
        <Menu.Trigger asChild>
          <Button
            variant="ghost"
            size="sm"
            color="textSecondary"
            _hover={{
              bg: 'bgTertiary',
              color: 'flipioPrimary',
            }}
            title="Settings"
          >
            <LuSettings size={16} />
          </Button>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content
              bg="bgPrimary"
              border="1px solid"
              borderColor="borderPrimary"
              borderRadius="md"
              boxShadow="lg"
              py={2}
              minW="200px"
            >
              <Menu.Item
                value="check-updates"
                px={3}
                py={2}
                _hover={{
                  bg: 'bgTertiary',
                }}
                _focus={{
                  bg: 'bgTertiary',
                }}
                onClick={handleCheckForUpdates}
                disabled={isChecking}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  color="textPrimary"
                  display="flex"
                  alignItems="center"
                  gap={2}
                  fontSize="sm"
                  fontWeight="medium"
                  loading={isChecking}
                  p={0}
                  h="auto"
                  minH="auto"
                >
                  <LuRefreshCw size={16} />
                  <Text>Check for Updates</Text>
                </Button>
              </Menu.Item>

              <Menu.Item
                value="export-logs"
                px={3}
                py={2}
                _hover={{
                  bg: 'bgTertiary',
                }}
                _focus={{
                  bg: 'bgTertiary',
                }}
                onClick={handleExportLogs}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  color="textPrimary"
                  display="flex"
                  alignItems="center"
                  gap={2}
                  fontSize="sm"
                  fontWeight="medium"
                  p={0}
                  h="auto"
                  minH="auto"
                >
                  <LuDownload size={16} />
                  <Text>Export Logs</Text>
                </Button>
              </Menu.Item>

              <Menu.Item
                value="github-link"
                px={3}
                py={2}
                _hover={{
                  bg: 'bgTertiary',
                }}
                _focus={{
                  bg: 'bgTertiary',
                }}
              >
                <Link
                  target="_blank"
                  href="https://github.com/groot007/flippio"
                  variant="plain"
                  outline="none"
                  color="textPrimary"
                  display="flex"
                  alignItems="center"
                  gap={2}
                  fontSize="sm"
                  fontWeight="medium"
                >
                  <LuGithub size={16} />
                  <Text>GitHub</Text>
                  <LuExternalLink size={12} />
                </Link>
              </Menu.Item>
              <HStack px={3} py={2} justifyContent="space-between" borderTop="1px solid" borderColor="borderSecondary" mt={1}>
                <Text fontSize="xs" color="textTertiary">
                  v
                  {packageJSON.version}
                </Text>
                <ColorModeSwitcher />
              </HStack>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>

      <FLModal
        isOpen={Boolean(availableUpdateModal)}
        title={availableUpdateModal?.version ? `Update Available: ${availableUpdateModal.version}` : 'Update Available'}
        body={releaseNotesBody}
        acceptBtn={isDownloading ? 'Installing...' : 'Install Update'}
        onAccept={handleInstallUpdate}
        rejectBtn="Later"
        onReject={() => {
          setAvailableUpdateModal(null)
        }}
        disabled={isDownloading}
      />

      <FLModal
        isOpen={Boolean(installedUpdateModal)}
        title={installedUpdateModal?.version ? `Updated to ${installedUpdateModal.version}` : 'App Updated'}
        body={releaseNotesBody}
        acceptBtn="Close"
        onAccept={() => {
          setInstalledUpdateModal(null)
        }}
      />
    </>
  )
}
