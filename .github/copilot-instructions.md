# Flippio AI Coding Instructions

## Architecture Overview

**Flippio** = Tauri 2 desktop app for iOS/Android DB inspect.
- **Backend**: Rust, SQLx, `idevice*`, `adb`, async commands
- **Frontend**: React + TypeScript, Chakra UI, Zustand, React Query
- **Bridge**: `tauri-api.ts` map Electron-like API to Tauri `invoke()`

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
- Frontend: Vitest + jsdom + mocks in `test-utils/`
- Backend: Cargo test + fixtures in `src-tauri/tests/fixtures/databases/`
- Integration: use `Makefile`
```bash
make test-all          # Full test suite
make quick-test-platforms  # Fast platform-specific tests
make coverage-html     # Generate coverage with llvm-cov
```

### External Dependencies Management
- Flippio bundle iOS `idevice*` tools + Android SDK tools. CI break without them.
- CI builds use `tauri-ci.conf.json`
- macOS universal deps live in `src-tauri/macos-deps/`
- CI config simplified to avoid cross-platform binary issues

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
Rust commands return `DeviceResponse<T>`:
```rust
pub struct DeviceResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}
```

Frontend `tauri-api.ts` map snake_case Rust commands to camelCase APIs:
```typescript
// Maps 'adb:getDevices' -> 'adb_get_devices'
const COMMAND_MAP = { /* ... */ }
```

### Database Connection Patterns
- Rust use `DbConnectionCache` + SQLx pooling
- Frontend always pass `currentDbPath` for multi-DB support
- Test fixtures from `scripts/generate-test-databases.js`

### Device Detection Logic
```typescript
// Device type detection in tauri-api.ts
if (deviceId.match(/^[A-F0-9-]{36,40}$/i)) deviceType = 'iphone-device'
else if (deviceId.match(/^[A-F0-9-]{8,}$/i)) deviceType = 'simulator'
else deviceType = 'android'
```

### Error Handling Conventions
- Backend: `DeviceResponse<T>`
- Frontend: toast notifications
- Logging: Tauri plugin + Sentry in prod

## Component Testing Patterns

### Provider Wrapping
```typescript
// From test-utils/render.tsx
<QueryClientProvider client={testQueryClient}>
  <Provider>  {/* Chakra UI */}
    {component}
</QueryClientProvider>
```

### Store Mocking
```typescript
beforeEach(() => {
  useAppStore.getState().setDevices([])
  // Reset other store state...
})
```

### AG Grid Testing
```typescript
vi.mock('ag-grid-react', () => ({ AgGridReact: MockAgGridReact }))
```

## Integration Points & Cross-Component Communication

### Device → App → Database Flow
1. `useDevices` fetch all devices
2. Device select triggers `useApplications`
3. App select triggers `useDatabaseFiles`
4. DB select opens pool, enables table browse

### File Upload/Export Flow
- Import: `webUtils.getPathForFile()` -> `save_dropped_file`
- Export: `dialog_save_file` with platform filters
- Push: platform-specific commands, ADB vs libimobiledevice

### Auto-Updater Integration
- Prod builds include updater artifacts: `createUpdaterArtifacts: true`
- GitHub releases + signed updates, `pubkey` in `tauri.conf.json`
- Frontend call `checkForUpdates()`

## Development Environment Setup

### Required Tools
- macOS: Xcode command line tools, iOS Simulator
- Android: Android SDK, `adb` in PATH
- Rust: latest stable + `llvm-cov`
- Node: v20+ + Yarn

### Environment Variables (.env)
```bash
APPLE_SIGNING_IDENTITY="Developer ID Application: ..."
VITE_SENTRY_DSN="https://..."
VITE_POSTHOG_API_KEY="phc_..."
```

### Pre-commit Automation
- `.git/hooks/pre-push` wired for full test suite, now disabled

## Device-Specific Database Extraction Workflows

### Android Database Extraction (ADB)
Priority search:
```rust
// Priority locations: secured → public → fallback
let locations = vec![
    ("/data/data/", true),           // Secured app data (requires run-as)
    ("/sdcard/Android/data/", false), // Public storage
    ("/storage/emulated/0/Android/data/", false), // Legacy public storage
];
```

Access pattern:
1. Preferred: `adb shell run-as <package> find` + `exec-out run-as <package> cat`
2. Fallback: `adb pull`

Admin extraction:
```bash
adb -s device exec-out run-as package cat /path/file.db > local_file.db
```

### iOS Physical Device Extraction (libimobiledevice)
Documents access:
```rust
// Uses afcclient (Apple File Conduit client) for file access
let cmd_args = ["--documents", package_name, "-u", device_id, "ls", "Documents"];
// Pull: afcclient --documents package -u device pull /Documents/file.db local_file.db
```

Flow:
1. `afcclient --documents <app> -u <device> ls Documents`
2. `afcclient --documents <app> -u <device> pull /Documents/<file> <local_path>`
3. Verify SQLite header + file size

Need bundled `idevice_id`, `ideviceinfo`, `afcclient`, codesigned.

### iOS Simulator Extraction (xcrun simctl)
```bash
# Get app container path
xcrun simctl get_app_container <simulator_id> <bundle_id> data
# Direct file operations on host filesystem
find <container_path>/Documents -name "*.db" -o -name "*.sqlite*"
```

Simulator differences:
- no sandbox restriction
- direct FS copy
- host OS permissions
- in-place edit possible, no pull/push cycle

### Database Push Workflows

Android push:
1. `adb push <local_file> /sdcard/<temp_file>`
2. `adb shell run-as <package> cp /sdcard/<temp_file> <app_data_path>`

iOS device push:
```bash
afcclient --documents <package> -u <device> push <local_file> /Documents/<remote_file>
```

iOS simulator push: direct filesystem copy.

### Error Handling Patterns

Close DB connections before file ops:
```rust
// Critical: Close DB connections to prevent file locks during push/pull
let mut pool_guard = db_pool_state.write().await;
if let Some(pool) = pool_guard.take() {
    pool.close().await;  // Prevent SQLite BUSY errors
}
```

Device type detection:
```typescript
// Automatic device type detection for appropriate extraction method
if (deviceId.match(/^[A-F0-9-]{36,40}$/i)) deviceType = 'iphone-device'  // Physical iPhone
else if (deviceId.match(/^[A-F0-9-]{8,}$/i)) deviceType = 'simulator'    // iOS Simulator  
else deviceType = 'android'  // Android device/emulator
```

## Communication Style

- Use Caveman plugin style for normal chat to save tokens
- Talk terse, direct, technical
- Drop filler, hedging, pleasantries
- Keep code, paths, commands, errors exact
- If safety or destructive action warning needed, switch to clear normal wording first

## Copilot Code Editing Instructions

- DONT ADD COMMENTS
- Only JSDoc comments allowed
- JSDoc only at component level
