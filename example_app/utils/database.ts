import * as FileSystem from 'expo-file-system'
import * as SQLite from 'expo-sqlite'
import { Platform } from 'react-native'

export type DatabaseTarget = 'library' | 'documents'

type DatabaseConfig = {
  directory?: string
  directoryLabel: string
  id: DatabaseTarget
  name: string
}

const DATABASE_CONFIGS: Record<DatabaseTarget, DatabaseConfig> = {
  library: {
    id: 'library',
    name: 'flippio-library.db',
    directory: SQLite.defaultDatabaseDirectory ?? undefined,
    directoryLabel: 'Library',
  },
  documents: {
    id: 'documents',
    name: 'flippio-documents.db',
    directory: FileSystem.documentDirectory ?? undefined,
    directoryLabel: 'Documents',
  },
}

type SeedItem = {
  createdAtOffset: number
  description: string
  jsonData?: unknown
  title: string
}

type DatabaseLike = {
  closeAsync: () => Promise<void> | void
  execAsync: (source: string) => Promise<void>
  getAllAsync: <T>(source: string) => Promise<T[]>
  getFirstAsync: <T>(source: string) => Promise<T | null>
  runAsync: (source: string, params: any) => Promise<{ changes: number, lastInsertRowId: number }>
  transaction?: () => {
    executeSql: () => void
  }
}

const LIBRARY_ITEMS: SeedItem[] = [
  {
    title: 'Library Product 1',
    description: 'Stored in Library to mirror the default iOS SQLite location.',
    createdAtOffset: 0,
    jsonData: {
      product: {
        name: 'Library Thermostat',
        price: 129.99,
        category: 'Smart Home',
        sku: 'LIB-THERM-001',
      },
      features: ['Auto schedule', 'Humidity sensor', 'HomeKit'],
      compatibility: {
        systems: ['iOS', 'Android'],
        wiring: ['C-wire', 'Battery'],
      },
      ratings: {
        average: 4.8,
        count: 248,
      },
      inStock: true,
    },
  },
  {
    title: 'Library Recipe',
    description: 'Example row that should be discoverable under Library.',
    createdAtOffset: 86_400_000,
    jsonData: {
      recipe: {
        name: 'Pasta al Limone',
        prepTime: '10 min',
        cookTime: '15 min',
        difficulty: 'Easy',
      },
      ingredients: [
        { name: 'Pasta', amount: '250g' },
        { name: 'Lemon', amount: '2 pcs' },
        { name: 'Parmesan', amount: '50g' },
      ],
      nutrition: {
        calories: 540,
        protein: '18g',
      },
      tags: ['library', 'sqlite', 'ios'],
    },
  },
]

const DOCUMENT_ITEMS: SeedItem[] = [
  {
    title: 'Documents Fitness Class',
    description: 'Stored in Documents so Flippio can test the file-sharing path.',
    createdAtOffset: 0,
    jsonData: {
      class: {
        name: 'Power Mobility',
        duration: '45 min',
        level: 'Intermediate',
        instructor: 'Nina',
      },
      schedule: [
        { day: 'Monday', time: '07:30' },
        { day: 'Thursday', time: '18:00' },
      ],
      equipment: ['Yoga mat', 'Resistance band'],
      benefits: ['Mobility', 'Strength', 'Recovery'],
      studio: {
        name: 'Flippio Lab',
        location: 'Warsaw',
        room: 'Studio A',
      },
    },
  },
  {
    title: 'Documents App Update',
    description: 'Example row that should be discoverable under Documents.',
    createdAtOffset: 172_800_000,
    jsonData: {
      update: {
        version: '0.4.3-dev',
        releaseDate: '2026-07-15',
        size: '18 MB',
        required: false,
      },
      changes: [
        { type: 'feature', description: 'Added Documents and Library SQLite discovery.' },
        { type: 'fix', description: 'Improved iOS file scanning diagnostics.' },
      ],
      compatibility: {
        minOsVersion: 'iOS 16',
        devices: ['iPhone', 'iPad'],
      },
      metrics: {
        downloads: 1280,
        rating: 4.9,
      },
    },
  },
]

