/**
 * Database utility functions with strict TypeScript types
 */

/**
 * Interface for database column information
 */
interface DatabaseColumn {
  name: string
  type?: string
  nullable?: boolean
  primaryKey?: boolean
}

/**
 * Type for row data - values can be various types or null
 */
type RowData = Record<string, string | number | boolean | null | undefined>

/**
 * SQL value that can be safely inserted into queries
 */
type SqlValue = string | number | boolean | null

/**
 * Builds a unique WHERE condition for identifying a specific row
 * @param cols - Array of column definitions
 * @param rowData - The row data to build condition for
 * @returns SQL WHERE condition string
 */
export function buildUniqueCondition(cols: DatabaseColumn[], rowData: RowData | null | undefined): string {
  // Guard clause for null/undefined input
  if (!rowData || typeof rowData !== 'object') {
    console.warn('buildUniqueCondition: Invalid rowData provided')
    return ''
  }

  const conditions: string[] = []

  // Helper function to escape SQL values safely
  const escapeValue = (value: string | number | boolean | null | undefined): string => {
    if (value === null || value === undefined) {
      return 'NULL'
    }
    if (typeof value === 'number') {
      return value.toString()
    }
    if (typeof value === 'boolean') {
      return value ? '1' : '0'
    }
    // Escape single quotes in strings
    return `'${String(value).replace(/'/g, '\'\'')}'`
  }

  // Check if rowData is empty - if so, generate IS NULL conditions for all columns
  if (Object.keys(rowData).length === 0) {
    cols.forEach((col: DatabaseColumn) => {
      conditions.push(`${col.name} IS NULL`)
    })
    return conditions.join(' AND ')
  }

  // Try to find ID field first for more reliable updates
  const idField = Object.keys(rowData).find(key =>
    key.toLowerCase() === 'id'
    || key.toLowerCase().endsWith('_id'),
  )

  if (idField && rowData[idField] !== null && rowData[idField] !== undefined) {
    return `${idField} = ${escapeValue(rowData[idField])}`
  }

  // Look for primary key columns
  const primaryKeyCol = cols.find(col => col.primaryKey)
  if (primaryKeyCol && rowData[primaryKeyCol.name] !== null && rowData[primaryKeyCol.name] !== undefined) {
    return `${primaryKeyCol.name} = ${escapeValue(rowData[primaryKeyCol.name])}`
  }

  // Otherwise use all non-null fields
  cols.forEach((col: DatabaseColumn) => {
    const value = rowData[col.name]
    if (value !== null && value !== undefined && value !== '') {
      conditions.push(`${col.name} = ${escapeValue(value)}`)
    }
  })

  // If no conditions found, try to use all fields including null ones
  if (conditions.length === 0) {
    cols.forEach((col: DatabaseColumn) => {
      const value = rowData[col.name]
      if (value === null || value === undefined) {
        conditions.push(`${col.name} IS NULL`)
      }
      else {
        conditions.push(`${col.name} = ${escapeValue(value)}`)
      }
    })
  }

  if (conditions.length === 0) {
    throw new Error('Unable to build unique condition: no identifying fields found')
  }

  return conditions.join(' AND ')
}

/**
 * Validates if a table name is safe for SQL queries
 * @param tableName - The table name to validate
 * @returns true if the table name is safe to use
 */
export function isValidTableName(tableName: string): boolean {
  // Allow alphanumeric characters, underscores, and hyphens
  // Must start with a letter or underscore
  const tableNameRegex = /^[a-z_][\w-]*$/i
  return tableNameRegex.test(tableName)
}

/**
 * Validates if a column name is safe for SQL queries
 * @param columnName - The column name to validate
 * @returns true if the column name is safe to use
 */
export function isValidColumnName(columnName: string): boolean {
  // Allow alphanumeric characters and underscores
  // Must start with a letter or underscore
  const columnNameRegex = /^[a-z_]\w*$/i
  return columnNameRegex.test(columnName)
}

/**
 * Sanitizes a value for safe SQL insertion
 * @param value - The value to sanitize
 * @returns Sanitized SQL value
 */
export function sanitizeSqlValue(value: unknown): SqlValue {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value
  }
  if (typeof value === 'boolean') {
    return value
  }
  // Convert everything else to string and trim
  return String(value).trim()
}

/**
 * Builds a parameterized INSERT query
 * @param tableName - Name of the table
 * @param data - Data to insert
 * @returns Object with query string and parameters
 */
export function buildInsertQuery(
  tableName: string, 
  data: RowData,
): { query: string, params: SqlValue[] } {
  if (!isValidTableName(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`)
  }

  const columns = Object.keys(data).filter(key => isValidColumnName(key))
  if (columns.length === 0) {
    throw new Error('No valid columns found in data')
  }

  const placeholders = columns.map(() => '?').join(', ')
  const columnList = columns.join(', ')
  const params = columns.map(col => sanitizeSqlValue(data[col]))

  const query = `INSERT INTO ${tableName} (${columnList}) VALUES (${placeholders})`

  return { query, params }
}

/**
 * Builds a parameterized UPDATE query
 * @param tableName - Name of the table
 * @param data - Data to update
 * @param whereCondition - WHERE condition
 * @returns Object with query string and parameters
 */
export function buildUpdateQuery(
  tableName: string,
  data: RowData,
  whereCondition: string,
): { query: string, params: SqlValue[] } {
  if (!isValidTableName(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`)
  }

  const columns = Object.keys(data).filter(key => isValidColumnName(key))
  if (columns.length === 0) {
    throw new Error('No valid columns found in data')
  }

  const setClause = columns.map(col => `${col} = ?`).join(', ')
  const params = columns.map(col => sanitizeSqlValue(data[col]))

  const query = `UPDATE ${tableName} SET ${setClause} WHERE ${whereCondition}`

  return { query, params }
}
