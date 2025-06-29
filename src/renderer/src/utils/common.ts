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
    const parsed = JSON.parse(trimmedValue)
    
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
    return JSON.parse(value)
  }
  catch {
    return value
  }
}
