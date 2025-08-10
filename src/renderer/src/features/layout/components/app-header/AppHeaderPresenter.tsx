import type { AppHeaderPresenterProps } from './types'

import { Box, Button, HStack, Spinner } from '@chakra-ui/react'

import { VirtualDeviceModalContainer } from '@renderer/features/devices/components/virtual-device-modal'
import { PackageSetModalContainer } from '@renderer/features/layout/components/package-set-modal'
import { SettingsContainer } from '@renderer/features/layout/components/settings'
import { FLSelect } from '@renderer/shared/components/ui'
import { memo } from 'react'

import { LuPackage, LuRefreshCcw, LuRocket, LuSmartphone } from 'react-icons/lu'

function AppHeaderPresenterImpl({
  devicesSelectOptions,
  applicationSelectOptions,
  selectedDevice,
  selectedApplication,
  isLoading,
  isRefreshing,
  isVirtualDeviceModalOpen,
  isPackageSetModalOpen,
  onDeviceChange,
  onPackageChange,
  onRefreshDevices,
  onOpenVirtualDeviceModal,
  onCloseVirtualDeviceModal,
  onClosePackageSetModal,
}: AppHeaderPresenterProps) {
  return (
    <>
      <Box
        padding={6}
        w="full"
        bg="bgPrimary"
        borderBottom="1px solid"
        borderColor="borderPrimary"
        boxShadow="sm"
      >
        <HStack gap={5} alignItems="center">
          {/* Device and App Selection */}
          <HStack gap={4} alignItems="center" flex={1}>
            <FLSelect
              options={devicesSelectOptions}
              label="Select Device"
              value={selectedDevice}
              icon={<LuSmartphone color="var(--chakra-colors-flipioPrimary)" />}
              onChange={onDeviceChange}
              noOptionsMessage="No devices found. Connect a device or launch an emulator/simulator"
            />
            <FLSelect
              options={applicationSelectOptions}
              label="Select App"
              menuListWidth={300}
              value={selectedApplication}
              icon={<LuPackage color="var(--chakra-colors-flipioPrimary)" />}
              onChange={onPackageChange}
              isDisabled={!selectedDevice || isLoading}
              showPinIcon={true}
            />
            {isLoading && (
              <Spinner
                size="sm"
                color="flipioPrimary"
              />
            )}

            <Button
              data-testid="refresh-devices"
              data-state={isRefreshing ? 'open' : 'closed'}
              onClick={onRefreshDevices}
              variant="ghost"
              size="sm"
              color="textSecondary"
              _hover={{
                bg: 'bgTertiary',
                color: 'flipioPrimary',
              }}
              disabled={isRefreshing}
              _disabled={{
                opacity: 0.5,
              }}
              _open={{
                animationName: 'rotate',
                animationDuration: '1100ms',
              }}
              title="Refresh devices"
            >
              <LuRefreshCcw size={16} />
            </Button>
          </HStack>

          {/* Actions */}
          <HStack gap={3} alignItems="center">
            <Button
              onClick={onOpenVirtualDeviceModal}
              variant="outline"
              size="sm"
              title="Launch Emulator"
              color="textSecondary"
              border="none"
              _hover={{
                bg: 'bgTertiary',
              }}
            >
              <LuRocket size={16} />
            </Button>

            <SettingsContainer />
          </HStack>
        </HStack>
      </Box>

      <VirtualDeviceModalContainer
        isOpen={isVirtualDeviceModalOpen}
        onClose={onCloseVirtualDeviceModal}
      />

      <PackageSetModalContainer
        isLoading={isLoading}
        isOpen={isPackageSetModalOpen}
        onClose={onClosePackageSetModal}
        onPackageSet={onClosePackageSetModal}
      />
    </>
  )
}

export const AppHeaderPresenter = memo(AppHeaderPresenterImpl)
