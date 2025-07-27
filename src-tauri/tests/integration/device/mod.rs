//! Device Integration Tests
//! 
//! This module contains integration tests for device operations including
//! Android and iOS device interactions, file transfers, and device management.

/// Android device operations testing - covers ADB interactions, device discovery,
/// app management, and file operations on Android devices
pub mod android_operations;

/// iOS device operations testing - covers libimobiledevice interactions,
/// device discovery, app management, and file operations on iOS devices  
pub mod ios_operations; 