const DEVICE = {
  id: 'emulator-5554',
  name: 'Pixel 8 API 35',
  deviceType: 'emulator',
  description: 'Android',
}

const APPLICATION = {
  bundleId: 'com.flippio.sample',
  name: 'Flippio Sample',
}

const DATABASE_FILE = {
  path: '/tmp/flippio/sample.db',
  filename: 'sample.db',
  packageName: 'com.flippio.sample',
  location: '/data/data/com.flippio.sample/databases',
  remotePath: '/data/data/com.flippio.sample/databases/sample.db',
  deviceType: 'android',
}

const TABLE_COLUMNS = [
  { name: 'id', type: 'INTEGER' },
  { name: 'name', type: 'TEXT' },
  { name: 'email', type: 'TEXT' },
]

const INITIAL_ROWS = [
  { id: 1, name: 'Alice', email: 'alice@flippio.dev' },
  { id: 2, name: 'Bob', email: 'bob@flippio.dev' },
]

const UPDATED_ROWS = [
  { id: 1, name: 'Alicia', email: 'alice@flippio.dev' },
  { id: 2, name: 'Bob', email: 'bob@flippio.dev' },
]

const ADDED_ROWS = [
  ...INITIAL_ROWS,
  { id: 3, name: 'Charlie', email: 'charlie@flippio.dev' },
]

const DELETED_ROWS = [
  { id: 2, name: 'Bob', email: 'bob@flippio.dev' },
]

const CLEARED_ROWS = []
const IPHONE_DEVICE_A = {
  id: 'iphone-1',
  name: 'QA iPhone A',
  model: 'iPhone 15 Pro',
  deviceType: 'iphone-device',
  description: 'iPhone Device',
}

const IPHONE_DEVICE_B = {
  id: 'iphone-2',
  name: 'QA iPhone B',
  model: 'iPhone 14',
  deviceType: 'iphone-device',
  description: 'iPhone Device',
}

const IOS_APP_A = {
  bundleId: 'com.test.first',
  name: 'First App',
}

const IOS_APP_B = {
  bundleId: 'com.test.second',
  name: 'Second App',
}

const IOS_DB_A = {
  path: '/tmp/ios/first.db',
  filename: 'first.db',
  packageName: 'com.test.first',
  location: '/var/mobile/Containers/Data/Application/First',
  remotePath: '/var/mobile/Containers/Data/Application/First/first.db',
  deviceType: 'iphone-device',
}

const IOS_DB_B = {
  path: '/tmp/ios/second.db',
  filename: 'second.db',
  packageName: 'com.test.second',
  location: '/var/mobile/Containers/Data/Application/Second',
  remotePath: '/var/mobile/Containers/Data/Application/Second/second.db',
  deviceType: 'iphone-device',
}

const DENSE_ROWS_100 = Array.from({ length: 100 }, (_, index) => ({
  id: index + 1,
  name: `User ${index + 1}`,
  email: `user${index + 1}@flippio.dev`,
}))

const DENSE_ROWS_110 = Array.from({ length: 110 }, (_, index) => ({
  id: index + 1,
  name: `User ${index + 1}`,
  email: `user${index + 1}@flippio.dev`,
}))
const DESKTOP_DB_FILE = {
  path: '/tmp/flippio/local.db',
  filename: 'local.db',
  packageName: '',
  location: '/tmp/flippio',
  remotePath: '/tmp/flippio/local.db',
  deviceType: 'desktop',
}

const CUSTOM_QUERY_ROWS = [
  { id: 99, name: 'Query User', email: 'query@flippio.dev' },
]

const SIMULATOR_DEVICE = {
  id: 'SIM-0001',
  name: 'iPhone 15 Simulator',
  model: 'iPhone 15 Simulator',
  state: 'Booted',
  platform: 'ios',
}

const SIMULATOR_APP = {
  bundleId: 'com.flippio.simulator',
  name: 'Simulator Sample',
}

