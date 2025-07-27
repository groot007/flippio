//! Device Discovery
//! 
//! This module provides unified device detection and discovery capabilities
//! for Android and iOS devices and simulators.

pub mod device_scanner;

// Re-export main discovery utilities
pub use device_scanner::{
    DeviceScanner,
    ScanConfig,
}; 