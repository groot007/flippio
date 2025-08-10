/**
 * Device Feature Types
 * 
 * Contains all TypeScript type definitions specific to device management
 */

/**
 * Supported device types in the application
 */
export type DeviceType = 'android' | 'iphone' | 'desktop' | 'iphone-device' | 'emulator' | 'simulator'

/**
 * Core device information structure
 */
export interface DeviceInfo {
  /** Unique device identifier */
  id: string
  /** Human-readable device name */
  name: string
  /** Device model information */
  model: string
  /** Type classification of the device */
  deviceType: DeviceType
  /** Optional display label */
  label?: string
  /** Optional device description */
  description?: string
  /** Platform information (iOS, Android, etc.) */
  platform?: string
}

/**
 * Virtual device (emulator/simulator) information
 */
export interface VirtualDevice {
  /** Unique identifier for the virtual device */
  id: string
  /** Display name of the virtual device */
  name: string
  /** Virtual device type */
  type: 'emulator' | 'simulator'
  /** Target platform */
  platform: 'android' | 'ios'
  /** Whether the device is currently running */
  isRunning?: boolean
  /** API level (Android) or iOS version */
  apiLevel?: string
  /** Device configuration details */
  config?: {
    screenSize?: string
    density?: string
    arch?: string
  }
}

/**
 * Standardized service response wrapper
 */
export interface DeviceServiceResponse<T> {
  /** Whether the operation was successful */
  success: boolean
  /** Response data (null if operation failed) */
  data: T | null
  /** Error message (null if operation succeeded) */
  error: string | null
}

/**
 * Device selection state
 */
export interface DeviceSelection {
  /** Currently selected device */
  selectedDevice: DeviceInfo | null
  /** Available devices list */
  availableDevices: DeviceInfo[]
  /** Whether devices are currently being loaded */
  isLoading: boolean
}

/**
 * Virtual device launch options
 */
export interface LaunchVirtualDeviceOptions {
  /** Device identifier */
  deviceId: string
  /** Device type */
  type: 'emulator' | 'simulator'
  /** Additional launch parameters */
  options?: Record<string, string | number | boolean>
}

/**
 * Device capability flags
 */
export interface DeviceCapabilities {
  /** Can install applications */
  canInstallApps: boolean
  /** Can access file system */
  canAccessFiles: boolean
  /** Can run shell commands */
  canRunCommands: boolean
  /** Can debug applications */
  canDebug: boolean
}
