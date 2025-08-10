export interface VirtualDevice {
  /**
   * Display name of the virtual device
   */
  name: string
  /**
   * Unique identifier for the device
   */
  id: string
  /**
   * Platform type (Android or iOS)
   */
  platform: 'android' | 'ios'
  /**
   * Current state of the device (e.g., 'Booted', 'Shutdown', 'running')
   */
  state?: string
}
