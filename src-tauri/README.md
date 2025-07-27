# Flippio Backend Tests

This document describes the testing structure for the Rust backend code.

## Test Organization

### Unit Tests
Unit tests are located within each module using the `#[cfg(test)]` attribute:

#### Database Module (`src/commands/database/helpers.rs`)
- **`get_default_value_for_type()`** tests - Verify correct default values for different SQL types
- **`reset_sqlite_wal_mode()`** tests - Test WAL file cleanup functionality
- Tests cover both success cases and error handling

#### Device Module (`src/commands/device/helpers.rs`)
- **Temp directory functions** - Test temp directory creation and cleanup
- **Tool path resolution** - Test ADB and libimobiledevice tool path discovery
- **Path generation** - Test temp directory path generation

#### Common Module (`src/commands/common.rs`)
- **Data structure tests** - Test serialization/deserialization of dialog types
- **Type validation** - Test struct creation and field validation

### Integration Tests (`src-tauri/tests/mod.rs`)
Integration tests verify that modules work together correctly:

- **Database operations** - Test SQLite database creation, querying, and management
- **Connection manager** - Test database connection pooling
- **Error handling** - Verify proper error propagation
- **Multi-database workflows** - Test handling multiple databases simultaneously

### Database Integration Tests (`src/commands/database/tests/mod.rs`)
Specialized tests for database functionality:

- **Real database operations** - Using actual SQLite databases with test data
- **Connection lifecycle** - Test database connection creation and cleanup
- **SQL operations** - Test CREATE, INSERT, SELECT with real data
- **Constraint validation** - Test foreign key and unique constraints

## Test Coverage

Current test coverage includes:

### ✅ Tested Functions
- `get_default_value_for_type()` - Database type defaults
- `reset_sqlite_wal_mode()` - WAL file cleanup
- `ensure_temp_dir()` / `clean_temp_dir()` - Temp directory management
- `get_temp_dir_path()` - Path generation
- `get_adb_path()` - ADB tool discovery
- `get_libimobiledevice_tool_path()` - iOS tool discovery
- Dialog data structures and serialization
- Database connection management
- SQLite operations and constraints

### Test Types
1. **Pure function tests** - Functions with no side effects
2. **File system tests** - Functions that create/modify files and directories
3. **Database tests** - Functions that interact with SQLite databases
4. **Error handling tests** - Verify proper error cases and messages
5. **Integration tests** - End-to-end workflows

## Running Tests

```bash
# Run all tests
cargo test

# Run specific test module
cargo test commands::database::helpers::tests

# Run tests with output
cargo test -- --nocapture

# Run integration tests only
cargo test --test mod
```

## Test Dependencies

The tests use these crates (defined in `Cargo.toml`):
- `tempfile` - For creating temporary test directories
- `rusqlite` - For direct SQLite operations in tests
- `tokio-test` - For async test utilities
- `assert_fs` - For file system assertions
- `predicates` - For complex assertions

## Best Practices

1. **Isolation** - Each test is independent and doesn't affect others
2. **Cleanup** - Tests clean up any created files/directories
3. **Error Testing** - Both success and failure cases are tested
4. **Real Data** - Integration tests use actual SQLite databases
5. **Async Support** - Async functions are properly tested with tokio runtime

## Test Results Summary

- **Total Tests**: 109 (85 unit tests + 24 integration tests)
- **Status**: All passing ✅
- **Coverage**: Core helper functions, database operations, error handling, iOS device functionality, Android ADB operations

### Critical Device Testing
For comprehensive device functionality testing (iOS and ADB), see [`DEVICE_TESTS.md`](./DEVICE_TESTS.md) which covers:
- **iOS Device Connectivity**: libimobiledevice tool integration, device detection, file operations
- **Android ADB Operations**: Device discovery, package management, database file transfer  
- **Cross-Platform Support**: Mixed device environments and error handling
- **Tool Validation**: Robust fallback mechanisms for missing development tools 
