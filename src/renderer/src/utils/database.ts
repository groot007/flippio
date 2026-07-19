export function buildUniqueCondition(cols: any[], rowData: any) {
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

  if (rowData?.__flippio_rowid !== null && rowData?.__flippio_rowid !== undefined) {
    return `rowid = ${escapeValue(rowData.__flippio_rowid)}`
  }

  const primaryKeyColumns = cols.filter((col: any) => col?.pk)
  if (primaryKeyColumns.length > 0) {
    return primaryKeyColumns.map((col: any) => {
      const value = rowData[col.name]
      if (value === null || value === undefined) {
        return `${col.name} IS NULL`
      }
      return `${col.name} = ${escapeValue(value)}`
    }).join(' AND ')
  }

  // Try to find ID-like fields next
  const idField = Object.keys(rowData).find(key =>
    key.toLowerCase() === 'id'
    || key.toLowerCase().endsWith('_id'),
  )

  if (idField && rowData[idField] !== null && rowData[idField] !== undefined) {
    return `${idField} = ${escapeValue(rowData[idField])}`
  }

  const conditions = cols.map((col: any) => {
    const value = rowData[col.name]
    if (value === null || value === undefined) {
      return `${col.name} IS NULL`
    }
    return `${col.name} = ${escapeValue(value)}`
  })

  return conditions.join(' AND ')
}