const SEED_DATA: Record<DatabaseTarget, SeedItem[]> = {
  library: LIBRARY_ITEMS,
  documents: DOCUMENT_ITEMS,
}

function getDatabaseConfig(target: DatabaseTarget): DatabaseConfig {
  return DATABASE_CONFIGS[target]
}

function resolveDatabasePath({ directory, name }: DatabaseConfig): string {
  if (!directory) {
    return name
  }
  return `${directory.replace(/\/*$/, '')}/${name}`
}

async function openDatabase(target: DatabaseTarget): Promise<DatabaseLike> {
  if (Platform.OS === 'web') {
    return {
      closeAsync: () => {},
      execAsync: () => Promise.resolve(),
      getAllAsync: () => Promise.resolve([]),
      getFirstAsync: () => Promise.resolve(null),
      runAsync: () => Promise.resolve({ changes: 0, lastInsertRowId: 0 }),
      transaction: () => ({
        executeSql: () => {},
      }),
    } satisfies DatabaseLike
  }

  const config = getDatabaseConfig(target)
  return await SQLite.openDatabaseAsync(config.name, undefined, config.directory)
}

async function seedDatabase(target: DatabaseTarget) {
  const db = await openDatabase(target)
  const config = getDatabaseConfig(target)

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL,
      json_data TEXT,
      db_location TEXT NOT NULL
    );
  `)

  const existing = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM items')
  if ((existing?.count ?? 0) > 0) {
    return
  }

  const now = Date.now()
  for (const item of SEED_DATA[target]) {
    await db.runAsync(
      `INSERT INTO items (title, description, created_at, json_data, db_location) VALUES (?, ?, ?, ?, ?)`,
      [
        item.title,
        item.description,
        now - item.createdAtOffset,
        item.jsonData ? JSON.stringify(item.jsonData) : null,
        config.directoryLabel,
      ],
    )
  }
}

export async function initDatabases() {
  await Promise.all((Object.keys(DATABASE_CONFIGS) as DatabaseTarget[]).map(seedDatabase))
}

export async function initDatabase() {
  await initDatabases()
}

export function getDatabaseTargets() {
  return (Object.keys(DATABASE_CONFIGS) as DatabaseTarget[]).map((target) => {
    const config = getDatabaseConfig(target)
    return {
      id: config.id,
      name: config.name,
      directory: config.directory ?? 'default',
      directoryLabel: config.directoryLabel,
      absolutePath: resolveDatabasePath(config),
    }
  })
}

export async function getItems(target: DatabaseTarget) {
  try {
    const db = await openDatabase(target)
    const items = await db.getAllAsync<{
      created_at: number
      db_location: string
      description: string
      id: number
      json_data: string
      title: string
    }>(`SELECT * FROM items ORDER BY created_at DESC`)

    return items?.map((item) => ({
      ...item,
      jsonData: item.json_data ? JSON.parse(item.json_data) : null,
    }))
  }
  catch (error) {
    console.error(`Error getting items from ${target} database:`, error)
    return []
  }
}

export async function addItem(
  target: DatabaseTarget,
  title: string,
  description: string,
  jsonData?: unknown,
) {
  try {
    const db = await openDatabase(target)
    const config = getDatabaseConfig(target)
    const jsonString = jsonData ? JSON.stringify(jsonData) : null

    const result = await db.runAsync(
      `INSERT INTO items (title, description, created_at, json_data, db_location) VALUES (?, ?, ?, ?, ?)`,
      [title, description, Date.now(), jsonString, config.directoryLabel],
    )
    return result.lastInsertRowId
  }
  catch (error) {
    console.error(`Error adding item to ${target} database:`, error)
    throw error
  }
}

export async function deleteItem(target: DatabaseTarget, id: number) {
  try {
    const db = await openDatabase(target)
    await db.runAsync(`DELETE FROM items WHERE id = ?`, [id])
  }
  catch (error) {
    console.error(`Error deleting item from ${target} database:`, error)
    throw error
  }
}
