//! Common Utilities for Flippio Commands
//! 
//! This module provides shared utilities and abstractions used across all command modules
//! to ensure consistency, reduce code duplication, and improve maintainability.

pub mod error_handling;
pub mod shell_executor;
pub mod file_operations;
pub mod dialog_manager;
pub mod update_manager;

// Re-export commonly used items for convenience
pub use error_handling::{
    CommandErrorExt, 
};
pub use shell_executor::{
    ShellExecutor,
    CommandResult,
}; 