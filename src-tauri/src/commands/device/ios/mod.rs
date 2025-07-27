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
pub mod device;
pub mod packages;
pub mod simulator;
pub mod database;
pub mod file_utils;
pub mod tools;
pub mod tool_validation;
pub mod diagnostic;

// Public exports for command registration
pub use device::*;
pub use packages::*;
pub use simulator::*; 
pub use database::*;
// Tools commands available but not auto-exported (can be used via direct module path)
