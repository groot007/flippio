//! Android Device Management Module
//! 
//! This module handles all Android device operations including:
//! - Device detection and connection via ADB
//! - App package management 
//! - File operations and database syncing

pub mod device_management;
pub mod package_management;
pub mod file_operations;
pub mod types;

#[cfg(test)]
pub mod tests;

// Re-export main functions for Tauri commands
pub use device_management::*;
pub use package_management::*;
pub use file_operations::*;
pub use types::*; 