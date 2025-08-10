/**
 * Base API Client Service
 * 
 * Provides a consistent wrapper around the Tauri API with:
 * - Standardized error handling
 * - Request/response transformation
 * - Retry logic
 * - Type safety
 */

import type { ServiceResponse, TauriResponse } from '../types/api'

/**
 * API client configuration options
 */
export interface ApiClientConfig {
  /** Maximum number of retry attempts */
  maxRetries?: number
  /** Retry delay in milliseconds */
  retryDelay?: number
  /** Request timeout in milliseconds */
  timeout?: number
}

/**
 * Default configuration for API client
 */
const DEFAULT_CONFIG: Required<ApiClientConfig> = {
  maxRetries: 2,
  retryDelay: 1000,
  timeout: 30000,
}

/**
 * Base API client class providing common functionality
 */
export class ApiClient {
  private config: Required<ApiClientConfig>

  constructor(config: ApiClientConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Executes a Tauri command with retry logic and error handling
   * 
   * @param command - The Tauri command to execute
   * @param params - Parameters to pass to the command
   * @returns Standardized service response
   */
  async execute<T>(
    command: string,
    params?: Record<string, unknown>,
  ): Promise<ServiceResponse<T>> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Request timeout after ${this.config.timeout}ms`))
          }, this.config.timeout)
        })

        // Execute the command with timeout
        const commandPromise = this.executeCommand<T>(command, params)
        const response = await Promise.race([commandPromise, timeoutPromise])

        return this.transformResponse<T>(response)
      }
      catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        // Don't retry on the last attempt
        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelay * (attempt + 1))
          continue
        }
      }
    }

    return {
      success: false,
      data: null,
      error: lastError?.message || 'Unknown error occurred',
    }
  }

  /**
   * Executes the actual Tauri command
   */
  private async executeCommand<T>(
    command: string,
    params?: Record<string, unknown>,
  ): Promise<TauriResponse<T>> {
    if (!window.api) {
      throw new Error('Tauri API not available')
    }

    // Get the command function from the API
    const commandFunc = (window.api as any)[command]
    if (typeof commandFunc !== 'function') {
      throw new TypeError(`Command '${command}' not found in Tauri API`)
    }

    // Execute the command
    if (params) {
      return await commandFunc(params) as TauriResponse<T>
    }
    else {
      return await commandFunc() as TauriResponse<T>
    }
  }

  /**
   * Transforms Tauri response to standardized service response
   */
  private transformResponse<T>(response: TauriResponse<T>): ServiceResponse<T> {
    if (response.success) {
      return {
        success: true,
        data: response.data || null,
        error: null,
      }
    }
    else {
      return {
        success: false,
        data: null,
        error: response.error || 'Unknown error occurred',
      }
    }
  }

  /**
   * Delays execution for the specified number of milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Updates the client configuration
   */
  updateConfig(config: Partial<ApiClientConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Gets the current configuration
   */
  getConfig(): Required<ApiClientConfig> {
    return { ...this.config }
  }
}

/**
 * Default API client instance
 */
export const apiClient = new ApiClient()

/**
 * Helper function to create a new API client with custom configuration
 */
export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config)
}
