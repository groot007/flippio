export interface OpenFileResult {
  canceled: boolean
  filePaths: string[]
}

export interface ExportFileOptions {
  dbFilePath: string
  defaultPath: string
  filters: Array<{
    extensions: string[]
    name: string
  }>
}

export interface DatabaseApi {
  exportFile: (options: ExportFileOptions) => Promise<string | null>
  getTables: (dbPath?: string) => Promise<any>
  getTableInfo: (tableName: string, dbPath?: string) => Promise<any>
  openDatabase: (filePath: string) => Promise<any>
  openFile: () => Promise<OpenFileResult>
  switchDatabase: (filePath: string) => Promise<any>
}

interface DatabaseApiDependencies {
  invokeCommandWithResponse: (electronCommand: string, dataFieldName: string, ...args: any[]) => Promise<{ success: boolean, [key: string]: any }>
  invokeRaw: <T>(command: string, args?: Record<string, unknown>) => Promise<T>
  validateDeviceResponse: <T>(response: any) => { success: boolean, data?: T, error?: string }
  validateInput: (value: any, fieldName: string, options?: {
    maxLength?: number
    pattern?: RegExp
    required?: boolean
    type?: 'string' | 'number' | 'boolean' | 'object'
  }) => void
}

export function createDatabaseApi({
  invokeCommandWithResponse,
  invokeRaw,
  validateDeviceResponse,
  validateInput,
}: DatabaseApiDependencies): DatabaseApi {
  return {
    getTables: async (dbPath?: string) => {
      if (dbPath) {
        validateInput(dbPath, 'dbPath', { type: 'string', maxLength: 500 })
      }

      try {
        const response = await invokeRaw<any>('db_get_tables', {
          currentDbPath: dbPath,
        })

        const validatedResponse = validateDeviceResponse(response)

        if (validatedResponse.success && validatedResponse.data) {
          return {
            success: true,
            tables: validatedResponse.data,
          }
        }

        return { success: false, error: validatedResponse.error || 'Failed to get tables' }
      }
      catch (error) {
        return { success: false, error: (error as Error).message }
      }
    },

    openDatabase: async (filePath: string) => {
      validateInput(filePath, 'filePath', { required: true, type: 'string', maxLength: 500 })

      if (!filePath.match(/\.(db|sqlite|sqlite3)$/i)) {
        throw new Error('Invalid database file extension. Expected .db, .sqlite, or .sqlite3')
      }

      try {
        const response = await invokeRaw<any>('db_open', { filePath })
        const validatedResponse = validateDeviceResponse(response)

        return {
          success: validatedResponse.success,
          path: validatedResponse.data,
          error: validatedResponse.error,
        }
      }
      catch (error) {
        return { success: false, error: (error as Error).message }
      }
    },

    getTableInfo: async (tableName: string, dbPath?: string) => {
      validateInput(tableName, 'tableName', { required: true, type: 'string', maxLength: 100 })
      if (dbPath) {
        validateInput(dbPath, 'dbPath', { type: 'string', maxLength: 500 })
      }

      if (!/^[a-z_]\w*$/i.test(tableName)) {
        throw new Error('Invalid table name. Must start with letter or underscore and contain only alphanumeric characters and underscores')
      }

      try {
        const response = await invokeRaw<any>('db_get_table_data', {
          tableName,
          currentDbPath: dbPath,
        })

        const validatedResponse = validateDeviceResponse<{ columns: any[], rows: any[] }>(response)

        if (validatedResponse.success && validatedResponse.data) {
          return {
            success: true,
            columns: validatedResponse.data.columns,
            rows: validatedResponse.data.rows,
          }
        }

        return { success: false, error: validatedResponse.error || 'Failed to get table info' }
      }
      catch (error) {
        return { success: false, error: (error as Error).message }
      }
    },

    switchDatabase: (filePath: string) =>
      invokeCommandWithResponse('db:switchDatabase', 'result', filePath),

    openFile: async () => {
      try {
        const response = await invokeRaw<{ canceled?: boolean, file_path?: string, file_paths?: string[] }>('dialog_select_file')

        return {
          canceled: response?.canceled || false,
          filePaths: response?.file_paths || (response?.file_path ? [response.file_path] : []),
        }
      }
      catch (error) {
        console.error('Error opening file:', error)
        return { canceled: true, filePaths: [] }
      }
    },

    exportFile: async (options: ExportFileOptions) => {
      validateInput(options.dbFilePath, 'dbFilePath', { type: 'string', maxLength: 500 })
      validateInput(options.defaultPath, 'defaultPath', { type: 'string', maxLength: 500 })

      for (const filter of options.filters || []) {
        validateInput(filter.name, 'filter.name', { type: 'string', maxLength: 100 })
      }

      try {
        const transformedOptions = {
          db_file_path: options.dbFilePath,
          default_path: options.defaultPath,
          filters: options.filters.map(filter => ({
            name: filter.name,
            extensions: filter.extensions,
          })),
        }

        return await invokeRaw<string | null>('dialog_save_file', { options: transformedOptions })
      }
      catch (error) {
        console.error('Error saving file:', error)
        return null
      }
    },
  }
}
