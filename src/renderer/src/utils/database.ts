export function buildUniqueCondition(cols: any[], rowData: any) {
  const conditions: string[] = []

  // Helper function to escape SQL values
  const escapeValue = (value: any) => {
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

  // Try to find ID first for more reliable updates
  const idField = Object.keys(rowData).find(key =>
    key.toLowerCase() === 'id'
    || key.toLowerCase().endsWith('_id'),
  )

  if (idField && rowData[idField] !== null && rowData[idField] !== undefined) {
    return `${idField} = ${escapeValue(rowData[idField])}`
  }

  // Otherwise use all non-null fields
  cols.forEach((col: any) => {
    const value = rowData[col.name]
    if (value !== null && value !== undefined && value !== '') {
      conditions.push(`${col.name} = ${escapeValue(value)}`)
    }
  })

  // If no conditions found, try to use all fields including null ones
  if (conditions.length === 0) {
    cols.forEach((col: any) => {
      const value = rowData[col.name]
      if (value === null || value === undefined) {
        conditions.push(`${col.name} IS NULL`)
      }
      else {
        conditions.push(`${col.name} = ${escapeValue(value)}`)
      }
    })
  }

  return conditions.join(' AND ')
}
