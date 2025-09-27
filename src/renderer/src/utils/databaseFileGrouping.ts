import type { DatabaseFile } from '@renderer/types'

interface GroupedDatabaseFile extends DatabaseFile {
  label: string
  value: string
}

interface DatabaseFileGroup {
  label: string
  options: GroupedDatabaseFile[]
}

function truncatePath(fullPath: string, pathParts: string[]): string {
  if (fullPath.length <= 30) 
    return fullPath

  const folderParts = pathParts.slice(0, -1)
  const lastFolder = folderParts[folderParts.length - 1]

  let truncated = ''
  
  if (fullPath.includes('/data/data/')) {
    truncated = `/data/data/.../${lastFolder}`
  }
  else if (fullPath.includes('/sdcard/Android/data/')) {
    truncated = `/sdcard/.../${lastFolder}`
  }
  else if (fullPath.includes('/storage/emulated/0/Android/data/')) {
    truncated = `/storage/.../${lastFolder}`
  }
  else {
    const firstFolder = folderParts[0]
    truncated = `/${firstFolder}/.../${lastFolder}`
  }

  if (truncated.length > 30) {
    const parts = truncated.split('/')
    const lastPart = parts[parts.length - 1]
    if (lastPart.length > 10) {
      parts[parts.length - 1] = `${lastPart.slice(0, 7)}...`
      truncated = parts.join('/')
    }
  }

  return truncated
}

export function groupDatabaseFilesByLocation(databaseFiles: DatabaseFile[]): DatabaseFileGroup[] {
  if (!databaseFiles?.length) 
    return []

  const groupedByLocation = databaseFiles.reduce((acc, file) => {
    const fullPath = file.remotePath || file.path || ''
    let folderPath = 'Unknown Location'

    if (fullPath) {
      const pathParts = fullPath.split('/').filter(part => part.length > 0)
      
      if (pathParts.length > 0) {
        const fullFolderPath = `/${pathParts.slice(0, -1).join('/')}`
        folderPath = truncatePath(fullFolderPath, pathParts)
      }
      else {
        folderPath = file.location || 'Unknown Location'
      }
    }

    if (!acc[folderPath]) {
      acc[folderPath] = []
    }

    acc[folderPath].push({
      label: file.filename,
      value: file.path,
      ...file,
    })

    return acc
  }, {} as Record<string, GroupedDatabaseFile[]>)

  return Object.keys(groupedByLocation).map(location => ({
    label: location,
    options: groupedByLocation[location],
  }))
}
