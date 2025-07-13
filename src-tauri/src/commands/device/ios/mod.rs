//! iOS Device Management Module
//! 
//! This module provides comprehensive iOS device management functionality including:
//! - Device detection and information
//! - Package and application management  
//! - Database file operations
//! - Simulator support
//! - File transfer utilities

pub mod device;
pub mod packages;
pub mod database;
pub mod simulator;
pub mod file_utils;
pub mod tools;

// Re-export all public functions from sub-modules
pub use device::*;
pub use packages::*;
pub use database::*;
pub use simulator::*;
pub use tools::*;
