//! Database Integration Tests
//! 
//! This module contains comprehensive integration tests for all database operations
//! in the Flippio application. Tests are organized by functionality and complexity.

/// Complete CRUD operations testing - covers all create, read, update, delete operations
/// with comprehensive error handling, validation, and edge cases
pub mod complete_crud_operations;

/// Business logic extraction testing - tests the core business logic functions
/// that have been extracted from Tauri commands for better testability
pub mod business_logic_extraction;

/// Tauri command wrapper testing - tests the actual Tauri command functions
/// to ensure proper integration with Tauri's state management
pub mod tauri_command_wrappers;

/// Connection isolation testing - tests database connection management,
/// connection pooling, and isolation between different database operations
pub mod connection_isolation; 