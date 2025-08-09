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
    if ('BulkInsert' in operationType) return 'insert'
    if ('BulkUpdate' in operationType) return 'update'
    if ('BulkDelete' in operationType) return 'delete'
    if ('Revert' in operationType) return 'revert'
    
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
      return 'green'
    case 'update':
      return 'blue'
    case 'delete':
      return 'red'
    case 'clear':
      return 'orange'
    default:
      return 'gray'
  }
}
