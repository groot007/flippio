//! iOS Device Management Module
//!
//! This module provides comprehensive iOS device management functionality including:
//! - Device detection and information
//! - Package and application management  
//! - Database file operations
//! - Simulator support
//! - File transfer utilities

// iOS device module
pub mod common;
pub mod database;
pub mod device;
pub mod diagnostic;
pub mod file_utils;
pub mod packages;
pub mod simulator;
pub mod tool_validation;
pub mod tools;

#[cfg(test)]
pub mod tests;

// Public exports for command registration
pub use database::*;
pub use device::*;
pub use packages::*;
pub use simulator::*;
// Tools commands available but not auto-exported (can be used via direct module path)
