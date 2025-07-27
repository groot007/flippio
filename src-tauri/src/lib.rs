//! Flippio Library - exposes internal modules for testing
//! 
//! This library crate exposes internal functions and types that are used in the main binary
//! but also need to be accessible to integration tests.

pub mod commands;

// Re-export commonly used types for external access
pub use commands::database::{
    // Database commands (Phase 2 refactored)
    db_open, db_get_tables, db_get_table_data, db_insert_table_row,
    db_update_table_row, db_delete_table_row, db_execute_query, db_get_connection_stats,
    db_clear_cache_for_path, db_clear_all_cache, db_switch_database,
    db_add_new_row_with_defaults, db_get_info,
    
    // Core business logic for testing (Phase 2)
    get_tables_impl, get_table_data_impl, insert_table_row_impl,
    get_current_pool, validate_pool_health,
    
    // Database connection manager
    DatabaseConnectionManager,
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
    get_libimobiledevice_tool_path,
};

// Re-export iOS helper functions for testing
pub use commands::ios::{
    get_ios_error_help,
};

// Re-export common utilities for use across modules
pub use commands::common::{
    CommandErrorExt,
    ShellExecutor,
    CommandResult,
}; 