const SIMULATOR_DB_FILE = {
  path: '/Users/test/Library/Developer/CoreSimulator/sample.db',
  filename: 'sample.db',
  packageName: 'com.flippio.simulator',
  location: '/Users/test/Library/Developer/CoreSimulator',
  remotePath: '/Users/test/Library/Developer/CoreSimulator/sample.db',
  deviceType: 'simulator',
}

function response(result) {
  return { result }
}

function successData(data) {
  return response({
    success: true,
    data,
  })
}

function failure(error) {
  return response({
    success: false,
    error,
  })
}

function tableDataResult(rows) {
  return successData({
    columns: TABLE_COLUMNS,
    rows,
  })
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function compactRecord(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => typeof value !== 'undefined'),
  )
}

function withQueue(defaultResponse, queue) {
  if (!queue?.length) {
    return {
      default: clone(defaultResponse),
    }
  }

  return {
    queue: queue.map(entry => clone(entry)),
    default: clone(defaultResponse),
  }
}

function createAndroidBaseCommands(overrides = {}) {
  return {
    adb_get_devices: {
      default: successData([DEVICE]),
    },
    device_get_ios_devices: {
      default: successData([]),
    },
    get_ios_simulators: {
      default: successData([]),
    },
    adb_get_packages: {
      default: successData([APPLICATION]),
    },
    adb_get_android_database_files: {
      default: successData([DATABASE_FILE]),
    },
    adb_push_database_file: {
      default: successData(true),
    },
    db_open: {
      default: successData(DATABASE_FILE.path),
    },
    db_switch_database: {
      default: successData(true),
    },
    db_get_tables: {
      default: successData([{ name: 'users' }]),
    },
    db_get_table_data: {
      default: tableDataResult(INITIAL_ROWS),
    },
    db_update_table_row: {
      default: successData(true),
    },
    db_add_new_row_with_defaults: {
      default: successData(true),
    },
    db_delete_table_row: {
      default: successData(true),
    },
    db_clear_table: {
      default: successData(true),
    },
    get_database_change_history: {
      default: successData([]),
    },
    ...clone(overrides),
  }
}

function createIOSBaseCommands(overrides = {}) {
  return {
    adb_get_devices: {
      default: successData([]),
    },
    device_get_ios_devices: {
      default: successData([IPHONE_DEVICE_A]),
    },
    get_ios_simulators: {
      default: successData([]),
    },
    device_get_ios_device_packages: {
      default: successData([IOS_APP_A]),
    },
    get_ios_device_database_files: {
      default: successData([IOS_DB_A]),
    },
    cancel_ios_device_database_scan: {
      default: successData(true),
    },
    device_push_ios_database_file: {
      default: successData(true),
    },
    db_open: {
      default: successData(IOS_DB_A.path),
    },
    db_switch_database: {
      default: successData(true),
    },
    db_get_tables: {
      default: successData([{ name: 'users' }]),
    },
    db_get_table_data: {
      default: tableDataResult(DENSE_ROWS_100),
    },
    db_add_new_row_with_defaults: {
      default: successData(true),
    },
    get_database_change_history: {
      default: successData([]),
    },
    ...clone(overrides),
  }
}

function createIOSScenario(name, overrides = {}) {
  return {
    name,
    strict: true,
    commands: compactRecord(createIOSBaseCommands(overrides)),
  }
}

function createAndroidScenario(name, overrides = {}) {
  return {
    name,
    strict: true,
    commands: compactRecord(createAndroidBaseCommands(overrides)),
  }
}

function createAndroidDeviceSelectionScenario() {
  return createAndroidScenario('android-device-selection', {
    adb_get_android_database_files: undefined,
    adb_push_database_file: undefined,
    db_open: undefined,
    db_switch_database: undefined,
    db_get_tables: undefined,
    db_get_table_data: undefined,
    db_update_table_row: undefined,
    db_add_new_row_with_defaults: undefined,
    db_delete_table_row: undefined,
    db_clear_table: undefined,
    get_database_change_history: undefined,
  })
}

