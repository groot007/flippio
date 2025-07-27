// Type validation utilities for database operations
// Prevents type mismatch errors by validating data before sending to backend

export interface ValidationResult {
  isValid: boolean
  error?: string
  convertedValue?: any
}

/**
 * Validate a value against a database column type
 */
export function validateFieldValue(value: any, columnType: string): ValidationResult {
  const normalizedType = columnType.toUpperCase()
  
  // Handle null/undefined values
  if (value === null || value === undefined || value === '') {
    return { isValid: true, convertedValue: null }
  }
  
  const stringValue = String(value).trim()
  
  switch (normalizedType) {
    case 'INTEGER':
    case 'INT': {
      // Try to parse as integer
      const intValue = Number.parseInt(stringValue, 10)
      if (Number.isNaN(intValue)) {
        return {
          isValid: false,
          error: `"${stringValue}" is not a valid integer. Please enter a whole number (e.g., 42, -10, 0).`,
        }
      }
      return { isValid: true, convertedValue: intValue }
    }
      
    case 'REAL':
    case 'FLOAT':
    case 'DOUBLE':
    case 'NUMERIC': {
      // Try to parse as float
      const floatValue = Number.parseFloat(stringValue)
      if (Number.isNaN(floatValue)) {
        return {
          isValid: false,
          error: `"${stringValue}" is not a valid number. Please enter a decimal number (e.g., 3.14, -2.5, 42).`,
        }
      }
      return { isValid: true, convertedValue: floatValue }
    }
      
    case 'BOOLEAN':
    case 'BOOL': {
      // Accept various boolean formats
      const lowerValue = stringValue.toLowerCase()
      if (['true', '1', 'yes', 'on'].includes(lowerValue)) {
        return { isValid: true, convertedValue: true }
      }
      else if (['false', '0', 'no', 'off'].includes(lowerValue)) {
        return { isValid: true, convertedValue: false }
      }
      else {
        return {
          isValid: false,
          error: `"${stringValue}" is not a valid boolean. Please enter: true/false, 1/0, yes/no, or on/off.`,
        }
      }
    }
      
    case 'TEXT':
    case 'VARCHAR':
    case 'CHAR':
    case 'STRING':
    case 'BLOB':
      // Text values are always valid
      return { isValid: true, convertedValue: stringValue }
      
    case 'DATE':
    case 'DATETIME':
    case 'TIMESTAMP':
      // Basic date validation
      if (stringValue && !isValidDateFormat(stringValue)) {
        return {
          isValid: false,
          error: `"${stringValue}" is not a valid date format. Please use formats like: 2024-12-25, 2024-12-25 10:30:00, or ISO format.`,
        }
      }
      return { isValid: true, convertedValue: stringValue }
      
    default:
      // Unknown type, allow as string
      return { isValid: true, convertedValue: stringValue }
  }
}

/**
 * Basic date format validation
 */
function isValidDateFormat(dateString: string): boolean {
  // Check common date formats
  const dateFormats = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, // YYYY-MM-DD HH:MM:SS
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO format
  ]
  
  // Check if it matches any format
  const matchesFormat = dateFormats.some(format => format.test(dateString))
  if (!matchesFormat) 
    return false
  
  // Try to parse as date
  const date = new Date(dateString)
  return !Number.isNaN(date.getTime())
}

/**
 * Validate multiple field values for a row update
 */
export function validateRowData(
  rowData: Record<string, any>, 
  columnTypes: Record<string, string>,
): { isValid: boolean, errors: Record<string, string>, convertedData?: Record<string, any> } {
  const errors: Record<string, string> = {}
  const convertedData: Record<string, any> = {}
  
  for (const [fieldName, value] of Object.entries(rowData)) {
    const columnType = columnTypes[fieldName]
    if (!columnType) 
      continue
    
    const validation = validateFieldValue(value, columnType)
    if (!validation.isValid) {
      errors[fieldName] = validation.error || 'Invalid value'
    }
    else {
      convertedData[fieldName] = validation.convertedValue
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    convertedData: Object.keys(errors).length === 0 ? convertedData : undefined,
  }
}

/**
 * Get user-friendly type name for display
 */
export function getDisplayTypeName(columnType: string): string {
  const normalizedType = columnType.toUpperCase()
  
  switch (normalizedType) {
    case 'INTEGER':
    case 'INT':
      return 'Whole Number'
    case 'REAL':
    case 'FLOAT':
    case 'DOUBLE':
    case 'NUMERIC':
      return 'Decimal Number'
    case 'BOOLEAN':
    case 'BOOL':
      return 'True/False'
    case 'TEXT':
    case 'VARCHAR':
    case 'CHAR':
    case 'STRING':
      return 'Text'
    case 'DATE':
      return 'Date'
    case 'DATETIME':
    case 'TIMESTAMP':
      return 'Date & Time'
    case 'BLOB':
      return 'Binary Data'
    default:
      return columnType
  }
} 
