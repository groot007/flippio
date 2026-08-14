// Database module
pub mod change_history;
pub mod change_tracking;
pub mod commands;
mod connection_access;
pub mod connection_manager;
pub mod helpers;
mod table_reads;
pub mod types;

#[cfg(test)]
pub mod tests;

// Re-export everything to maintain compatibility
pub use commands::*;
pub(crate) use connection_access::{has_live_cached_connection, reset_connection_for_open};
pub use connection_manager::DatabaseConnectionManager;
pub use table_reads::*;
pub use types::*;

// Re-export change history components
pub use change_history::ChangeHistoryManager;
