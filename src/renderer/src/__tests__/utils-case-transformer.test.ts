import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  toCamelCase,
  toSnakeCase,
  transformToCamelCase,
  transformToSnakeCase
} from '../utils/caseTransformer'

describe('case transformer utility tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('toSnakeCase function', () => {
    it('should convert camelCase to snake_case', () => {
      expect(toSnakeCase('deviceId')).toBe('device_id')
      expect(toSnakeCase('packageName')).toBe('package_name')
      expect(toSnakeCase('currentDbPath')).toBe('current_db_path')
      expect(toSnakeCase('iOS')).toBe('i_o_s')
    })

    it('should handle single words', () => {
      expect(toSnakeCase('device')).toBe('device')
      expect(toSnakeCase('table')).toBe('table')
    })

    it('should handle empty strings', () => {
      expect(toSnakeCase('')).toBe('')
    })

    it('should handle strings with numbers', () => {
      expect(toSnakeCase('device123')).toBe('device123')
      expect(toSnakeCase('deviceId2')).toBe('device_id2')
    })
  })

  describe('toCamelCase function', () => {
    it('should convert snake_case to camelCase', () => {
      expect(toCamelCase('device_id')).toBe('deviceId')
      expect(toCamelCase('package_name')).toBe('packageName')
      expect(toCamelCase('current_db_path')).toBe('currentDbPath')
    })

    it('should handle single words', () => {
      expect(toCamelCase('device')).toBe('device')
      expect(toCamelCase('table')).toBe('table')
    })

    it('should handle empty strings', () => {
      expect(toCamelCase('')).toBe('')
    })

    it('should handle strings with numbers', () => {
      expect(toCamelCase('device_123')).toBe('device_123') // Numbers don't get camelCased
      expect(toCamelCase('device_id_2')).toBe('deviceId_2') // Only the 'id' part gets camelCased
    })
  })

  describe('transformToSnakeCase function', () => {
    it('should transform object keys to snake_case', () => {
      const input = {
        deviceId: 'test-device',
        packageName: 'com.example.app',
        currentDbPath: '/path/to/db'
      }

      const result = transformToSnakeCase(input)

      expect(result).toEqual({
        device_id: 'test-device',
        package_name: 'com.example.app',
        current_db_path: '/path/to/db'
      })
    })

    it('should handle empty objects', () => {
      const result = transformToSnakeCase({})
      expect(result).toEqual({})
    })

    it('should handle null values', () => {
      const input = {
        deviceId: null,
        packageName: 'com.example.app'
      }

      const result = transformToSnakeCase(input)

      expect(result).toEqual({
        device_id: null,
        package_name: 'com.example.app'
      })
    })

    it('should handle arrays', () => {
      const input = {
        deviceIds: ['device1', 'device2'],
        packageName: 'com.example.app'
      }

      const result = transformToSnakeCase(input)

      expect(result).toEqual({
        device_ids: ['device1', 'device2'],
        package_name: 'com.example.app'
      })
    })
  })

  describe('transformToCamelCase function', () => {
    it('should transform object keys to camelCase', () => {
      const input = {
        device_id: 'test-device',
        package_name: 'com.example.app',
        current_db_path: '/path/to/db'
      }

      const result = transformToCamelCase(input)

      expect(result).toEqual({
        deviceId: 'test-device',
        packageName: 'com.example.app',
        currentDbPath: '/path/to/db'
      })
    })

    it('should handle nested objects', () => {
      const input = {
        device_info: {
          device_id: 'test-device',
          package_data: {
            package_name: 'com.example.app',
            app_version: '1.0.0'
          }
        },
        current_db_path: '/path/to/db'
      }

      const result = transformToCamelCase(input)

      expect(result).toEqual({
        deviceInfo: {
          deviceId: 'test-device',
          packageData: {
            packageName: 'com.example.app',
            appVersion: '1.0.0'
          }
        },
        currentDbPath: '/path/to/db'
      })
    })

    it('should handle arrays of objects', () => {
      const input = {
        device_list: [
          { device_id: 'device1', device_name: 'Device 1' },
          { device_id: 'device2', device_name: 'Device 2' }
        ]
      }

      const result = transformToCamelCase(input)

      expect(result).toEqual({
        deviceList: [
          { deviceId: 'device1', deviceName: 'Device 1' },
          { deviceId: 'device2', deviceName: 'Device 2' }
        ]
      })
    })
  })

  describe('transformToSnakeCase nested objects', () => {
    it('should transform nested object keys recursively', () => {
      const input = {
        deviceInfo: {
          deviceId: 'test-device',
          packageData: {
            packageName: 'com.example.app',
            appVersion: '1.0.0'
          }
        },
        currentDbPath: '/path/to/db'
      }

      const result = transformToSnakeCase(input)

      expect(result).toEqual({
        device_info: {
          device_id: 'test-device',
          package_data: {
            package_name: 'com.example.app',
            app_version: '1.0.0'
          }
        },
        current_db_path: '/path/to/db'
      })
    })

    it('should handle arrays of objects', () => {
      const input = {
        deviceList: [
          { deviceId: 'device1', deviceName: 'Device 1' },
          { deviceId: 'device2', deviceName: 'Device 2' }
        ]
      }

      const result = transformToSnakeCase(input)

      expect(result).toEqual({
        device_list: [
          { device_id: 'device1', device_name: 'Device 1' },
          { device_id: 'device2', device_name: 'Device 2' }
        ]
      })
    })

    it('should handle primitive arrays', () => {
      const input = {
        deviceIds: ['device1', 'device2', 'device3'],
        packageName: 'com.example.app'
      }

      const result = transformToSnakeCase(input)

      expect(result).toEqual({
        device_ids: ['device1', 'device2', 'device3'],
        package_name: 'com.example.app'
      })
    })

    it('should handle null and undefined values', () => {
      const input = {
        deviceId: null,
        packageName: undefined,
        appData: {
          version: '1.0.0',
          metadata: null
        }
      }

      const result = transformToSnakeCase(input)

      expect(result).toEqual({
        device_id: null,
        package_name: undefined,
        app_data: {
          version: '1.0.0',
          metadata: null
        }
      })
    })
  })

  describe('integration scenarios', () => {
    it('should handle real-world device response transformation', () => {
      const deviceResponse = {
        deviceId: 'ABC123-DEF456',
        deviceName: 'Test iPhone',
        platformInfo: {
          osVersion: '15.0',
          deviceModel: 'iPhone 13',
          packageList: [
            { packageName: 'com.apple.calculator', appName: 'Calculator' },
            { packageName: 'com.apple.notes', appName: 'Notes' }
          ]
        }
      }

      const transformed = transformToSnakeCase(deviceResponse)

      expect(transformed).toEqual({
        device_id: 'ABC123-DEF456',
        device_name: 'Test iPhone',
        platform_info: {
          os_version: '15.0',
          device_model: 'iPhone 13',
          package_list: [
            { package_name: 'com.apple.calculator', app_name: 'Calculator' },
            { package_name: 'com.apple.notes', app_name: 'Notes' }
          ]
        }
      })
    })

    it('should handle round-trip transformation', () => {
      const original = {
        deviceId: 'test-device',
        packageName: 'com.example.app',
        nestedData: {
          subField: 'value',
          arrayData: [{ itemId: 1, itemName: 'item1' }]
        }
      }

      const toSnake = transformToSnakeCase(original)
      const backToCamel = transformToCamelCase(toSnake)

      expect(backToCamel).toEqual(original)
    })
  })

  describe('edge cases and error handling', () => {
    it('should preserve non-object types', () => {
      expect(transformToSnakeCase('string')).toBe('string')
      expect(transformToSnakeCase(42)).toBe(42)
      expect(transformToSnakeCase(true)).toBe(true)
      expect(transformToSnakeCase(null)).toBe(null)
      expect(transformToSnakeCase(undefined)).toBe(undefined)
    })

    it('should handle Date objects', () => {
      const date = new Date('2023-01-01')
      const input = { createdAt: date }
      const result = transformToSnakeCase(input)
      
      expect(result.created_at).toBe(date)
      expect(result.created_at).toBeInstanceOf(Date)
    })

    it('should handle arrays with mixed types', () => {
      const input = {
        mixedArray: ['string', 42, { nestedKey: 'value' }, null]
      }

      const result = transformToSnakeCase(input)

      expect(result).toEqual({
        mixed_array: ['string', 42, { nested_key: 'value' }, null]
      })
    })
  })
})