function createAndroidGridHappyPathScenario() {
  return createAndroidScenario('android-grid-happy-path')
}

function createAndroidRowUpdateScenario() {
  return createAndroidScenario('android-row-update', {
    db_get_table_data: withQueue(
      tableDataResult(UPDATED_ROWS),
      [tableDataResult(INITIAL_ROWS)],
    ),
  })
}

function createAndroidAddRowScenario() {
  return createAndroidScenario('android-add-row', {
    db_get_table_data: withQueue(
      tableDataResult(ADDED_ROWS),
      [tableDataResult(INITIAL_ROWS)],
    ),
  })
}

function createAndroidDeleteRowScenario() {
  return createAndroidScenario('android-delete-row', {
    db_get_table_data: withQueue(
      tableDataResult(DELETED_ROWS),
      [
        tableDataResult(INITIAL_ROWS),
        tableDataResult(INITIAL_ROWS),
      ],
    ),
  })
}

function createAndroidClearTableScenario() {
  return createAndroidScenario('android-clear-table', {
    db_get_table_data: withQueue(
      tableDataResult(CLEARED_ROWS),
      [
        tableDataResult(INITIAL_ROWS),
        tableDataResult(INITIAL_ROWS),
      ],
    ),
  })
}

function createAndroidPackagesFailureScenario() {
  return createAndroidScenario('android-packages-failure', {
    adb_get_packages: {
      default: failure('Failed to load apps for test device'),
    },
  })
}

function createAndroidDatabaseFilesFailureScenario() {
  return createAndroidScenario('android-database-files-failure', {
    adb_get_android_database_files: {
      default: failure('Failed to fetch database files'),
    },
  })
}

function createAndroidTablesFailureScenario() {
  return createAndroidScenario('android-tables-failure', {
    db_get_tables: {
      default: failure('Failed to fetch tables'),
    },
  })
}

function createAndroidTableDataFailureScenario() {
  return createAndroidScenario('android-table-data-failure', {
    db_get_table_data: {
      default: failure('Failed to fetch table data'),
    },
  })
}

function createAndroidRowUpdateFailureScenario() {
  return createAndroidScenario('android-row-update-failure', {
    db_update_table_row: {
      default: failure('Failed to update row'),
    },
    db_get_table_data: withQueue(
      tableDataResult(INITIAL_ROWS),
      [tableDataResult(INITIAL_ROWS)],
    ),
  })
}

function createIOSDenseHappyPathScenario() {
  return createIOSScenario('ios-dense-happy-path')
}

function createIOSDeviceChangeResetScenario() {
  return createIOSScenario('ios-device-change-reset', {
    device_get_ios_devices: {
      default: successData([IPHONE_DEVICE_A, IPHONE_DEVICE_B]),
    },
    device_get_ios_device_packages: withQueue(
      successData([IOS_APP_B]),
      [successData([IOS_APP_A])],
    ),
    get_ios_device_database_files: withQueue(
      successData([IOS_DB_B]),
      [successData([IOS_DB_A])],
    ),
    db_open: withQueue(
      successData(IOS_DB_B.path),
      [successData(IOS_DB_A.path)],
    ),
  })
}

function createIOSAppChangeResetScenario() {
  return createIOSScenario('ios-app-change-reset', {
    device_get_ios_device_packages: {
      default: successData([IOS_APP_A, IOS_APP_B]),
    },
    get_ios_device_database_files: withQueue(
      successData([IOS_DB_B]),
      [successData([IOS_DB_A])],
    ),
    db_open: withQueue(
      successData(IOS_DB_B.path),
      [successData(IOS_DB_A.path)],
    ),
  })
}

