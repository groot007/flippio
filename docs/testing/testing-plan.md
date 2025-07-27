# Flippio Rust Backend Testing Plan

## Overview
This document outlines the comprehensive testing strategy for the Flippio Tauri backend to ensure device communication reliability and prevent regressions when adding new features.

## Test Categories

### 1. Unit Tests (`tests/unit/`)

#### Device Helpers (`device_helpers.rs`)
- **Temp Directory Management**
  - Create temp directories for file operations
  - Clean up temp directories after use
  - Handle permission errors
  - Test concurrent temp directory access

- **ADB Path Resolution**
  - Resolve bundled ADB binary path
  - Handle missing ADB binary
  - Test different OS paths

- **Command Output Parsing**
  - Parse Android device lists
  - Parse package information
  - Handle malformed ADB output
  - Test empty command responses

#### Database Helpers (`database_helpers.rs`)
- **Connection Pool Management**
  - Create and destroy SQLite pools
  - Handle concurrent database access
  - Test connection failures
  - Pool state synchronization

- **Database Operations**
  - Table listing and schema queries
  - Data retrieval and validation
  - Foreign key constraint handling
  - Error recovery scenarios

#### iOS Helpers (`ios_helpers.rs`)
- **Device Discovery**
  - iOS device enumeration
  - Device status validation
  - Handle disconnected devices
  - Tool availability checks

- **App and Database Listing**
  - iOS app enumeration
  - Database file discovery
  - Bundle ID validation
  - Path resolution

- **Command Construction**
  - idevice_id command building
  - ideviceinstaller arguments
  - afcclient file transfer commands
  - Error handling for invalid UDIDs

#### File Utilities (`file_utilities.rs`)
- **Temporary File Management**
  - Create and manage temp files
  - File permission handling
  - Binary file operations
  - Directory traversal

- **Security and Validation**
  - Path validation (prevent directory traversal)
  - File extension validation
  - Symlink handling
  - Filename sanitization

- **Cleanup Operations**
  - Automatic file cleanup
  - Manual cleanup procedures
  - Handling cleanup failures
  - Partial cleanup scenarios

### 2. Integration Tests (`tests/integration/`)

#### Device Database Workflow (`device_database_workflow.rs`)
- **End-to-End Device Discovery**
  - Complete workflow from device detection to database access
  - iOS and Android device handling
  - App discovery and database enumeration
  - File transfer and database connection

- **Concurrent Device Access**
  - Multiple devices accessing databases simultaneously
  - Database switching between devices
  - Connection pool management across devices

- **Error Recovery**
  - Device disconnection handling
  - Database connection failures
  - Recovery from errors

#### File Transfer Workflow (`file_transfer_workflow.rs`)
- **iOS File Transfer**
  - Complete afcclient transfer simulation
  - File integrity validation
  - Transfer error scenarios
  - Large file handling

- **Android File Transfer**
  - ADB pull command simulation
  - File validation after transfer
  - Permission and access errors

- **Transfer Management**
  - Concurrent transfers
  - Filename conflict resolution
  - Transfer cleanup procedures

#### Database Sync Workflow (`database_sync_workflow.rs`)
- **Database Synchronization**
  - Device to local database sync
  - Multi-device database management
  - State consistency during operations

- **Connection Pool Management**
  - Pool creation and destruction
  - Concurrent pool access
  - Pool state transitions

- **Refresh Cycles**
  - Database refresh from device
  - State management during refresh
  - Error handling during sync

### 3. Test Fixtures (`tests/fixtures/`)

#### Mock Devices (`mock_devices.rs`)
- iOS and Android device mocks
- App and database mocks
- Realistic test data

#### Test Databases (`test_databases.rs`)
- SQLite database creation with sqlx
- Complex schema with relationships
- Corrupted and empty database scenarios

#### Temporary Files (`temp_files.rs`)
- Thread-safe temporary file manager
- Automatic cleanup capabilities
- Cross-platform compatibility

## Running Tests

### All Tests
```bash
cargo test
```

### Unit Tests Only
```bash
cargo test unit
```

### Integration Tests Only
```bash
cargo test integration
```

### Specific Test Module
```bash
cargo test device_helpers
cargo test database_sync
```

### Serial Tests (for resource-sensitive tests)
```bash
cargo test -- --test-threads=1
```

## Test Coverage Goals

### Critical Paths (Must be tested)
- Device discovery and connection
- Database file transfer
- SQLite connection and query execution
- Error handling and recovery
- Temporary file management

### Error Scenarios (Must handle gracefully)
- Device disconnection during transfer
- Corrupted database files
- Permission denied errors
- Network timeouts
- Invalid command responses

### Performance Considerations
- Concurrent device access
- Large database file transfers
- Memory usage during operations
- Connection pool efficiency

## Continuous Integration

### Pre-commit Checks
- All unit tests must pass
- No compilation warnings
- Code formatting with rustfmt
- Clippy lints

### CI Pipeline
- Test on multiple Rust versions
- Cross-platform testing (macOS, Windows, Linux)
- Memory leak detection
- Performance regression tests

## Mock Strategy

### External Dependencies
- **ADB Commands**: Mock output using predefined responses
- **iOS Tools**: Simulate idevice command responses
- **File System**: Use temporary directories for all file operations
- **Network**: Mock any network-dependent operations

### Database Testing
- Use in-memory SQLite for fast tests
- Create realistic schema and data
- Test both successful and error conditions

## Maintenance

### Adding New Features
1. Write tests for new functionality first (TDD)
2. Ensure all existing tests still pass
3. Add integration tests for new workflows
4. Update this testing plan document

### Regression Prevention
- Never skip tests when adding features
- Run full test suite before merging
- Monitor test execution time
- Keep test data realistic and comprehensive

## Test Environment Setup

### Required Tools
- Rust 1.70+ (for tokio and sqlx compatibility)
- SQLite 3.x
- Tokio runtime for async tests

### Test Data
- Realistic device UDIDs and names
- Valid SQLite database files
- Appropriate file sizes for transfer tests
- Error scenarios and edge cases

This testing plan ensures that the Flippio backend maintains reliability while allowing for safe feature development and prevents regressions in critical device communication functionality.
