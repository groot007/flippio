//! Integration Tests for Flippio Backend
//! 
//! This module organizes all integration tests into logical categories for better
//! maintainability and clarity. Each subdirectory focuses on a specific area of
//! functionality with comprehensive test coverage.

/// Database operations and management tests
/// - CRUD operations testing
/// - Business logic extraction verification  
/// - Tauri command wrapper validation
/// - Connection pooling and isolation
pub mod database;

/// Device interaction and management tests
/// - Android device operations via ADB
/// - iOS device operations via libimobiledevice
/// - Cross-platform device management
pub mod device;

/// End-to-end workflow integration tests
/// - Complete user interaction flows
/// - Cross-platform workflow validation
/// - File transfer operations
/// - Database synchronization workflows
pub mod workflows;

/// Core application functionality tests
/// - Common utilities and helpers
/// - Configuration management
/// - Error handling scenarios
pub mod core;