function createIOSScanRaceScenario() {
  return createIOSScenario('ios-scan-race', {
    device_get_ios_device_packages: {
      default: successData([IOS_APP_A, IOS_APP_B]),
    },
    get_ios_device_database_files: {
      queue: [
        {
          delayMs: 200,
          result: {
            success: true,
            data: [IOS_DB_A],
          },
        },
        {
          delayMs: 50,
          result: {
            success: true,
            data: [IOS_DB_B],
          },
        },
      ],
      default: successData([IOS_DB_B]),
    },
  })
}

function createIOSBulkAddScenario() {
  return createIOSScenario('ios-bulk-add', {
    db_get_table_data: withQueue(
      tableDataResult(DENSE_ROWS_110),
      [tableDataResult(DENSE_ROWS_100)],
    ),
    db_add_new_row_with_defaults: {
      queue: Array.from({ length: 10 }, () => successData(true)),
      default: successData(true),
    },
    device_push_ios_database_file: {
      queue: Array.from({ length: 10 }, () => successData(true)),
      default: successData(true),
    },
  })
}

function createDesktopBaseCommands(overrides = {}) {
  return {
    adb_get_devices: {
      default: successData([]),
    },
    device_get_ios_devices: {
      default: successData([]),
    },
    get_ios_simulators: {
      default: successData([]),
    },
    dialog_select_file: {
      default: {
        result: {
          canceled: false,
          file_paths: [DESKTOP_DB_FILE.path],
        },
      },
    },
    dialog_save_file: {
      default: {
        result: '/tmp/flippio/exported-local.db',
      },
    },
    export_text_file: {
      default: {
        result: '/tmp/flippio/exported-users.csv',
      },
    },
    db_open: {
      default: successData(DESKTOP_DB_FILE.path),
    },
    db_switch_database: {
      default: successData(true),
    },
    db_get_tables: {
      default: successData([{ name: 'users' }]),
    },
    db_get_table_data: {
      default: tableDataResult(INITIAL_ROWS),
    },
    db_execute_query: {
      default: successData({
        columns: TABLE_COLUMNS,
        rows: CUSTOM_QUERY_ROWS,
      }),
    },
    get_database_change_history: {
      default: successData([]),
    },
    clear_all_change_history: {
      default: successData(true),
    },
    ...clone(overrides),
  }
}

function createDesktopScenario(name, overrides = {}) {
  return {
    name,
    strict: true,
    commands: compactRecord(createDesktopBaseCommands(overrides)),
  }
}

function createDesktopOpenScenario() {
  return createDesktopScenario('desktop-open')
}

function createDesktopCustomQueryScenario() {
  return createDesktopScenario('desktop-custom-query')
}

function createDesktopExportScenario() {
  return createDesktopScenario('desktop-export')
}

function createDesktopDragDropScenario() {
  return createDesktopScenario('desktop-drag-drop', {
    dialog_select_file: undefined,
  })
}

function createSimulatorHappyPathScenario() {
  return {
    name: 'simulator-happy-path',
    strict: true,
    commands: compactRecord({
      adb_get_devices: {
        default: successData([]),
      },
      device_get_ios_devices: {
        default: successData([]),
      },
      get_ios_simulators: {
        default: successData([SIMULATOR_DEVICE]),
      },
      device_get_ios_packages: {
        default: successData([SIMULATOR_APP]),
      },
      get_ios_simulator_database_files: {
        default: successData([SIMULATOR_DB_FILE]),
      },
      db_open: {
        default: successData(SIMULATOR_DB_FILE.path),
      },
      db_switch_database: {
        default: successData(true),
      },
      db_get_tables: {
        default: successData([{ name: 'users' }]),
      },
      db_get_table_data: {
        default: tableDataResult(INITIAL_ROWS),
      },
      get_database_change_history: {
        default: successData([]),
      },
    }),
  }
}

