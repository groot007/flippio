/**
 * Shared API Response Types
 * 
 * Common response types used across the application
 */

/**
 * Standard service response wrapper for consistent error handling
 */
export interface ServiceResponse<T> {
  /** Whether the operation was successful */
  success: boolean
  /** Response data (null if operation failed) */
  data: T | null
  /** Error message (null if operation succeeded) */
  error: string | null
}

/**
 * Tauri API response structure
 */
export interface TauriResponse<T> {
  /** Whether the operation was successful */
  success: boolean
  /** Response data */
  data?: T
  /** Error message if operation failed */
  error?: string
}

/**
 * Base error interface for consistent error handling
 */
export interface AppError {
  /** Error message */
  message: string
  /** Error code for programmatic handling */
  code?: string
  /** Additional error context */
  context?: Record<string, unknown>
  /** Timestamp when error occurred */
  timestamp?: Date
}

/**
 * Loading state interface for UI components
 */
export interface LoadingState {
  /** Whether the operation is currently loading */
  isLoading: boolean
  /** Error that occurred during loading */
  error: AppError | null
  /** Whether the operation completed successfully */
  isSuccess: boolean
}

/**
 * Pagination interface for data lists
 */
export interface Pagination {
  /** Current page number (0-based) */
  page: number
  /** Number of items per page */
  limit: number
  /** Total number of items */
  total: number
  /** Whether there are more pages */
  hasNextPage: boolean
  /** Whether there are previous pages */
  hasPreviousPage: boolean
}

/**
 * Search/filter interface for data queries
 */
export interface SearchQuery {
  /** Search term */
  query?: string
  /** Field to search in */
  field?: string
  /** Sort field */
  sortBy?: string
  /** Sort order */
  sortOrder?: 'asc' | 'desc'
  /** Additional filters */
  filters?: Record<string, unknown>
}

/**
 * File information interface
 */
export interface FileInfo {
  /** File name */
  name: string
  /** File path */
  path: string
  /** File size in bytes */
  size: number
  /** File extension */
  extension: string
  /** MIME type */
  mimeType?: string
  /** Last modified date */
  lastModified?: Date
}

/**
 * Toast notification interface
 */
export interface ToastNotification {
  /** Notification message */
  message: string
  /** Notification type */
  type: 'success' | 'error' | 'warning' | 'info'
  /** Duration to show the toast (ms) */
  duration?: number
  /** Whether the toast can be dismissed */
  dismissible?: boolean
}

/**
 * Theme configuration interface
 */
export interface ThemeConfig {
  /** Theme mode */
  mode: 'light' | 'dark' | 'system'
  /** Primary color */
  primaryColor?: string
  /** Font size preference */
  fontSize?: 'small' | 'medium' | 'large'
  /** High contrast mode */
  highContrast?: boolean
}
