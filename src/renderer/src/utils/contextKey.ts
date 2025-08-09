/**
 * Generate context key for change history from device, package, and database info.
 * This matches the Rust implementation in src-tauri/src/commands/database/change_history/types.rs
 * For custom files without device/package context, generates a file-based key.
 */
export async function generateContextKey(deviceId: string | undefined, packageName: string | undefined, databasePath: string): Promise<string> {
  // Handle custom files without device/package context
  if (!deviceId || !packageName) {
    return generateCustomFileContextKey(databasePath)
  }

  // Normalize filename to handle path variations (matches Rust implementation)
  // Handle both Unix and Windows path separators
  const normalizedFilename = databasePath
    .split(/[/\\]/) // Split on both separators
    .pop() || databasePath // Get the last component (filename)

  // Create the input string (matches Rust format)
  const input = `${deviceId}:${packageName}:${normalizedFilename}`
  
  // Generate SHA256 hash using Web Crypto API (browser-compatible)
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  
  // Convert to base64 (matches Rust implementation - no padding)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashBase64 = btoa(String.fromCharCode(...hashArray)).replace(/=/g, '')
  
  return hashBase64
}

/**
 * Generate context key for custom files without device/package context
 */
export async function generateCustomFileContextKey(databasePath: string): Promise<string> {
  // Use full path for custom files to ensure uniqueness
  const input = `custom_file:${databasePath}`
  
  // Generate SHA256 hash using Web Crypto API
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  
  // Convert to base64 (no padding)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashBase64 = btoa(String.fromCharCode(...hashArray)).replace(/=/g, '')
  
  return `custom_${hashBase64}`
}

/**
 * Synchronous version for compatibility - uses a simple hash as fallback
 * This is a simplified version that should work consistently
 */
export function generateContextKeySync(deviceId: string | undefined, packageName: string | undefined, databasePath: string): string {
  // Handle custom files without device/package context
  if (!deviceId || !packageName) {
    return generateCustomFileContextKeySync(databasePath)
  }

  // Normalize filename to handle path variations (matches Rust implementation)
  // Handle both Unix and Windows path separators
  const normalizedFilename = databasePath
    .split(/[/\\]/) // Split on both separators
    .pop() || databasePath // Get the last component (filename)

  // Create the input string (matches Rust format)
  const input = `${deviceId}:${packageName}:${normalizedFilename}`
  
  // Simple hash function as fallback (not crypto-secure but consistent)
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  // Convert to base64-like string for consistency
  return btoa(hash.toString())
}

/**
 * Synchronous version for custom files
 */
export function generateCustomFileContextKeySync(databasePath: string): string {
  // Use full path for custom files to ensure uniqueness
  const input = `custom_file:${databasePath}`
  
  // Simple hash function as fallback
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  // Convert to base64-like string with custom prefix
  return `custom_${btoa(hash.toString())}`
}

/**
 * Extract database filename from full path for context key generation
 */
export function extractDatabaseFilename(databasePath: string): string {
  return databasePath.split(/[/\\]/).pop() || databasePath
}

/**
 * Interface for context parameters used in database operations
 */
export interface DatabaseOperationContext {
  deviceId?: string
  deviceName?: string
  deviceType?: string
  packageName?: string
  appName?: string
}

/**
 * Extract context parameters from current app state for database operations
 * This can be imported and used by any component that needs to pass context to the backend
 */
export function extractContextFromState(
  selectedDevice: any,
  selectedApplication: any,
  selectedDatabaseFile: any
): DatabaseOperationContext {
  return {
    deviceId: selectedDevice?.id,
    deviceName: selectedDevice?.name || selectedDevice?.description,
    deviceType: selectedDevice?.deviceType || selectedDevice?.type,
    packageName: selectedApplication?.bundleId || selectedDatabaseFile?.packageName,
    appName: selectedApplication?.name || selectedApplication?.displayName
  }
}
