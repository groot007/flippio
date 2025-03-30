export function isJsonValue(value) {
  if (typeof value !== 'string')
    return false

  try {
    const json = JSON.parse(value)
    return typeof json === 'object' && json !== null
  }
  catch {
    return false
  }
}

export function parseJson(value) {
  if (typeof value !== 'string')
    return value

  try {
    return JSON.parse(value)
  }
  catch {
    return value
  }
}
