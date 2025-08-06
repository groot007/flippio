# Flippio AI Coding Instructions

## Architecture Overview

**Flippio** is a Tauri 2.0 desktop application for inspecting mobile device databases (iOS/Android). It combines:
- **Backend**: Rust with SQLx, external binaries (`idevice*` tools, `adb`), and extensive async command handling
- **Frontend**: React + TypeScript with Chakra UI, Zustand stores, and React Query for state management
- **Bridge**: Custom `tauri-api.ts` that maps Electron-style APIs to Tauri's `invoke()` system

## Critical Development Workflows

### Build & Development
```bash
# Development with hot reload (both frontend and backend)
npm run tauri:dev

# Frontend-only development (requires mock API)
npm run dev:renderer

# Production builds with signing
npm run tauri:build:signed  # Uses env vars from .env
```

### Testing Strategy
- **Frontend**: Vitest with jsdom, extensive mocking in `test-utils/`
- **Backend**: Cargo test with fixtures in `src-tauri/tests/fixtures/databases/`
- **Integration**: Use `Makefile` commands for comprehensive testing workflow
```bash
make test-all          # Full test suite
make quick-test-platforms  # Fast platform-specific tests
make coverage-html     # Generate coverage with llvm-cov
```

### External Dependencies Management
**Critical**: Flippio bundles iOS tools (`idevice*`) and Android SDK tools. CI fails without them.
- Use `tauri-ci.conf.json` for CI builds (no external binaries)
- macOS deps in `src-tauri/macos-deps/` with universal binaries
- CI uses simplified config to avoid cross-platform binary issues

## Project-Specific Patterns

### State Management Architecture
```typescript
// Zustand stores with specific responsibilities
appStore.ts              // Global app state and selections
useCurrentDeviceSelection.ts   // Device picker logic
useCurrentDatabaseSelection.ts // Database file management
useTableData.ts          // AG Grid data management
useRowEditingStore.ts    // Side panel editing state
```

### Tauri Command Integration
**Pattern**: All Rust commands return `DeviceResponse<T>` with consistent error handling:
```rust
pub struct DeviceResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}
```

**Frontend mapping** in `tauri-api.ts` converts snake_case Rust commands to camelCase frontend APIs:
```typescript
// Maps 'adb:getDevices' -> 'adb_get_devices'
const COMMAND_MAP = { /* ... */ }
```

### Database Connection Patterns
- **Rust**: Uses `DbConnectionCache` with connection pooling via SQLx
- **Frontend**: Always passes `currentDbPath` parameter for multi-database support
- **Testing**: Generate fixtures with `scripts/generate-test-databases.js`

### Device Detection Logic
Flippio supports multiple device types with platform-specific detection:
```typescript
// Device type detection in tauri-api.ts
if (deviceId.match(/^[A-F0-9-]{36,40}$/i)) deviceType = 'iphone-device'
else if (deviceId.match(/^[A-F0-9-]{8,}$/i)) deviceType = 'simulator'
else deviceType = 'android'
```

### Error Handling Conventions
- **Backend**: Use `DeviceResponse<T>` wrapper for all commands
- **Frontend**: Toast notifications via Chakra UI's `useToast`
- **Logging**: Tauri plugin + Sentry integration for production error tracking

## Component Testing Patterns

### Provider Wrapping
All tests use custom render function with providers:
```typescript
// From test-utils/render.tsx
<QueryClientProvider client={testQueryClient}>
  <Provider>  {/* Chakra UI */}
    {component}
  </Provider>
</QueryClientProvider>
```

### Store Mocking
Reset stores before each test:
```typescript
beforeEach(() => {
  useAppStore.getState().setDevices([])
  // Reset other store state...
})
```

### AG Grid Testing
Mock AG Grid components entirely due to complex DOM requirements:
```typescript
vi.mock('ag-grid-react', () => ({ AgGridReact: MockAgGridReact }))
```

## Integration Points & Cross-Component Communication

### Device → App → Database Flow
1. `useDevices` hook fetches all devices (Android + iOS + simulators)
2. Device selection triggers `useApplications` query
3. App selection triggers `useDatabaseFiles` query
4. Database selection opens connection pool and enables table browsing

### File Upload/Export Flow
- **Import**: Uses `webUtils.getPathForFile()` → `save_dropped_file` command
- **Export**: Uses `dialog_save_file` command with platform-specific file filters
- **Push to device**: Platform-specific commands (ADB vs libimobiledevice)

