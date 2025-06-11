import {
  Input,
  Stack,
  Tag,
  Text,
  VStack,
} from '@chakra-ui/react'
import { api } from '@renderer/lib/api-adapter'
import { useCurrentDeviceSelection } from '@renderer/store'
import { toaster } from '@renderer/ui/toaster'
import { useCallback, useEffect, useState } from 'react'
import { LuCalendarClock } from 'react-icons/lu'
import FLModal from '../common/FLModal'

interface PackageSetModalProps {
  isOpen: boolean
  isLoading: boolean
  onClose: () => void
  onPackageSet: () => void
}

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

export const PackageSetModal: React.FC<PackageSetModalProps> = ({ isOpen, isLoading, onClose, onPackageSet }) => {
  const setSelectedApplication = useCurrentDeviceSelection(state => state.setSelectedApplication)
  const selectedDevice = useCurrentDeviceSelection(state => state.selectedDevice)

  const [recentBundleIds, setRecentBundleIds] = useState<string[]>([])
  const [bundleIDInput, setBundleIdInput] = useState('')
  const handleBundleIdChange = useCallback(async () => {
    if (!selectedDevice?.id) {
      toaster({
        title: 'Error',
        description: 'No device selected',
        status: 'error',
      })
      return
    }

    const { success } = await api.checkAppExistence(selectedDevice?.id, bundleIDInput)
    if (success) {
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
    }
    else {
      toaster({
        title: 'Error',
        description: 'Bundle ID not found. Please check the Bundle ID and try again.',
        status: 'error',
      })
    }
  }, [selectedDevice, bundleIDInput, setSelectedApplication, onPackageSet])

  useEffect(() => {
    setRecentBundleIds(getRecentBundleIds())
  }, [])

  const selectRecentBundleId = useCallback((bundleId: string) => {
    setBundleIdInput(bundleId)
  }, [])

  return (
    <FLModal
      isOpen={isOpen}
      body={(
        <VStack gap={4} align="stretch">
          {isLoading && <Text>The app list is loading. Please wait...</Text> }
          {!isLoading && <Text>The app list is loaded. Select an app from the list or enter the app bundle ID manually.</Text>}
          <Text>
            The app list for IOs device can take a while to load.
            You can enter the app bundle ID manually to set the app and see the available databases.
          </Text>
          <Input
            placeholder="Enter app bundle ID"
            fontSize="sm"
            value={bundleIDInput}
            onChange={(e) => {
              setBundleIdInput(e.target.value)
            }}
            borderColor="gray.300"
            _hover={{ borderColor: 'flipioPrimary' }}
            _focus={{
              borderColor: 'flipioPrimary',
              boxShadow: `0 0 0 1px var(--chakra-colors-flipioPrimary)`,
            }}
          />

          {recentBundleIds.length > 0 && (
            <>

              <Stack direction="column">
                <Text fontSize="sm" fontWeight="medium" mb={2}>
                  Recently Used Bundle IDs
                </Text>
                <Stack gap={2} wrap="wrap">
                  {recentBundleIds.map(id => (
                    <Tag.Root
                      key={id}
                      size="md"
                      borderRadius="full"
                      variant="outline"
                      colorScheme="blue"
                      cursor="pointer"
                      onClick={() => selectRecentBundleId(id)}
                      _hover={{
                        bg: 'blue.50',
                        _dark: { bg: 'blue.900' },
                      }}
                    >
                      <LuCalendarClock />

                      <Tag.Label>{id}</Tag.Label>
                    </Tag.Root>
                  ))}
                </Stack>
              </Stack>
            </>
          )}
        </VStack>
      )}
      title="Set app bundle ID"
      acceptBtn="Set app"
      onAccept={() => {
        handleBundleIdChange()
      }}
      rejectBtn="Cancel"
      onReject={() => {
        onClose()
      }}
    />
  )
}
