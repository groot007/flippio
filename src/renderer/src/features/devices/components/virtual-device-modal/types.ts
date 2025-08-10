import type { VirtualDevice } from '../../types/virtualDevice'

export interface VirtualDeviceModalContainerProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean
  /**
   * Function to close the modal
   */
  onClose: () => void
}

export interface VirtualDeviceModalPresenterProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean
  /**
   * Function to close the modal
   */
  onClose: () => void
  /**
   * List of Android virtual devices
   */
  androidDevices: VirtualDevice[]
  /**
   * List of iOS simulators
   */
  iosSimulators: VirtualDevice[]
  /**
   * Whether devices are currently loading
   */
  isLoading: boolean
  /**
   * ID of device currently being launched
   */
  isLaunching: string | null
  /**
   * Function to launch a virtual device
   */
  onLaunchDevice: (deviceId: string, platform: 'android' | 'ios') => void
  /**
   * Function to refresh the device list
   */
  onRefreshDevices: () => void
}

export interface VirtualDeviceListItemProps {
  /**
   * Virtual device data
   */
  device: VirtualDevice
  /**
   * Whether device is currently being launched
   */
  isLaunching: boolean
  /**
   * Function to launch the device
   */
  onLaunch: () => void
}
