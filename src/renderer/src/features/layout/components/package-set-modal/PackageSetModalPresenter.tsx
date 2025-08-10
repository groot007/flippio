import type { PackageSetModalPresenterProps } from './types'

import {
  Input,
  Stack,
  Tag,
  Text,
  VStack,
} from '@chakra-ui/react'
import { FLModal } from '@renderer/shared/components/ui'
import { memo } from 'react'

import { LuCalendarClock } from 'react-icons/lu'

/**
 * PackageSetModalPresenter - Pure UI component for package bundle ID setting modal
 * 
 * Renders a modal with input field for bundle ID entry and displays recent bundle IDs.
 * Contains no business logic - all state and actions are managed by the Container.
 */
const PackageSetModalPresenterImpl: React.FC<PackageSetModalPresenterProps> = ({
  isOpen,
  isLoading,
  bundleIDInput,
  recentBundleIds,
  onBundleIdChange,
  onSelectRecentBundleId,
  onAccept,
  onReject,
}) => {
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
            onChange={e => onBundleIdChange(e.target.value)}
            borderColor="gray.300"
            _hover={{ borderColor: 'flipioPrimary' }}
            _focus={{
              borderColor: 'flipioPrimary',
              boxShadow: `0 0 0 1px var(--chakra-colors-flipioPrimary)`,
            }}
          />

          {recentBundleIds.length > 0 && (
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
                    onClick={() => onSelectRecentBundleId(id)}
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
          )}
        </VStack>
      )}
      title="Set app bundle ID"
      acceptBtn="Set app"
      onAccept={onAccept}
      rejectBtn="Cancel"
      onReject={onReject}
    />
  )
}

export const PackageSetModalPresenter = memo(PackageSetModalPresenterImpl)
