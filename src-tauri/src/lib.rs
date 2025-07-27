//! Flippio Library - exposes internal modules for testing
//! 
//! This library crate exposes internal functions and types that are used in the main binary
//! but also need to be accessible to integration tests.

pub mod commands;

// Re-export commonly used types for external access
pub use commands::database::{
    DbPool, DbConnectionCache, DatabaseConnectionManager, DbResponse
};

// Re-export all database commands for testing
pub use commands::database::commands::*;

// Re-export database helper functions for testing
pub use commands::database::helpers::{
    get_default_value_for_type,
    reset_sqlite_wal_mode,
};

// Re-export device helper functions for testing
pub use commands::device::helpers::{
    ensure_temp_dir,
    clean_temp_dir,
    force_clean_temp_dir,
    touch_temp_file,
    get_libimobiledevice_tool_path,
};

// Re-export iOS helper functions for testing
pub use commands::device::ios::diagnostic::{
    get_ios_error_help,
}; 