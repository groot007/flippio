import Constants from 'expo-constants'
import * as FileSystem from 'expo-file-system'
import * as SQLite from 'expo-sqlite'
import { Platform } from 'react-native'

// Database name
const DATABASE_NAME = 'flippio.db'

type DatabaseHandle = Awaited<ReturnType<typeof openDatabase>>

export interface Item {
  id: number
  title: string
  description: string
  created_at: number
  json_data?: string
  jsonData?: unknown
}

export interface DatabaseFixture {
  databaseName: string
  description: string
  directory?: string
  path: string
  removable?: boolean
}

interface RandomRowPayload {
  title: string
  description: string
  jsonData: Record<string, unknown>
}

const RANDOM_ROW_TEMPLATES = [
  {
    title: 'Smart Sensor',
    description: 'Auto-generated home sensor snapshot',
    jsonData: {
      product: {
        name: 'Climate Sensor',
        price: 129.99,
        category: 'Smart Home',
        sku: 'SH',
      },
      features: ['Temperature', 'Humidity', 'Motion'],
      compatibility: {
        systems: ['HomeKit', 'Alexa'],
        wiring: ['Battery'],
      },
      ratings: {
        average: 4.7,
        count: 128,
      },
      inStock: true,
    },
  },
  {
    title: 'Summer Recipe',
    description: 'Auto-generated meal plan row',
    jsonData: {
      recipe: {
        name: 'Citrus Pasta Salad',
        prepTime: '15 min',
        cookTime: '10 min',
        difficulty: 'Easy',
      },
      ingredients: [
        { name: 'Pasta', amount: '250g' },
        { name: 'Feta', amount: '100g' },
        { name: 'Orange', amount: '1 whole' },
      ],
      nutrition: {
        calories: 420,
        protein: '14g',
        carbs: '51g',
      },
      tags: ['summer', 'quick', 'vegetarian'],
    },
  },
  {
    title: 'Fitness Class',
    description: 'Auto-generated studio booking row',
    jsonData: {
      class: {
        name: 'Power Mobility',
        duration: '45 min',
        level: 'Intermediate',
        instructor: 'Jordan',
      },
      schedule: [
        { day: 'Tuesday', time: '18:30' },
        { day: 'Saturday', time: '09:00' },
      ],
      equipment: ['Mat', 'Resistance Band'],
      benefits: ['Mobility', 'Core', 'Recovery'],
      studio: {
        name: 'Studio North',
        location: 'Warsaw',
        room: 'Room B',
      },
    },
  },
  {
    title: 'App Update',
    description: 'Auto-generated release note row',
    jsonData: {
      update: {
        version: '4.1.0',
        releaseDate: '2026-07-18',
        size: '82 MB',
        required: false,
      },
      changes: [
        { type: 'feature', description: 'Faster database sync' },
        { type: 'fix', description: 'Improved row editor stability' },
      ],
      compatibility: {
        minOsVersion: 'iOS 16',
        devices: ['iPhone', 'iPad'],
      },
      metrics: {
        installs: 14320,
        crashFree: '99.8%',
      },
    },
  },
] as const satisfies RandomRowPayload[]

function randomInt(max: number) {
  return Math.floor(Math.random() * max)
}

export function buildRandomItemPayload(): RandomRowPayload {
  const template = RANDOM_ROW_TEMPLATES[randomInt(RANDOM_ROW_TEMPLATES.length)]
  const suffix = randomInt(1000).toString().padStart(3, '0')
  const createdAt = new Date().toISOString()

  return {
    title: `${template.title} ${suffix}`,
    description: `${template.description} at ${createdAt}`,
    jsonData: {
      ...template.jsonData,
      generatedAt: createdAt,
      seed: suffix,
    },
  }
}

// Open the database
export function openDatabase(
  databaseName: string = DATABASE_NAME,
  directory?: string,
  options?: SQLite.SQLiteOpenOptions,
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
  return SQLite.openDatabaseAsync(databaseName, options, directory)
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

function buildDatabasePath(databaseName: string, directory?: string) {
  if (!directory) {
    return databaseName
  }

  const normalizedDirectory = directory.endsWith('/')
    ? directory
    : `${directory}/`

  return `${normalizedDirectory}${databaseName}`
}

function toFileSystemLocation(path: string) {
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(path)) {
    return path
  }

  if (path.startsWith('/')) {
    return `file://${path}`
  }

  return path
}

function getDefaultDatabaseFixture(): DatabaseFixture {
  return {
    databaseName: DATABASE_NAME,
    description: 'Primary app database',
    directory: SQLite.defaultDatabaseDirectory,
    path: buildDatabasePath(DATABASE_NAME, SQLite.defaultDatabaseDirectory),
  }
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
      path: buildDatabasePath('documents-fixture.db', documentDirectory),
    },
    {
      databaseName: 'library-root-fixture.db',
      description: 'Library root fixture',
      directory: libraryDirectory,
      path: buildDatabasePath('library-root-fixture.db', libraryDirectory),
    },
    {
      databaseName: 'application-support-fixture.db',
      description: 'Library/Application Support fixture',
      directory: `${libraryDirectory}Application Support/`,
      path: buildDatabasePath(
        'application-support-fixture.db',
        `${libraryDirectory}Application Support/`,
      ),
    },
    {
      databaseName: 'local-database-fixture.db',
      description: 'Library/LocalDatabase fixture',
      directory: `${libraryDirectory}LocalDatabase/`,
      path: buildDatabasePath(
        'local-database-fixture.db',
        `${libraryDirectory}LocalDatabase/`,
      ),
    },
  ]

  if (bundleIdentifier) {
    fixtures.push({
      databaseName: 'bundle-folder-fixture.db',
      description: 'Library/<bundle id> fixture',
      directory: `${libraryDirectory}${bundleIdentifier}/`,
      path: buildDatabasePath(
        'bundle-folder-fixture.db',
        `${libraryDirectory}${bundleIdentifier}/`,
      ),
    })
  }

  return fixtures
}

