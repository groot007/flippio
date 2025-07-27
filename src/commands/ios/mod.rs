//! iOS Device Management Module
//! 
//! This module handles all iOS device operations including:
//! - Physical device detection and connection via libimobiledevice
//! - iOS Simulator management via xcrun simctl
//! - App package management for devices and simulators
//! - File operations and database syncing
//! - Tool validation and diagnostics

pub mod device_management;
pub mod simulator_management;
pub mod package_management;
pub mod file_operations;
pub mod tool_management;
pub mod diagnostics;
pub mod types;

#[cfg(test)]
pub mod tests;

// Re-export main functions for Tauri commands
pub use device_management::*;
pub use simulator_management::*;
pub use package_management::*;
pub use file_operations::*;
pub use tool_management::*;
pub use diagnostics::*;
pub use types::*; 