//! Workflow Integration Tests
//! 
//! This module contains end-to-end workflow tests that simulate complete user
//! interactions across multiple components of the Flippio application.

/// Cross-platform integration testing - tests that work across both Android and iOS,
/// ensuring consistent behavior regardless of the target platform
pub mod cross_platform_integration;

/// File transfer workflow testing - tests complete file transfer operations
/// including device discovery, connection, transfer, and verification
pub mod file_transfer;

/// Database synchronization workflow testing - tests database sync operations
/// between devices and the application, including conflict resolution
pub mod database_synchronization;

/// Device-database integration workflow testing - tests the complete flow from
/// device connection to database operations and data presentation
pub mod device_database_integration; 