function createAndroidRefreshPreserveScenario() {
  return createAndroidScenario('android-refresh-preserve', {
    adb_get_android_database_files: withQueue(
      successData([DATABASE_FILE]),
      [successData([DATABASE_FILE])],
    ),
    db_get_tables: withQueue(
      successData([{ name: 'users' }]),
      [successData([{ name: 'users' }])],
    ),
    db_get_table_data: withQueue(
      tableDataResult(INITIAL_ROWS),
      [tableDataResult(INITIAL_ROWS)],
    ),
  })
}

function createAndroidChangeHistoryScenario() {
  const updateChange = {
    id: 'change-1',
    timestamp: '2026-07-19T08:00:00.000Z',
    contextKey: 'android-context',
    databasePath: DATABASE_FILE.path,
    databaseFilename: DATABASE_FILE.filename,
    tableName: 'users',
    operationType: 'Update',
    userContext: {
      deviceId: DEVICE.id,
      deviceName: DEVICE.name,
      deviceType: DEVICE.deviceType,
      appPackage: APPLICATION.bundleId,
      appName: APPLICATION.name,
      sessionId: 'session-1',
    },
    changes: [
      {
        fieldName: 'name',
        oldValue: 'Alice',
        newValue: 'Alicia',
        dataType: 'TEXT',
      },
    ],
    metadata: {
      affectedRows: 1,
      executionTimeMs: 10,
      pullTimestamp: '2026-07-19T08:00:00.000Z',
    },
  }

  return createAndroidScenario('android-change-history', {
    db_get_table_data: withQueue(
      tableDataResult(UPDATED_ROWS),
      [tableDataResult(INITIAL_ROWS)],
    ),
    get_database_change_history: {
      queue: [
        successData([]),
        successData([]),
      ],
      default: successData([updateChange]),
    },
  })
}

function createIOSDeleteRowScenario() {
  return createIOSScenario('ios-delete-row', {
    db_get_table_data: withQueue(
      tableDataResult(DELETED_ROWS),
      [
        tableDataResult(INITIAL_ROWS),
        tableDataResult(INITIAL_ROWS),
      ],
    ),
    db_delete_table_row: {
      default: successData(true),
    },
  })
}

function createIOSClearTableScenario() {
  return createIOSScenario('ios-clear-table', {
    db_get_table_data: withQueue(
      tableDataResult(CLEARED_ROWS),
      [
        tableDataResult(INITIAL_ROWS),
        tableDataResult(INITIAL_ROWS),
      ],
    ),
    db_clear_table: {
      default: successData(true),
    },
  })
}

module.exports = {
  APPLICATION,
  DATABASE_FILE,
  DESKTOP_DB_FILE,
  DEVICE,
  INITIAL_ROWS,
  IOS_APP_A,
  IOS_APP_B,
  IOS_DB_A,
  IOS_DB_B,
  IPHONE_DEVICE_A,
  IPHONE_DEVICE_B,
  SIMULATOR_DB_FILE,
  SIMULATOR_DEVICE,
  createAndroidAddRowScenario,
  createAndroidChangeHistoryScenario,
  createAndroidClearTableScenario,
  createAndroidDatabaseFilesFailureScenario,
  createAndroidDeleteRowScenario,
  createAndroidDeviceSelectionScenario,
  createAndroidGridHappyPathScenario,
  createAndroidPackagesFailureScenario,
  createAndroidRefreshPreserveScenario,
  createAndroidRowUpdateFailureScenario,
  createAndroidRowUpdateScenario,
  createAndroidTableDataFailureScenario,
  createAndroidTablesFailureScenario,
  createDesktopCustomQueryScenario,
  createDesktopDragDropScenario,
  createDesktopExportScenario,
  createDesktopOpenScenario,
  createIOSAppChangeResetScenario,
  createIOSBulkAddScenario,
  createIOSClearTableScenario,
  createIOSDeleteRowScenario,
  createIOSDenseHappyPathScenario,
  createIOSDeviceChangeResetScenario,
  createIOSScanRaceScenario,
  createSimulatorHappyPathScenario,
}
