// Database module
pub mod change_history;
pub mod change_tracking;
pub mod commands;
pub mod connection_manager;
pub mod helpers;
pub mod types;

#[cfg(test)]
pub mod tests;

// Re-export everything to maintain compatibility
pub use commands::*;
pub use connection_manager::DatabaseConnectionManager;
pub use types::*;

// Re-export change history components
pub use change_history::ChangeHistoryManager;
