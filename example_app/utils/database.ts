import Constants from 'expo-constants'
import * as FileSystem from 'expo-file-system'
import {
  ANDROID_DATABASE_PATH,
  type DB,
  IOS_LIBRARY_PATH,
  open,
  type Scalar,
} from '@op-engineering/op-sqlite'
import { Platform } from 'react-native'

// Database name
const DATABASE_NAME = 'flippio.db'

interface DatabaseHandle {
  closeAsync: () => Promise<void>
  execAsync: (sql: string) => Promise<void>
  getFirstAsync: <T>(sql: string, params?: Scalar[]) => Promise<T | null>
  getAllAsync: <T>(sql: string, params?: Scalar[]) => Promise<T[]>
  runAsync: (
    sql: string,
    params?: Scalar[],
  ) => Promise<{ changes: number; lastInsertRowId?: number }>
}

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
  sqlcipherKey?: string
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

const SQLCIPHER_FIXTURE_NAME = 'sqlcipher_items_sample.db'
const SQLCIPHER_FIXTURE_KEY = 'flippio-secret'
const SQLCIPHER_FIXTURE_DESCRIPTION = 'SQLCipher encrypted fixture'
const DEFAULT_DATABASE_DIRECTORY = Platform.OS === 'ios'
  ? `${IOS_LIBRARY_PATH}/SQLite`
  : ANDROID_DATABASE_PATH

let initDatabasePromise: Promise<void> | null = null

function randomInt(max: number) {
  return Math.floor(Math.random() * max)
}

async function closeDatabase(db: DatabaseHandle | null | undefined) {
  if (!db) {
    return
  }

  await db.closeAsync().catch(() => undefined)
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
): DatabaseHandle {
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

  const encryptionKey = getSqlcipherKey(databaseName)
  const options = {
    name: databaseName,
    location: directory ?? DEFAULT_DATABASE_DIRECTORY,
    ...(encryptionKey ? { encryptionKey } : {}),
  }

  return adaptDatabase(open(options))
}

function adaptDatabase(db: DB): DatabaseHandle {
  return {
    closeAsync: () => db.closeAsync(),
    execAsync: async (sql) => {
      await db.execute(sql)
    },
    getFirstAsync: async <T>(sql: string, params?: Scalar[]) => {
      const result = await db.execute(sql, params)
      return (result.rows[0] as T | undefined) ?? null
    },
    getAllAsync: async <T>(sql: string, params?: Scalar[]) => {
      const result = await db.execute(sql, params)
      return result.rows as T[]
    },
    runAsync: async (sql, params) => {
      const result = await db.execute(sql, params)
      return {
        changes: result.rowsAffected,
        lastInsertRowId: result.insertId,
      }
    },
  }
}

function getSqlcipherKey(databaseName: string) {
  if (databaseName === SQLCIPHER_FIXTURE_NAME) {
    return SQLCIPHER_FIXTURE_KEY
  }

  return null
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

async function openFixtureDatabase(
  databaseName: string,
  directory?: string,
): Promise<DatabaseHandle> {
  return openDatabase(databaseName, directory)
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
    directory: DEFAULT_DATABASE_DIRECTORY,
    path: buildDatabasePath(DATABASE_NAME, DEFAULT_DATABASE_DIRECTORY),
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
  const directory = DEFAULT_DATABASE_DIRECTORY

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
  const fixtures = [
    getDefaultDatabaseFixture(),
    {
      databaseName: SQLCIPHER_FIXTURE_NAME,
      description: SQLCIPHER_FIXTURE_DESCRIPTION,
      directory: DEFAULT_DATABASE_DIRECTORY,
      path: buildDatabasePath(SQLCIPHER_FIXTURE_NAME, DEFAULT_DATABASE_DIRECTORY),
      sqlcipherKey: SQLCIPHER_FIXTURE_KEY,
    },
  ]

  if (Platform.OS === 'ios') {
    fixtures.push(
      {
        databaseName: 'expo-default-fixture.db',
        description: 'Default database directory fixture',
        directory: DEFAULT_DATABASE_DIRECTORY,
        path: buildDatabasePath(
          'expo-default-fixture.db',
          DEFAULT_DATABASE_DIRECTORY,
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
  let db: DatabaseHandle | null = null

  try {
    const openedDb = await openFixtureDatabase(databaseName, DEFAULT_DATABASE_DIRECTORY)
    db = openedDb
    await ensureSchema(openedDb)
  }
  finally {
    await closeDatabase(db)
  }
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
    path: buildDatabasePath(databaseName, DEFAULT_DATABASE_DIRECTORY),
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
    fixture => fixture.databaseName !== SQLCIPHER_FIXTURE_NAME,
  ).filter(
    fixture => !fixture.removable,
  )

  for (const fixture of fixtures) {
    let db: DatabaseHandle | null = null

    try {
      const openedDb = await openFixtureDatabase(fixture.databaseName, fixture.directory)
      db = openedDb
      await seedFixtureDatabase(openedDb, fixture.description)
    }
    finally {
      await closeDatabase(db)
    }
  }
}

async function initSqlcipherFixture() {
  let db: DatabaseHandle | null = null

  try {
    const openedDb = await openFixtureDatabase(SQLCIPHER_FIXTURE_NAME, DEFAULT_DATABASE_DIRECTORY)
    db = openedDb
    const cipher = await openedDb.getFirstAsync<{ cipher_version?: string }>('PRAGMA cipher_version')

    if (!cipher?.cipher_version) {
      throw new Error('OP-SQLite was built without SQLCipher support')
    }

    await seedFixtureDatabase(openedDb, SQLCIPHER_FIXTURE_DESCRIPTION)
  }
  finally {
    await closeDatabase(db)
  }
}

// Initialize database schema and create a pre-filled database if needed
export async function initDatabase() {
  if (initDatabasePromise) {
    return initDatabasePromise
  }

  initDatabasePromise = (async () => {
    let db: DatabaseHandle | null = null

    try {
      const openedDb = await openFixtureDatabase(DATABASE_NAME)
      db = openedDb
      await seedIfEmpty(openedDb)
      await closeDatabase(openedDb)
      db = null

      await initIosFixtureDatabases()
      if (Platform.OS !== 'web') {
        await initSqlcipherFixture()
      }
    }
    catch (error) {
      console.error('Error initializing database:', error)
      throw error
    }
    finally {
      await closeDatabase(db)
      initDatabasePromise = null
    }
  })()

  return initDatabasePromise
}

// Get all items from the selected database
export async function getItems(
  databaseName: string = DATABASE_NAME,
  directory?: string,
): Promise<Item[]> {
  let db: DatabaseHandle | null = null

  try {
    const openedDb = await openFixtureDatabase(databaseName, directory)
    db = openedDb
    await ensureSchema(openedDb)
    const items = await openedDb.getAllAsync<Item>(`SELECT * FROM items ORDER BY created_at DESC`)

    // Parse JSON data for each item
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
    await closeDatabase(db)
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
    const openedDb = await openFixtureDatabase(databaseName, directory)
    db = openedDb
    await ensureSchema(openedDb)
    const jsonString = jsonData ? JSON.stringify(jsonData) : null

    const result = await openedDb.runAsync(
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
    const openedDb = await openFixtureDatabase(databaseName, directory)
    db = openedDb
    await ensureSchema(openedDb)
    await openedDb.runAsync(`DELETE FROM items WHERE id = ?`, [id])
  }
  catch (error) {
    console.error('Error deleting item from database:', error)
    throw error
  }
  finally {
    await db?.closeAsync()
  }
}
