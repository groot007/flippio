/**
 * Utility functions to transform object keys between snake_case and camelCase
 */

/**
 * Convert snake_case string to camelCase
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

/**
 * Convert camelCase string to snake_case
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}

/**
 * Recursively transform object keys from snake_case to camelCase
 * Returns a new object/array with camelCase keys
 */
export function transformToCamelCase<T = any>(obj: any): T {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(item => transformToCamelCase(item)) as T
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = toCamelCase(key)
      result[camelKey] = transformToCamelCase(value)
    }
    return result as T
  }

  return obj
}

/**
 * Recursively transform object keys from camelCase to snake_case
 * Returns a new object/array with snake_case keys
 */
export function transformToSnakeCase(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(item => transformToSnakeCase(item))
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = toSnakeCase(key)
      result[snakeKey] = transformToSnakeCase(value)
    }
    return result
  }

  return obj
}
