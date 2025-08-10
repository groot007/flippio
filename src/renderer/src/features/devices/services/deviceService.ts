/**
 * Device Service Layer
 * 
 * Provides a clean abstraction over Tauri device commands with:
 * - Centralized error handling
 * - Type safety
 * - Consistent response format
 * - Request/response transformation
 */

import type { 
  DeviceInfo, 
  DeviceServiceResponse,
  VirtualDevice,
} from '../types.js'
import { transformToCamelCase } from '../../../shared/utils/caseTransformer.js'

/**
 * Core device service class providing device management functionality
 */
class DeviceService {
  /**
   * Retrieves all connected physical and virtual devices
   */
  async getDevices(): Promise<DeviceServiceResponse<DeviceInfo[]>> {
    try {
      const response = await window.api.getDevices()
      
      if (!response.success) {
        return {
          success: false,
          error: response.error || 'Failed to retrieve devices',
          data: null,
        }
      }

      const devices = transformToCamelCase(response.devices || []) as DeviceInfo[]
      
      return {
        success: true,
        data: devices,
        error: null,
      }
    }
    catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        data: null,
      }
    }
  }

  /**
   * Retrieves available Android emulators
   */
  async getAndroidEmulators(): Promise<DeviceServiceResponse<VirtualDevice[]>> {
    try {
      const response = await window.api.getAndroidEmulators()
      
      if (!response.success) {
        return {
          success: false,
          error: response.error || 'Failed to retrieve Android emulators',
          data: null,
        }
      }

      const emulators = transformToCamelCase(response.emulators) as VirtualDevice[]
      
      return {
        success: true,
        data: emulators,
        error: null,
      }
    }
    catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        data: null,
      }
    }
  }

  /**
   * Retrieves available iOS simulators
   */
  async getIOSSimulators(): Promise<DeviceServiceResponse<VirtualDevice[]>> {
    try {
      const response = await window.api.getIOSSimulators()
      
      if (!response.success) {
        return {
          success: false,
          error: response.error || 'Failed to retrieve iOS simulators',
          data: null,
        }
      }

      const simulators = transformToCamelCase(response.simulators) as VirtualDevice[]
      
      return {
        success: true,
        data: simulators,
        error: null,
      }
    }
    catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        data: null,
      }
    }
  }

  /**
   * Launches an Android emulator by name
   */
  async launchAndroidEmulator(emulatorName: string): Promise<DeviceServiceResponse<void>> {
    try {
      if (!emulatorName?.trim()) {
        return {
          success: false,
          error: 'Emulator name is required',
          data: null,
        }
      }

      const response = await window.api.launchAndroidEmulator(emulatorName)
      
      if (!response.success) {
        return {
          success: false,
          error: response.error || 'Failed to launch Android emulator',
          data: null,
        }
      }

      return {
        success: true,
        data: undefined,
        error: null,
      }
    }
    catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        data: null,
      }
    }
  }

  /**
   * Launches an iOS simulator by identifier
   */
  async launchIOSSimulator(simulatorId: string): Promise<DeviceServiceResponse<void>> {
    try {
      if (!simulatorId?.trim()) {
        return {
          success: false,
          error: 'Simulator ID is required',
          data: null,
        }
      }

      const response = await window.api.launchIOSSimulator(simulatorId)
      
      if (!response.success) {
        return {
          success: false,
          error: response.error || 'Failed to launch iOS simulator',
          data: null,
        }
      }

      return {
        success: true,
        data: undefined,
        error: null,
      }
    }
    catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        data: null,
      }
    }
  }

  /**
   * Refreshes the device list (forces re-detection)
   */
  async refreshDevices(): Promise<DeviceServiceResponse<DeviceInfo[]>> {
    // For now, this just calls getDevices() but could be extended
    // to clear caches or trigger device re-detection on the backend
    return this.getDevices()
  }
}

// Export singleton instance
export const deviceService = new DeviceService()

// Export the class for testing
export { DeviceService }
