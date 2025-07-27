# Flippio - Mobile Database Viewer & Editor
## Comprehensive Project Overview

**Version:** 0.3.16  
**Author:** Mykola Stanislavchuk (koliastanis)  
**Repository:** https://github.com/groot007/flippio  
**License:** Private

---

## 📋 Table of Contents

1. [Project Description](#project-description)
2. [Application Workflow](#application-workflow)
3. [Technology Stack](#technology-stack)
4. [Architecture Overview](#architecture-overview)
5. [Frontend Architecture](#frontend-architecture)
6. [Backend Architecture](#backend-architecture)
7. [Device Integration](#device-integration)
8. [Database Management](#database-management)
9. [Key Features](#key-features)
10. [Project Structure](#project-structure)
11. [Development Setup](#development-setup)
12. [Build & Distribution](#build--distribution)
13. [Testing Strategy](#testing-strategy)
14. [Performance Considerations](#performance-considerations)
15. [Security Features](#security-features)
16. [Deployment](#deployment)

---

## 🎯 Project Description

Flippio is a cross-platform desktop application that enables developers and QA engineers to view, edit, and manage SQLite databases located on mobile devices (iOS and Android) and emulators/simulators. The application provides a comprehensive database management interface that bridges the gap between mobile app development and database inspection.

### Core Purpose
- **Database Inspection**: View and analyze SQLite databases from mobile applications
- **Real-time Editing**: Modify database records directly on connected devices
- **Cross-Platform**: Support for both iOS and Android devices/emulators
- **Developer Tools**: Custom SQL queries, table management, and data manipulation

---

## 🔄 Application Workflow

### 1. Device Selection
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Physical      │    │    Emulators/    │    │   Virtual       │
│   Devices       │────│   Simulators     │────│   Devices       │
│ (iOS/Android)   │    │   Management     │    │   Launch        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

- **iOS Physical Devices**: Detected via `libimobiledevice` tools (`idevice_id`, `ideviceinfo`)
- **Android Physical Devices**: Detected via ADB (`adb devices`)
- **iOS Simulators**: Listed via Xcode's `xcrun simctl`
- **Android Emulators**: Listed via Android SDK emulator tools

### 2. Package Discovery
```
Device Selected → Package Detection → App Filtering → Package Selection
```

- **iOS**: Uses `ideviceinstaller` (XML mode) or `xcrun simctl listapps`
- **Android**: Uses `adb shell pm list packages`
- **Package Information**: Bundle ID, app name, version, installation path

### 3. Database File Discovery
```
Package Selected → File System Scan → Database Detection → Local Copy
```

**iOS Database Locations:**
- Physical devices: `Documents/` folder via `afcclient`
- Simulators: Direct file system access via simulator paths

**Android Database Locations:**
- `/data/data/[package]/databases/` (primary, requires root/debug)
- `/sdcard/Android/data/[package]/` (external storage)
- `/storage/emulated/0/Android/data/[package]/` (alternative external)

### 4. Database Operations
```
Local Copy → SQLx Connection → Table Analysis → Data Grid Display
```

### 5. Data Modification & Sync
```
Edit Operation → Local DB Update → Device Push → Verification
```

---

## 🛠 Technology Stack

### Frontend
- **Framework**: React 18.x with TypeScript
- **UI Library**: Chakra UI v3.13.0
- **State Management**: Zustand v5.0.3
- **Data Fetching**: TanStack React Query v5.74.7
- **Data Grid**: AG Grid Community v33.1.1
- **Build Tool**: Vite
- **Icons**: React Icons (Lucide React)

### Backend
- **Framework**: Tauri v2.0 (Rust)
- **Database**: SQLx v0.7 with SQLite support
- **Async Runtime**: Tokio
- **Shell Integration**: Tauri Plugin Shell
- **File System**: Tauri Plugin FS
- **Logging**: Tauri Plugin Log

### Mobile Device Integration
**iOS Tools:**
- `libimobiledevice` (device communication)
- `ideviceinstaller` (app management)
- `afcclient` (file transfer)
- `idevice_id` (device detection)
- `ideviceinfo` (device information)
- `xcrun simctl` (simulator management)

**Android Tools:**
- ADB (Android Debug Bridge)
- Android SDK emulator tools

### Development Tools
- **Package Manager**: npm
- **Linting**: ESLint with Antfu config
- **Formatting**: Prettier
- **Testing**: Vitest, Rust cargo test
- **Type Checking**: TypeScript compiler
- **Analytics**: PostHog (optional)

---

## 🏗 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React/Chakra)                 │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Device    │ │  Database   │ │    Data     │           │
│  │ Management  │ │ Management  │ │   Display   │           │
│  │             │ │             │ │   & Edit    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
├─────────────────────────────────────────────────────────────┤
│               Tauri IPC Bridge (TypeScript/Rust)           │
├─────────────────────────────────────────────────────────────┤
│                    Backend (Rust/Tauri)                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Device    │ │  Database   │ │    File     │           │
│  │  Commands   │ │  Commands   │ │  Transfer   │           │
│  │             │ │             │ │             │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
├─────────────────────────────────────────────────────────────┤
│                External Tools & APIs                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │libimobile   │ │     ADB     │ │   SQLite    │           │
│  │  device     │ │   Android   │ │  Database   │           │
│  │    iOS      │ │   Bridge    │ │   Engine    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 Frontend Architecture

### State Management Strategy
The application uses **Zustand** for state management with multiple specialized stores:

#### 1. **Device Selection Store** (`useCurrentDeviceSelection`)
```typescript
- selectedDevice: Device | null
- setSelectedDevice: (device: Device | null) => void
- selectedApplication: Application | null  
- setSelectedApplication: (app: Application | null) => void
```

#### 2. **Database Selection Store** (`useCurrentDatabaseSelection`)
```typescript
- selectedDatabaseFile: DatabaseFile | null
- selectedDatabaseTable: DatabaseTable | null
- databaseFiles: DatabaseFile[]
- databaseTables: DatabaseTable[]
- isDBPulling: boolean
```

#### 3. **Table Data Store** (`useTableData`)
```typescript
- tableData: TableData | null
- setTableData: (data: TableData | null) => void
- isCustomQuery: boolean
- customQuery: string
```

#### 4. **Row Editing Store** (`useRowEditingStore`)
```typescript
- selectedRow: SelectedRow | null
- setSelectedRow: (row: SelectedRow | null) => void
- isEditing: boolean
```

### Component Architecture

#### Main Layout Components
- **AppHeader**: Device/app selection, refresh controls, virtual device launcher
- **SubHeader**: Database/table selection, SQL query interface, action buttons
- **DataGrid**: AG Grid integration for data display and manipulation
- **SidePanel**: Row details, editing interface, field-by-field editing

#### Data Display Components
- **DataGrid**: Main table display using AG Grid Community
- **RowEditor**: Detailed row editing with field validation
- **CustomQueryModal**: SQL query execution interface
- **AddNewRowModal**: New record creation with default values

#### Utility Components
- **FLSelect**: Custom select component with consistent styling
- **FLModal**: Standardized modal component
- **VirtualDeviceModal**: Emulator/simulator management

### Data Flow Pattern
```
User Action → Component Event → Zustand Store Update → React Query Invalidation → Backend Command → Device/Database Operation → UI Update
```

---

## ⚙️ Backend Architecture

### Tauri Command Structure

The backend is organized into modular command groups:

#### 1. **Device Commands** (`src-tauri/src/commands/device/`)
```
device/
├── adb.rs              # Android device operations
├── ios/
│   ├── device.rs       # iOS device detection
│   ├── packages.rs     # iOS app management
│   ├── database.rs     # iOS database operations
│   ├── simulator.rs    # iOS simulator support
│   └── tools.rs        # Tool path resolution
├── virtual_device.rs   # Emulator/simulator management
└── helpers.rs          # Shared utilities
```

#### 2. **Database Commands** (`src-tauri/src/commands/database/`)
```
database/
├── commands.rs         # Core database operations
├── connection_manager.rs # Connection pooling
├── helpers.rs          # Database utilities
└── types.rs           # Type definitions
```

#### 3. **Common Commands** (`src-tauri/src/commands/common.rs`)
- File dialogs (open/save)
- Drag-and-drop file handling
- Utility functions

### Database Connection Management

#### Connection Pooling Strategy
```rust
pub type DbPool = Arc<RwLock<Option<SqlitePool>>>;
pub type DbConnectionCache = Arc<RwLock<HashMap<String, SqlitePool>>>;
```

- **Legacy Pool**: Single global connection (deprecated)
- **Connection Cache**: Per-database connection pooling
- **Automatic Cleanup**: Background task removes unused connections
- **Thread Safety**: Arc<RwLock<>> for concurrent access

#### Database Operations Flow
```
Command Invocation → Pool Resolution → SQLx Query → Result Transformation → IPC Response
```

---

## 📱 Device Integration

### iOS Device Support

#### Tool Discovery Strategy
The application uses a sophisticated tool discovery system:

```rust
pub struct ToolDiscoveryStrategy {
    name: String,
    paths: Vec<PathBuf>,
    validator: fn(&PathBuf, &str) -> Result<String, String>,
}
```

**Discovery Priority:**
1. **Homebrew (Apple Silicon)**: `/opt/homebrew/bin`
2. **Homebrew (Intel)**: `/usr/local/bin`
3. **MacPorts**: `/opt/local/bin`
4. **System PATH**: Environment PATH
5. **Bundled Tools**: Embedded in app bundle
6. **Development Tools**: Local development paths

#### iOS Operations
- **Device Detection**: `idevice_id -l`
- **App Listing**: `ideviceinstaller -u [device] -l -o xml`
- **File Transfer**: `afcclient --documents [bundle] -u [device]`
- **Simulator Support**: `xcrun simctl` commands

### Android Device Support

#### ADB Integration
- **Device Detection**: `adb devices`
- **Package Listing**: `adb shell pm list packages`
- **File Transfer**: `adb pull/push` with `run-as` for app data
- **Emulator Management**: Android SDK emulator tools

#### Database Access Strategies
```
Priority Order:
1. /data/data/[package]/databases/ (admin access required)
2. /sdcard/Android/data/[package]/ (external storage)
3. /storage/emulated/0/Android/data/[package]/ (alternative external)
```

---

## 🗄 Database Management

### Database File Lifecycle

#### 1. **Discovery Phase**
```
Device Scan → Package Selection → File System Search → Database Detection
```

#### 2. **Transfer Phase**
```
Remote Detection → Local Temp Copy → SQLite Validation → Connection Pool
```

#### 3. **Operations Phase**
```
Table Analysis → Data Display → User Modifications → Local Updates
```

#### 4. **Synchronization Phase**
```
Change Detection → Device Push → Verification → Cleanup
```

### SQL Operations Support

#### Supported Operations
- **SELECT**: Full query support with filtering, sorting, joins
- **INSERT**: New record creation with default value handling
- **UPDATE**: Field-level and row-level updates
- **DELETE**: Single and batch row deletion
- **DDL**: Basic schema operations (limited)

#### Custom Query Interface
```typescript
interface CustomQueryResult {
  success: boolean;
  rows: Record<string, any>[];
  columns: ColumnInfo[];
  error?: string;
}
```

### Connection Management Features
- **Per-Database Pools**: Isolated connections for each database
- **Automatic Cleanup**: Background task removes unused connections
- **Error Recovery**: Automatic reconnection on connection failures
- **Performance Monitoring**: Connection statistics and health checks

---

## 🚀 Key Features

### 1. **Multi-Platform Device Support**
- iOS physical devices and simulators
- Android physical devices and emulators
- Virtual device launcher integration

### 2. **Comprehensive Database Management**
- SQLite database detection and analysis
- Real-time data viewing and editing
- Custom SQL query execution
- Table schema inspection

### 3. **User-Friendly Interface**
- Modern Chakra UI components
- Responsive data grid with AG Grid
- Intuitive workflow with clear visual feedback
- Dark/light theme support

### 4. **Advanced Data Operations**
- Field-level editing with validation
- Bulk operations (delete, update)
- Row addition with default values
- Custom SQL query execution
- Table data clearing

### 5. **File Management**
- Automatic temporary file handling
- Database file drag-and-drop support
- Local file browser integration
- Safe database synchronization

### 6. **Developer Tools**
- Device diagnostic tools
- Connection health monitoring
- Error reporting and logging
- Performance statistics

---

## 📁 Project Structure

```
Flippio/
├── docs/                           # Documentation
│   ├── PROJECT_OVERVIEW.md         # This file
│   ├── FLIPPIO_ANALYSIS.md         # Detailed analysis
│   └── testing/                    # Testing documentation
├── src/                            # Main source directory
│   └── renderer/                   # Frontend React application
│       ├── src/
│       │   ├── components/         # React components
│       │   │   ├── layout/         # Layout components
│       │   │   ├── data/           # Data display components
│       │   │   ├── SidePanel/      # Side panel components
│       │   │   └── common/         # Shared components
│       │   ├── hooks/              # Custom React hooks
│       │   ├── store/              # Zustand state stores
│       │   ├── types/              # TypeScript type definitions
│       │   ├── utils/              # Utility functions
│       │   └── ui/                 # UI provider and theme
│       ├── package.json            # Frontend dependencies
│       └── vite.config.ts          # Vite configuration
├── src-tauri/                      # Backend Rust application
│   ├── src/
│   │   ├── commands/               # Tauri command modules
│   │   │   ├── device/             # Device operations
│   │   │   ├── database/           # Database operations
│   │   │   └── common.rs           # Common commands
│   │   ├── main.rs                 # Application entry point
│   │   └── lib.rs                  # Library root
│   ├── tests/                      # Rust tests
│   │   ├── integration/            # Integration tests
│   │   ├── unit/                   # Unit tests
│   │   └── fixtures/               # Test fixtures
│   ├── Cargo.toml                  # Rust dependencies
│   └── tauri.conf.json             # Tauri configuration
├── example_app/                    # Example React Native app
├── resources/                      # Application resources
│   └── libimobiledevice/           # iOS tools and libraries
├── scripts/                        # Build and utility scripts
└── package.json                    # Root project configuration
```

---

## 🔧 Development Setup

### Prerequisites
- **Node.js** 18.x or later
- **Rust** 1.70 or later
- **Tauri CLI** 2.0
- **iOS Development** (macOS only):
  - Xcode 14.x or later
  - libimobiledevice tools (via Homebrew)
- **Android Development**:
  - Android SDK
  - ADB tools

### Installation Steps

#### 1. Clone Repository
```bash
git clone https://github.com/groot007/flippio.git
cd flippio
```

#### 2. Install Dependencies
```bash
npm install                    # Root dependencies
cd src/renderer && npm install # Frontend dependencies
```

#### 3. Setup iOS Tools (macOS)
```bash
# Install libimobiledevice via Homebrew
brew install libimobiledevice ideviceinstaller

# Verify installation
idevice_id --help
```

#### 4. Setup Android Tools
```bash
# Ensure ADB is in PATH
adb version

# Verify Android SDK installation
echo $ANDROID_HOME
```

#### 5. Development Commands
```bash
npm run tauri:dev              # Start development server
npm run dev:renderer           # Frontend only (development)
npm run build:renderer         # Build frontend
npm run test                   # Run frontend tests
npm run test:rust              # Run Rust tests
npm run test:all               # Run all tests
```

---

## 📦 Build & Distribution

### Build Configuration

#### Development Build
```bash
npm run tauri:dev              # Development with hot reload
npm run tauri:build:debug      # Debug build with symbols
```

#### Production Build
```bash
npm run tauri:build            # Release build
npm run tauri:build:signed     # Signed release (macOS)
```

### Auto-Updater Setup

The application includes Tauri's auto-updater with:
- **Update Endpoint**: GitHub Releases
- **Signature Verification**: Public key validation
- **Background Updates**: Non-intrusive update checking
- **Update Dialog**: Optional user confirmation

#### Update Configuration
```json
{
  "updater": {
    "active": true,
    "endpoints": [
      "https://github.com/groot007/flippio/releases/latest/download/latest.json"
    ],
    "dialog": false,
    "pubkey": "[PUBLIC_KEY]"
  }
}
```

### Bundle Configuration

#### macOS Bundle
- **Code Signing**: Developer ID Application certificate
- **Notarization**: Apple notarization for distribution
- **Frameworks**: Embedded libimobiledevice libraries
- **External Binaries**: iOS tools embedded in bundle

#### Cross-Platform Support
- **Windows**: NSIS installer with dependencies
- **Linux**: AppImage with embedded tools
- **Universal Binary**: Intel + Apple Silicon support

---

## 🧪 Testing Strategy

### Frontend Testing
- **Unit Tests**: Vitest with React Testing Library
- **Component Tests**: Isolated component testing
- **Integration Tests**: User workflow testing
- **Coverage Target**: >80% code coverage

### Backend Testing
- **Unit Tests**: Rust cargo test framework
- **Integration Tests**: Real device simulation
- **Mock Testing**: External tool mocking
- **Database Tests**: SQLite operation validation

### End-to-End Testing
- **Workflow Tests**: Complete user journey testing
- **Cross-Platform Tests**: iOS and Android validation
- **Performance Tests**: Large database handling
- **Error Scenario Tests**: Network and device failures

### Test Structure
```
tests/
├── integration/               # Integration tests
│   ├── android_workflow_test.rs
│   ├── ios_workflow_test.rs
│   └── database_operations_test.rs
├── unit/                      # Unit tests
│   ├── database_helpers.rs
│   ├── device_detection.rs
│   └── common_commands.rs
└── fixtures/                  # Test data
    ├── databases/
    └── mock_devices.rs
```

---

## ⚡ Performance Considerations

### Database Performance
- **Connection Pooling**: Minimizes connection overhead
- **Lazy Loading**: On-demand table data loading
- **Pagination**: Efficient large dataset handling
- **Query Optimization**: Prepared statements and indexing

### UI Performance
- **Virtual Scrolling**: AG Grid handles large datasets
- **React Query**: Intelligent caching and background updates
- **State Optimization**: Minimal re-renders with Zustand
- **Bundle Splitting**: Code splitting for faster loading

### Memory Management
- **Connection Cleanup**: Automatic unused connection removal
- **Temporary Files**: Automatic cleanup on exit
- **Cache Management**: LRU-based cache eviction
- **Resource Monitoring**: Memory usage tracking

### Device Communication
- **Command Caching**: Tool path caching
- **Batch Operations**: Minimized device round-trips
- **Timeout Handling**: Graceful handling of slow devices
- **Error Recovery**: Automatic retry mechanisms

---

## 🔒 Security Features

### Device Security
- **Permission Validation**: Proper device access permissions
- **Secure File Transfer**: Encrypted communication channels
- **Sandboxing**: Limited file system access
- **Authentication**: Device trust validation

### Database Security
- **Local-Only Processing**: No cloud data transmission
- **Temporary File Encryption**: Secure local storage
- **Access Control**: Read-only and read-write modes
- **Audit Logging**: Operation tracking

### Application Security
- **Code Signing**: Verified application integrity
- **Update Verification**: Cryptographic signature validation
- **Sandboxed Environment**: Tauri security model
- **Privacy**: No telemetry by default (optional PostHog)

---

## 🚀 Deployment

### Distribution Channels
- **GitHub Releases**: Primary distribution channel
- **Direct Download**: Signed DMG/EXE/AppImage files
- **Auto-Updates**: Seamless background updates

### Platform-Specific Deployment

#### macOS
- **Notarization**: Apple Developer notarization
- **Code Signing**: Developer ID Application certificate
- **Universal Binary**: Intel + Apple Silicon support
- **Bundle Dependencies**: Embedded iOS tools

#### Windows
- **Code Signing**: Authenticode certificate
- **NSIS Installer**: Professional installer experience
- **Dependency Management**: Embedded Android tools
- **Windows Defender**: SmartScreen compatibility

#### Linux
- **AppImage**: Self-contained executable
- **Package Formats**: DEB/RPM packages (future)
- **Dependency Handling**: Static linking where possible

### CI/CD Pipeline
- **GitHub Actions**: Automated build and release
- **Cross-Platform Builds**: Multi-platform compilation
- **Testing Integration**: Automated test execution
- **Security Scanning**: Vulnerability detection
- **Release Automation**: Tagged release deployment

---

## 📈 Future Enhancements

### Planned Features
- **Database Export/Import**: Backup and restore functionality
- **Schema Migration**: Database structure evolution tools
- **Multi-Database Views**: Side-by-side comparison
- **Query History**: Saved and recent queries
- **Performance Profiling**: Query execution analysis

### Technical Improvements
- **Plugin Architecture**: Extensible command system
- **WebSocket Support**: Real-time device monitoring
- **Cloud Integration**: Optional cloud backup
- **Advanced Caching**: Intelligent data prefetching
- **Accessibility**: WCAG compliance improvements

---

## 🤝 Contributing

### Development Guidelines
- **Code Style**: ESLint + Prettier for TypeScript, rustfmt for Rust
- **Testing**: All new features require tests
- **Documentation**: Update docs for user-facing changes
- **Security**: Security review for device operations

### Pull Request Process
1. Fork repository and create feature branch
2. Implement changes with appropriate tests
3. Ensure all tests pass and code style is correct
4. Update documentation as needed
5. Submit pull request with detailed description

---

## 📞 Support & Contact

- **Repository**: https://github.com/groot007/flippio
- **Issues**: GitHub Issues for bug reports and feature requests
- **Author**: Mykola Stanislavchuk (koliastanis)

---

*This document provides a comprehensive overview of the Flippio project architecture, implementation, and usage. For technical implementation details, refer to the individual module documentation and code comments.* 