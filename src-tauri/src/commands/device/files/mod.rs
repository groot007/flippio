//! Device File Operations
//! 
//! This module provides unified file operation abstractions for different device types,
//! hiding the complexity of platform-specific file transfer protocols.

pub mod ios_file_operations;

// Re-export main file operation utilities
pub use ios_file_operations::{
    IOSFileManager,
    FileOperationConfig,
}; 