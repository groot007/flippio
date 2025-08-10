/**
 * @deprecated This store index is deprecated. Please import stores from their new locations:
 * 
 * Device stores: from '@renderer/features/devices/stores'
 * Database stores: from '@renderer/features/database/stores'
 * Global stores: from '@renderer/shared/stores'
 * 
 * This index is maintained for backward compatibility and will be removed in a future version.
 */

// Legacy re-exports for backward compatibility
// TODO: Remove these re-exports and update all imports to use new paths
export { useCurrentDatabaseSelection, useDatabaseManagement, useRowEditingStore, useTableData } from '../features/database/stores'
export type { DatabaseManagement } from '../features/database/stores'
export { useCurrentDeviceSelection, useDeviceManagement, useRecentlyUsedApps } from '../features/devices/stores'
export type { DeviceManagement } from '../features/devices/stores'
export { useThemeStore } from '../shared/stores'
export type { ThemeInfo, ThemeMode } from '../shared/stores'
