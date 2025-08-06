// Database module
pub mod types;
pub mod helpers;
pub mod commands;
pub mod connection_manager;
pub mod change_history;

#[cfg(test)]
pub mod tests;

// Re-export everything to maintain compatibility
pub use types::*;
pub use commands::*;
pub use connection_manager::DatabaseConnectionManager;

// Re-export change history components
pub use change_history::ChangeHistoryManager;
