/**
 * Common utility functions with strict TypeScript types
 */

/**
 * Determines if a value represents valid JSON that should be displayed in a JSON editor
 * @param value - The value to check
 * @returns true if the value is a valid JSON string representing an object or array
 */
export function isJsonValue(value: unknown): boolean {
  // Only consider string values
  if (typeof value !== 'string') {
    return false
  }

  // Skip empty strings or strings with only whitespace
  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return false
  }

  // Quick check: JSON objects/arrays must start with { or [
  if (!trimmedValue.startsWith('{') && !trimmedValue.startsWith('[')) {
    return false
  }

  try {
    const parsed: unknown = JSON.parse(trimmedValue)
    
    // Only consider objects and arrays as JSON-worthy
    // Exclude primitive values (strings, numbers, booleans, null)
    return (
      (typeof parsed === 'object' && parsed !== null)
      || Array.isArray(parsed)
    )
  }
  catch {
    // If parsing fails, it's not valid JSON
    return false
  }
}

/**
 * Safely parses a JSON string, returning the original value if parsing fails
 * @param value - The value to parse
 * @returns The parsed JSON object or the original value if parsing fails
 */
export function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }

  try {
    return JSON.parse(value) as unknown
  }
  catch {
    return value
  }
}

/**
 * Type guard to check if a value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Type guard to check if a value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

/**
 * Type guard to check if a value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value)
}

/**
 * Debounce function with TypeScript generics
 */
export function debounce<T extends unknown[]>(
  func: (...args: T) => void,
  wait: number,
): (...args: T) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: T): void => {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Throttle function with TypeScript generics
 */
export function throttle<T extends unknown[]>(
  func: (...args: T) => void,
  limit: number,
): (...args: T) => void {
  let inThrottle = false
  
  return (...args: T): void => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}
