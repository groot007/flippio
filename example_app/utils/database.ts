import * as SQLite from 'expo-sqlite'
import { Platform } from 'react-native'

// Database name
const DATABASE_NAME = 'flippio.db'

// Open the database
export function openDatabase() {
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
  return SQLite.openDatabaseAsync(DATABASE_NAME)
}

// Initialize database schema and create a pre-filled database if needed
export async function initDatabase() {
  try {
    const db = await openDatabase()

    // Drop the existing items table if it exists
    await db.execAsync(`DROP TABLE IF EXISTS items`)

    // Create a fresh items table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL,
        json_data TEXT
      );
    `)

    console.warn('Initializing database with new mock data...')

    // Current timestamp
    const now = Date.now()

    // Insert all mock data rows
    await db.runAsync(
      `INSERT INTO items (title, description, created_at, json_data) VALUES (?, ?, ?, ?)`,
      ['Product 1', 'Advanced thermostat with energy-saving features', now],
    )

    await db.runAsync(
      `INSERT INTO items (title, description, created_at, json_data) VALUES (?, ?, ?, ?)`,
      ['Product 2', 'Fresh and easy Mediterranean pasta salad', now - 86400000],
    )

    await db.runAsync(
      `INSERT INTO items (title, description, created_at, json_data) VALUES (?, ?, ?, ?)`,
      ['Product 3', 'Intermediate Power Yoga Flow with Sarah', now - 172800000],
    )

    await db.runAsync(
      `INSERT INTO items (title, description, created_at, json_data) VALUES (?, ?, ?, ?)`,
      ['Product 4', 'Version 3.2.1 with dark mode and improvements', now - 259200000],
    )
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
    return items.map(item => ({
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
    await db.runAsync(`DELETE FROM items WHERE id = ?`, [id])
  }
  catch (error) {
    console.error('Error deleting item from database:', error)
    throw error
  }
}
