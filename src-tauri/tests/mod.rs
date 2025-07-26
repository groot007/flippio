//! Integration tests for Flippio Tauri backend
//!
//! Test Categories:
//! 1. Unit Tests - Individual function testing
//! 2. Integration Tests - Component interaction testing
//! 3. Database Tests - SQLite operations and connection pooling
//! 4. Device Communication Tests - ADB and iOS tool interactions
//! 5. File Operations Tests - Temp directories, file copying
//! 6. Error Handling Tests - Edge cases and failure scenarios

// Test fixtures and utilities
pub mod fixtures;

// Unit tests for individual components
pub mod unit;

// Integration tests for cross-component workflows
pub mod integration;
