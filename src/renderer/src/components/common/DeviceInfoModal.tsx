import { 
  Box, 
  Spinner, 
  Stack,
  Table, 
  Text,
} from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { LuInfo, LuSmartphone, LuTablet } from 'react-icons/lu'
import FLModal from './FLModal'

interface DeviceInfoModalProps {
  isOpen: boolean
  onClose: () => void
  deviceId: string
  deviceType: string
  deviceName: string
}

interface DeviceInfo {
  [key: string]: string
}

export function DeviceInfoModal({ 
  isOpen, 
  onClose, 
  deviceId, 
  deviceType, 
  deviceName, 
}: DeviceInfoModalProps) {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && deviceId) {
      fetchDeviceInfo()
    }
  }, [isOpen, deviceId, deviceType])

  const fetchDeviceInfo = async () => {
    setLoading(true)
    setError(null)
    setDeviceInfo(null)

    // Determine if this is an iOS device (physical device, simulator, or contains ios/iphone in type)
    const isIOSDevice = deviceType === 'simulator' 
      || deviceType === 'iphone-device' 
      || deviceType.includes('iphone') 
      || deviceType.includes('ios')

    console.log('🔍 [DeviceInfoModal] Fetching device info for:', {
      deviceId,
      deviceType,
      isIOSDevice,
      detectionReason: deviceType === 'simulator'
        ? 'simulator type' 
        : deviceType === 'iphone-device'
          ? 'iphone-device type'
          : deviceType.includes('iphone')
            ? 'contains iphone'
            : deviceType.includes('ios') ? 'contains ios' : 'default to android',
    })

    try {
      let response
      
      if (isIOSDevice) {
        console.log('🔍 [DeviceInfoModal] Calling iOS device info API')
        response = await (window.api as any).iosGetDeviceInfo(deviceId)
      }
      else {
        console.log('🔍 [DeviceInfoModal] Calling Android device info API')
        response = await (window.api as any).adbGetDeviceInfo(deviceId)
      }

      console.log('🔍 [DeviceInfoModal] Device info response:', response)

      if (response.success && response.data) {
        console.log('🔍 [DeviceInfoModal] Setting device info:', response.data)
        setDeviceInfo(response.data)
      }
      else {
        const errorMsg = response.error || 'Failed to fetch device information'
        console.error('🔍 [DeviceInfoModal] Device info fetch failed:', errorMsg)
        setError(errorMsg)
      }
    }
    catch (err) {
      const errorMsg = `Failed to fetch device information: ${(err as Error).message}`
      console.error('🔍 [DeviceInfoModal] Exception during device info fetch:', err)
      setError(errorMsg)
    }
    finally {
      setLoading(false)
    }
  }

  const getDeviceIcon = () => {
    // Check for iOS devices (simulators, physical devices, or iOS-related types)
    const isIOSDevice = deviceType === 'simulator' 
      || deviceType === 'iphone-device' 
      || deviceType.includes('iphone') 
      || deviceType.includes('ios')
    
    if (isIOSDevice || deviceType.includes('android')) {
      return <LuSmartphone size={20} color="var(--chakra-colors-flipioPrimary)" />
    }
    else if (deviceType.includes('ipad') || deviceType.includes('tablet')) {
      return <LuTablet size={20} color="var(--chakra-colors-flipioPrimary)" />
    }
    return <LuInfo size={20} color="var(--chakra-colors-flipioPrimary)" />
  }

  const modalBody = (
    <Box>
      {/* Header with device icon and name */}
      <Stack direction="row" align="center" gap={3} mb={4}>
        {getDeviceIcon()}
        <Box>
          <Text fontSize="lg" fontWeight="semibold" color="textPrimary">
            {deviceName || deviceId}
          </Text>
          <Text fontSize="sm" color="textSecondary">
            {deviceType === 'simulator'
              ? 'iOS Simulator'
              : deviceType === 'iphone-device'
                ? 'iOS Device'
                : deviceType.includes('iphone') || deviceType.includes('ios')
                  ? 'iOS Device' 
                  : 'Android Device'}
          </Text>
        </Box>
      </Stack>

      {/* Content */}
      {loading && (
        <Stack gap={4} py={8} align="center">
          <Spinner size="md" color="flipioPrimary" />
          <Text color="textSecondary">Loading device information...</Text>
        </Stack>
      )}

      {error && (
        <Stack gap={4} py={8} align="center">
          <Text color="red.400" textAlign="center">
            {error}
          </Text>
        </Stack>
      )}

      {deviceInfo && !loading && (
        <Box>
          <Table.Root size="sm" variant="outline">
            <Table.Body>
              {Object.entries(deviceInfo).map(([key, value]) => (
                <Table.Row key={key}>
                  <Table.Cell
                    fontWeight="medium"
                    color="textSecondary"
                    width="40%"
                    verticalAlign="top"
                    py={3}
                  >
                    {key}
                  </Table.Cell>
                  <Table.Cell 
                    color="textPrimary"
                    py={3}
                    wordBreak="break-word"
                  >
                    {value || 'N/A'}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>
      )}
    </Box>
  )

  return (
    <FLModal
      isOpen={isOpen}
      title="Device Information"
      body={modalBody}
      acceptBtn="Close"
      onAccept={onClose}
      onReject={onClose}
      disabled={loading}
    />
  )
}