async function listManagedDatabaseFixtures(): Promise<DatabaseFixture[]> {
  const directory = SQLite.defaultDatabaseDirectory

  if (!directory) {
    return []
  }

  try {
    const entries = await FileSystem.readDirectoryAsync(toFileSystemLocation(directory))
    const databaseNames = entries
      .filter(name => name.endsWith('.db'))
      .filter(name => name !== DATABASE_NAME)
      .filter(name => name === 'Flip your DB.db' || /^Flip\.io \d+\.db$/.test(name))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))

    return databaseNames.map(databaseName => ({
      databaseName,
      description: 'User-managed test database',
      directory,
      path: buildDatabasePath(databaseName, directory),
      removable: true,
    }))
  }
  catch (error) {
    console.error('Error listing managed databases:', error)
    return []
  }
}

function getStaticDatabaseFixtures(): DatabaseFixture[] {
  const fixtures = [getDefaultDatabaseFixture()]

  if (Platform.OS === 'ios') {
    fixtures.push(
      {
        databaseName: 'expo-default-fixture.db',
        description: 'expo-sqlite default directory fixture',
        directory: SQLite.defaultDatabaseDirectory,
        path: buildDatabasePath(
          'expo-default-fixture.db',
          SQLite.defaultDatabaseDirectory,
        ),
      },
      ...getIosFixtureDirectories(),
    )
  }

  return fixtures
}

export async function getDatabaseFixtures(): Promise<DatabaseFixture[]> {
  const fixtures = getStaticDatabaseFixtures()
  const managedFixtures = await listManagedDatabaseFixtures()

  return [...fixtures, ...managedFixtures]
}

async function createEmptyDatabaseFixture(databaseName: string) {
  const db = await openDatabase(databaseName, SQLite.defaultDatabaseDirectory)
  await ensureSchema(db)
  await db.closeAsync()
}

export async function createManagedDatabase() {
  const fixtures = await listManagedDatabaseFixtures()
  const existingNames = new Set(fixtures.map(fixture => fixture.databaseName))

  let databaseName = 'Flip your DB.db'

  if (existingNames.has(databaseName)) {
    let index = 2
    while (existingNames.has(`Flip.io ${index}.db`)) {
      index += 1
    }

    databaseName = `Flip.io ${index}.db`
  }

  await createEmptyDatabaseFixture(databaseName)

  return {
    databaseName,
    path: buildDatabasePath(databaseName, SQLite.defaultDatabaseDirectory),
  }
}

export async function removeDatabaseFixture(fixture: DatabaseFixture) {
  if (!fixture.removable) {
    throw new Error('Only managed test databases can be removed.')
  }

  await FileSystem.deleteAsync(toFileSystemLocation(fixture.path), { idempotent: true })
  await FileSystem.deleteAsync(toFileSystemLocation(`${fixture.path}-wal`), { idempotent: true })
  await FileSystem.deleteAsync(toFileSystemLocation(`${fixture.path}-shm`), { idempotent: true })
}

async function initIosFixtureDatabases() {
  if (Platform.OS !== 'ios') {
    return
  }

  const fixtures = (await getDatabaseFixtures()).filter(
    fixture => fixture.databaseName !== DATABASE_NAME,
  ).filter(
    fixture => !fixture.removable,
  )

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

// Get all items from the selected database
export async function getItems(
  databaseName: string = DATABASE_NAME,
  directory?: string,
): Promise<Item[]> {
  let db: DatabaseHandle | null = null

  try {
    db = await openDatabase(databaseName, directory, { useNewConnection: true })
    await ensureSchema(db)
    // @ts-expect-error types
    const items = await db.getAllAsync<Item>(`SELECT * FROM items ORDER BY created_at DESC`)

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
  finally {
    await db?.closeAsync()
  }
}

// Add a new item to the database with optional JSON data
export async function addItem(
  title: string,
  description: string,
  jsonData?: unknown,
  databaseName: string = DATABASE_NAME,
  directory?: string,
) {
  let db: DatabaseHandle | null = null

  try {
    db = await openDatabase(databaseName, directory, { useNewConnection: true })
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
  finally {
    await db?.closeAsync()
  }
}

// Delete an item from the database
export async function deleteItem(
  id: number,
  databaseName: string = DATABASE_NAME,
  directory?: string,
) {
  let db: DatabaseHandle | null = null

  try {
    db = await openDatabase(databaseName, directory, { useNewConnection: true })
    await ensureSchema(db)
    await db.runAsync(`DELETE FROM items WHERE id = ?`, [id])
  }
  catch (error) {
    console.error('Error deleting item from database:', error)
    throw error
  }
  finally {
    await db?.closeAsync()
  }
}
