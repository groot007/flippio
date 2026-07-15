import * as SQLite from 'expo-sqlite'
import * as FileSystem from 'expo-file-system'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

// Database name
const DATABASE_NAME = 'flippio.db'

type DatabaseHandle = Awaited<ReturnType<typeof openDatabase>>

interface DatabaseFixture {
  databaseName: string
  description: string
  directory?: string
}

// Open the database
export function openDatabase(
  databaseName: string = DATABASE_NAME,
  directory?: string,
) {
  if (Platform.OS === 'web') {
    return {
      transaction: () => {
        return {
          executeSql: () => {},
        }
      },
      closeAsync: () => {},
      execAsync: () => Promise.resolve(),
      getFirstAsync: () => Promise.resolve({}),
      getAllAsync: () => Promise.resolve([]),
      runAsync: () => Promise.resolve({ changes: 0, lastInsertRowId: 0 }),
    } as any
  }

  // This is the correct way to open the database in expo-sqlite
  return SQLite.openDatabaseAsync(databaseName, undefined, directory)
}

async function ensureSchema(db: DatabaseHandle) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL,
      json_data TEXT
    );
  `)
}

async function seedIfEmpty(db: DatabaseHandle) {
  await ensureSchema(db)

  const existing = await db.getFirstAsync(
    `SELECT COUNT(*) as count FROM items`,
  ) as { count?: number } | null

  if ((existing?.count ?? 0) > 0) {
    return
  }

  console.warn('Initializing database with mock data...')

  const now = Date.now()

  await db.runAsync(
    `INSERT INTO items (title, description, created_at) VALUES (?, ?, ?)`,
    ['Product 1', 'Advanced thermostat with energy-saving features', now],
  )

  await db.runAsync(
    `INSERT INTO items (title, description, created_at) VALUES (?, ?, ?)`,
    ['Product 2', 'Fresh and easy Mediterranean pasta salad', now - 86400000],
  )

  await db.runAsync(
    `INSERT INTO items (title, description, created_at) VALUES (?, ?, ?)`,
    ['Product 3', 'Intermediate Power Yoga Flow with Sarah', now - 172800000],
  )

  await db.runAsync(
    `INSERT INTO items (title, description, created_at) VALUES (?, ?, ?)`,
    ['Product 4', 'Version 3.2.1 with dark mode and improvements', now - 259200000],
  )
}

async function seedFixtureDatabase(db: DatabaseHandle, description: string) {
  await ensureSchema(db)

  const existing = await db.getFirstAsync(
    `SELECT COUNT(*) as count FROM items`,
  ) as { count?: number } | null

  if ((existing?.count ?? 0) > 0) {
    return
  }

  await db.runAsync(
    `INSERT INTO items (title, description, created_at, json_data) VALUES (?, ?, ?, ?)`,
    [
      'Storage Fixture',
      description,
      Date.now(),
      JSON.stringify({
        location: description,
        createdBy: 'example_app',
      }),
    ],
  )
}

function getIosFixtureDirectories() {
  const documentDirectory = FileSystem.documentDirectory

  if (!documentDirectory) {
    return []
  }

  const libraryDirectory = documentDirectory.replace(/Documents\/?$/, 'Library/')
  const bundleIdentifier = Constants.expoConfig?.ios?.bundleIdentifier

  const fixtures: DatabaseFixture[] = [
    {
      databaseName: 'documents-fixture.db',
      description: 'Documents directory fixture',
      directory: documentDirectory,
    },
    {
      databaseName: 'library-root-fixture.db',
      description: 'Library root fixture',
      directory: libraryDirectory,
    },
    {
      databaseName: 'application-support-fixture.db',
      description: 'Library/Application Support fixture',
      directory: `${libraryDirectory}Application Support/`,
    },
    {
      databaseName: 'local-database-fixture.db',
      description: 'Library/LocalDatabase fixture',
      directory: `${libraryDirectory}LocalDatabase/`,
    },
  ]

  if (bundleIdentifier) {
    fixtures.push({
      databaseName: 'bundle-folder-fixture.db',
      description: 'Library/<bundle id> fixture',
      directory: `${libraryDirectory}${bundleIdentifier}/`,
    })
  }

  return fixtures
}

async function initIosFixtureDatabases() {
  if (Platform.OS !== 'ios') {
    return
  }

  const fixtures = [
    {
      databaseName: 'expo-default-fixture.db',
      description: 'expo-sqlite default directory fixture',
      directory: SQLite.defaultDatabaseDirectory,
    },
    ...getIosFixtureDirectories(),
  ]

  for (const fixture of fixtures) {
    const db = await openDatabase(fixture.databaseName, fixture.directory)
    await seedFixtureDatabase(db, fixture.description)
  }
}

// Initialize database schema and create a pre-filled database if needed
export async function initDatabase() {
  try {
    const db = await openDatabase()
    await seedIfEmpty(db)
    await initIosFixtureDatabases()
  }
  catch (error) {
    console.error('Error initializing database:', error)
    throw error
  }
}

// Get all items from the database
export async function getItems() {
  try {
    const db = await openDatabase()
    await ensureSchema(db)
    // @ts-expect-error types
    const items = await db.getAllAsync<{
      id: number
      title: string
      description: string
      created_at: number
      json_data: string
    }>(`SELECT * FROM items ORDER BY created_at DESC`)

    // Parse JSON data for each item
    // @ts-expect-error types
    return items?.map(item => ({
      ...item,
      jsonData: item.json_data ? JSON.parse(item.json_data) : null,
    }))
  }
  catch (error) {
    console.error('Error getting items from database:', error)
    return []
  }
}

// Add a new item to the database with optional JSON data
export async function addItem(title: string, description: string, jsonData?: any) {
  try {
    const db = await openDatabase()
    await ensureSchema(db)
    const jsonString = jsonData ? JSON.stringify(jsonData) : null

    const result = await db.runAsync(
      `INSERT INTO items (title, description, created_at, json_data) VALUES (?, ?, ?, ?)`,
      [title, description, Date.now(), jsonString],
    )
    return result.lastInsertRowId
  }
  catch (error) {
    console.error('Error adding item to database:', error)
    throw error
  }
}

// Delete an item from the database
export async function deleteItem(id: number) {
  try {
    const db = await openDatabase()
    await ensureSchema(db)
    await db.runAsync(`DELETE FROM items WHERE id = ?`, [id])
  }
  catch (error) {
    console.error('Error deleting item from database:', error)
    throw error
  }
}
