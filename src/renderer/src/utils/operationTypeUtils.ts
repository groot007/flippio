import type { OperationType } from '@renderer/types/changeHistory'

/**
 * Format operation type for display in UI
 */
export function formatOperationType(operationType: OperationType): string {
  // Handle Rust enum serialization
  if (typeof operationType === 'string') {
    return operationType
  }
  
  // Handle complex operation types from Rust enum variants
  if (typeof operationType === 'object' && operationType !== null) {
    // Handle BulkInsert, BulkUpdate, BulkDelete: { "BulkUpdate": { "count": 5 } }
    if ('BulkInsert' in operationType) {
      return `Bulk Insert (${(operationType as any).BulkInsert.count} rows)`
    }
    if ('BulkUpdate' in operationType) {
      return `Bulk Update (${(operationType as any).BulkUpdate.count} rows)`
    }
    if ('BulkDelete' in operationType) {
      return `Bulk Delete (${(operationType as any).BulkDelete.count} rows)`
    }
    if ('Revert' in operationType) {
      return 'Revert'
    }
    
    // Handle legacy format with type property
    if ('type' in operationType) {
      const op = operationType as any
      if (op.count) {
        return `${op.type} (${op.count} rows)`
      }
      return op.type
    }
  }
  
  // Fallback
  return String(operationType)
}

/**
 * Get operation type string for color assignment
 */
export function getOperationTypeString(operationType: OperationType): string {
  if (typeof operationType === 'string') {
    return operationType
  }
  
  if (typeof operationType === 'object' && operationType !== null) {
    // Handle Rust enum variants
    if ('BulkInsert' in operationType) 
      return 'insert'
    if ('BulkUpdate' in operationType) 
      return 'update'
    if ('BulkDelete' in operationType) 
      return 'delete'
    if ('Revert' in operationType) 
      return 'revert'
    
    // Handle legacy format
    if ('type' in operationType) {
      return (operationType as any).type
    }
  }
  
  return 'unknown'
}

/**
 * Get color scheme for operation type
 */
export function getOperationColor(type: string): string {
  switch (type.toLowerCase()) {
    case 'insert':
      return 'green' // Addition operations - positive
    case 'update':
      return 'blue' // Modification operations - neutral
    case 'delete':
      return 'red' // Removal operations - destructive
    case 'clear':
      return 'orange' // Bulk removal - warning
    case 'revert':
      return 'purple' // Undo operations - special
    default:
      return 'gray' // Unknown operations
  }
}

/**
 * Get soft, user-friendly background color for operation type badges
 */
export function getOperationBadgeColor(type: string, isDark: boolean): string {
  switch (type.toLowerCase()) {
    case 'insert':
      return isDark ? '#22543D' : '#C6F6D5' // Soft green
    case 'update':
      return isDark ? '#2A4365' : '#BEE3F8' // Soft blue
    case 'delete':
      return isDark ? '#742A2A' : '#FED7D7' // Soft red
    case 'clear':
      return isDark ? '#C05621' : '#FEEBC8' // Soft orange
    case 'revert':
      return isDark ? '#553C9A' : '#E9D8FD' // Soft purple
    default:
      return isDark ? '#4A5568' : '#E2E8F0' // Soft gray
  }
}

/**
 * Get text color for operation type badges (ensures good contrast)
 */
export function getOperationTextColor(type: string, isDark: boolean): string {
  switch (type.toLowerCase()) {
    case 'insert':
      return isDark ? '#C6F6D5' : '#22543D' // Good contrast green
    case 'update':
      return isDark ? '#BEE3F8' : '#2A4365' // Good contrast blue
    case 'delete':
      return isDark ? '#FED7D7' : '#742A2A' // Good contrast red
    case 'clear':
      return isDark ? '#FEEBC8' : '#C05621' // Good contrast orange
    case 'revert':
      return isDark ? '#E9D8FD' : '#553C9A' // Good contrast purple
    default:
      return isDark ? '#E2E8F0' : '#4A5568' // Good contrast gray
  }
}

/**
 * Get background color for operation type (for enhanced diff visualization)
 */
export function getOperationBgColor(type: string, isDark: boolean): string {
  switch (type.toLowerCase()) {
    case 'insert':
      return isDark ? 'green.900' : 'green.50'
    case 'update':
      return isDark ? 'blue.900' : 'blue.50'
    case 'delete':
      return isDark ? 'red.900' : 'red.50'
    case 'clear':
      return isDark ? 'orange.900' : 'orange.50'
    case 'revert':
      return isDark ? 'purple.900' : 'purple.50'
    default:
      return isDark ? 'gray.800' : 'gray.50'
  }
}

/**
 * Get border color for operation type
 */
export function getOperationBorderColor(type: string, isDark: boolean): string {
  switch (type.toLowerCase()) {
    case 'insert':
      return isDark ? 'green.600' : 'green.200'
    case 'update':
      return isDark ? 'blue.600' : 'blue.200'
    case 'delete':
      return isDark ? 'red.600' : 'red.200'
    case 'clear':
      return isDark ? 'orange.600' : 'orange.200'
    case 'revert':
      return isDark ? 'purple.600' : 'purple.200'
    default:
      return isDark ? 'gray.600' : 'gray.200'
  }
}
