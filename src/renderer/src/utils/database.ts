export function buildUniqueCondition(cols, rowData) {
  const conditions: string[] = []

  // Try to find ID first for more reliable updates
  const idField = Object.keys(rowData).find(key =>
    key.toLowerCase() === 'id'
    || key.toLowerCase().endsWith('_id'),
  )

  if (idField && rowData[idField]) {
    return `${idField} = '${rowData[idField]}'`
  }

  // Otherwise use all non-empty fields
  cols.forEach((col) => {
    if (rowData[col.name]) {
      conditions.push(`${col.name} = '${rowData[col.name]}'`)
    }
  })

  return conditions.join(' AND ')
}