### Auto-Updater Integration
- Production builds include updater artifacts (`createUpdaterArtifacts: true`)
- Uses GitHub releases with signed updates (`pubkey` in `tauri.conf.json`)
- Frontend checks for updates via `checkForUpdates()` command

## Development Environment Setup

### Required Tools
- **macOS**: Xcode command line tools, iOS Simulator
- **Android**: Android SDK, `adb` in PATH
- **Rust**: Latest stable with `llvm-cov` for coverage
- **Node**: v20+ with Yarn package manager

### Environment Variables (.env)
```bash
APPLE_SIGNING_IDENTITY="Developer ID Application: ..."
VITE_SENTRY_DSN="https://..."
VITE_POSTHOG_API_KEY="phc_..."
```

### Pre-commit Automation
Git hooks in `.git/hooks/pre-push` run full test suite (currently disabled but configured).

## Device-Specific Database Extraction Workflows

### Android Database Extraction (ADB)
**Multi-location Priority Search**: Android searches multiple data directories in priority order:
```rust
// Priority locations: secured → public → fallback
let locations = vec![
    ("/data/data/", true),           // Secured app data (requires run-as)
    ("/sdcard/Android/data/", false), // Public storage
    ("/storage/emulated/0/Android/data/", false), // Legacy public storage
];
```

**Two-stage Access Pattern**:
1. **Admin Access** (preferred): Uses `adb shell run-as <package> find` + `exec-out run-as <package> cat`
2. **Standard Access** (fallback): Uses `adb pull` for publicly accessible files

**Critical Implementation**: Uses shell redirection for admin access to bypass permission issues:
```bash
adb -s device exec-out run-as package cat /path/file.db > local_file.db
```

### iOS Physical Device Extraction (libimobiledevice)
**Single-location Documents Access**: iOS apps store databases in sandboxed Documents directory:
```rust
// Uses afcclient (Apple File Conduit client) for file access
let cmd_args = ["--documents", package_name, "-u", device_id, "ls", "Documents"];
// Pull: afcclient --documents package -u device pull /Documents/file.db local_file.db
```

**Workflow Pattern**:
1. **Discovery**: `afcclient --documents <app> -u <device> ls Documents`
2. **Extraction**: `afcclient --documents <app> -u <device> pull /Documents/<file> <local_path>`
3. **Verification**: Check SQLite header and file size after pull

**Tool Dependencies**: Requires bundled `idevice_id`, `ideviceinfo`, `afcclient` binaries with codesigning.

### iOS Simulator Extraction (xcrun simctl)
**Direct Filesystem Access**: Simulators store app data in accessible host filesystem:
```bash
# Get app container path
xcrun simctl get_app_container <simulator_id> <bundle_id> data
# Direct file operations on host filesystem
find <container_path>/Documents -name "*.db" -o -name "*.sqlite*"
```

**Key Differences from Device**:
- No security sandbox restrictions
- Direct file system copy operations
- Uses host OS file permissions
- Supports in-place editing without pull/push cycle

### Database Push Workflows

**Android Push** (Two-step process):
1. `adb push <local_file> /sdcard/<temp_file>` (stage to public location)
2. `adb shell run-as <package> cp /sdcard/<temp_file> <app_data_path>` (move to secured location)

**iOS Device Push**:
```bash
afcclient --documents <package> -u <device> push <local_file> /Documents/<remote_file>
```

**iOS Simulator Push**:
Direct filesystem copy (same as standard file operations).

### Error Handling Patterns

**Connection Pool Management**: Always close database connections before file operations:
```rust
// Critical: Close DB connections to prevent file locks during push/pull
let mut pool_guard = db_pool_state.write().await;
if let Some(pool) = pool_guard.take() {
    pool.close().await;  // Prevent SQLite BUSY errors
}
```

**Device Type Detection Logic**:
```typescript
// Automatic device type detection for appropriate extraction method
if (deviceId.match(/^[A-F0-9-]{36,40}$/i)) deviceType = 'iphone-device'  // Physical iPhone
else if (deviceId.match(/^[A-F0-9-]{8,}$/i)) deviceType = 'simulator'    // iOS Simulator  
else deviceType = 'android'  // Android device/emulator
```
