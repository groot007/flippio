import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { app, ipcMain } from 'electron'
import sqlite3 from 'sqlite3'

export function setupIpcDatabase() {
  let db: sqlite3.Database | null = null

  ipcMain.handle('db:scanForDatabases', async (_event, directory = '') => {
    try {
      let baseDirs: string[] = []

      // If no directory specified, use some default locations
      if (!directory) {
        if (process.platform === 'darwin') { // macOS
          const homeDir = app.getPath('home')
          baseDirs = [
            homeDir,
            path.join(homeDir, 'Documents'),
            path.join(homeDir, 'Downloads'),
          ]
        }
        else if (process.platform === 'win32') { // Windows
          baseDirs = [
            app.getPath('documents'),
            app.getPath('downloads'),
            'C:\\',
            'D:\\',
          ]
        }
        else { // Linux and others
          const homeDir = app.getPath('home')
          baseDirs = [
            homeDir,
            '/var/lib',
          ]
        }
      }
      else {
        baseDirs = [directory]
      }

      const dbFiles: { path: string, name: string, size: number, modifiedTime: string }[] = []
      const extensions = ['.db', '.sqlite', '.sqlite3', '.db3']

      // Scan directories for database files (only first level)
      for (const dir of baseDirs) {
        try {
          if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir)

            for (const file of files) {
              const fullPath = path.join(dir, file)

              try {
                // Check if it's a file and has the right extension
                const stat = fs.statSync(fullPath)
                if (stat.isFile() && extensions.some(ext => file.toLowerCase().endsWith(ext))) {
                  dbFiles.push({
                    path: fullPath,
                    name: file,
                    size: stat.size,
                    modifiedTime: stat.mtime.toISOString(),
                  })
                }
              }
              catch (fileErr) {
                // Skip errors for individual files
                console.error(`Error checking file ${fullPath}:`, fileErr)
              }
            }
          }
        }
        catch (dirErr) {
          console.error(`Error scanning directory ${dir}:`, dirErr)
          // Continue with next directory
        }
      }

      return { success: true, files: dbFiles }
    }
    catch (error: any) {
      console.error('Error scanning for database files', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:open', async (_event, filePath) => {
    try {
      // Close previous connection if exists
      if (db) {
        await new Promise<void>((resolve, reject) => {
          db!.close((err) => {
            if (err)
              reject(err)
            else resolve()
          })
        })
        db = null // Ensure we clear the reference
      }

      // Open new connection - properly promisified
      db = await new Promise<sqlite3.Database>((resolve, reject) => {
        const database = new sqlite3.Database(filePath, (err) => {
          if (err) {
            console.error('Could not connect to database', err)
            reject(err)
          }
          else {
            resolve(database)
          }
        })
      })

      return { success: true, path: filePath }
    }
    catch (error: any) {
      console.error('Error opening database', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:getTables', async () => {
    if (!db)
      return { success: false, error: 'No database connection' }

    try {
      const tables = await new Promise<any[]>((resolve, reject) => {
        db!.all('SELECT name FROM sqlite_master WHERE type=\'table\' AND name NOT LIKE \'sqlite_%\'', (err, rows) => {
          if (err)
            reject(err)
          else resolve(rows)
        })
      })

      return { success: true, tables }
    }
    catch (error: any) {
      console.error('Error getting tables', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:getTableData', async (_event, tableName) => {
    if (!db)
      return { success: false, error: 'No database connection' }

    try {
      // Get column info
      const columns = await new Promise<any[]>((resolve, reject) => {
        db!.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
          if (err)
            reject(err)
          else resolve(rows)
        })
      })

      // Get table data
      const rows = await new Promise<any[]>((resolve, reject) => {
        db!.all(`SELECT * FROM ${tableName}`, (err, rows) => {
          if (err)
            reject(err)
          else resolve(rows)
        })
      })

      return { success: true, columns, rows }
    }
    catch (error: any) {
      console.error(`Error getting data for table ${tableName}`, error)
      return { success: false, error: error.message }
    }
  })

  // Add this new handler to get information about a database file
  ipcMain.handle('db:getInfo', async (_event, filePath) => {
    try {
      // Get file stats
      const stats = fs.statSync(filePath)

      // Open the database to get metadata
      const tempDb = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY)

      // Get tables
      const tables = await new Promise<any[]>((resolve, reject) => {
        tempDb.all('SELECT name FROM sqlite_master WHERE type=\'table\' AND name NOT LIKE \'sqlite_%\'', (err, rows) => {
          if (err)
            reject(err)
          else resolve(rows)
        })
      })

      // Close the temp database
      await new Promise<void>((resolve, reject) => {
        tempDb.close((err) => {
          if (err)
            reject(err)
          else resolve()
        })
      })

      return {
        success: true,
        info: {
          size: stats.size,
          modified: stats.mtime,
          tableCount: tables.length,
          tables: tables.map(t => t.name),
        },
      }
    }
    catch (error: any) {
      console.error('Error getting database info', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:updateTableRow', async (_event, tableName, row, condition) => {
    if (!db)
      return { success: false, error: 'No database connection' }

    try {
      const columns = Object.keys(row)
      const setClause = columns.map(col => `${col} = ?`).join(', ')
      const values = columns.map(col => row[col])

      // Add condition values
      const query = `UPDATE ${tableName} SET ${setClause} WHERE ${condition}`

      const result = await new Promise<any>((resolve, reject) => {
        db!.run(query, values, function (err) {
          if (err)
            reject(err)
          else resolve({ changes: this.changes })
        })
      })

      return { success: true, ...result }
    }
    catch (error: any) {
      console.error('Error updating row', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:insertTableRow', async (_event, tableName, row) => {
    if (!db)
      return { success: false, error: 'No database connection' }

    try {
      const columns = Object.keys(row)
      const placeholders = columns.map(() => '?').join(', ')
      const values = columns.map(col => row[col])

      const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`

      const result = await new Promise<any>((resolve, reject) => {
        db!.run(query, values, function (err) {
          if (err)
            reject(err)
          else resolve({ id: this.lastID, changes: this.changes })
        })
      })

      return { success: true, ...result }
    }
    catch (error: any) {
      console.error('Error inserting row', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:deleteTableRow', async (_event, tableName, condition) => {
    if (!db)
      return { success: false, error: 'No database connection' }

    try {
      const query = `DELETE FROM ${tableName} WHERE ${condition}`

      const result = await new Promise<any>((resolve, reject) => {
        db!.run(query, function (err) {
          if (err)
            reject(err)
          else resolve({ changes: this.changes })
        })
      })

      return { success: true, ...result }
    }
    catch (error: any) {
      console.error('Error deleting row', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('db:executeQuery', async (_event, query, _dbPath = '', params = []) => {
    if (!db)
      return { success: false, error: 'No database connection' }

    try {
      const isSelect = query.trim().toUpperCase().startsWith('SELECT')

      if (isSelect) {
        const rows = await new Promise<any[]>((resolve, reject) => {
          db!.all(query, params, (err, rows) => {
            if (err)
              reject(err)
            else resolve(rows)
          })
        })

        const columns = rows.length > 0
          ? Object.keys(rows[0]).map(name => ({ name, type: '' }))
          : []

        return { success: true, rows, columns }
      }
      else {
        const result = await new Promise<any>((resolve, reject) => {
          db!.run(query, params, function (err) {
            if (err)
              reject(err)
            else resolve({ changes: this.changes, lastID: this.lastID })
          })
        })

        return { success: true, ...result }
      }
    }
    catch (error: any) {
      console.error('Error executing query', error)
      return { success: false, error: error.message }
    }
  })
}
