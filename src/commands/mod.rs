//! Flippio Commands Module
//! 
//! This module organizes all Tauri commands by system and functionality:
//! - Android: Device management, packages, file operations via ADB
//! - iOS: Device management, simulators, packages, file operations via libimobiledevice
//! - Database: Pure SQL operations (queries, mutations, schema management)
//! - Dialogs: File selection and export operations
//! - Virtual Devices: Emulator and simulator management
//! - Common: Shared utilities, error handling, shell execution
//! - Integrations: Cross-system operations and coordination

// New organized modules
pub mod android;
pub mod ios;
pub mod database;
pub mod dialogs;
pub mod virtual_devices;
pub mod common;
pub mod integrations;
pub mod app_management;

// Legacy modules (to be phased out)
pub mod device;
pub mod file_dialogs;
pub mod updater;

// Re-export main functions for Tauri command registration
// Android commands
pub use android::*;

// iOS commands  
pub use ios::*;

// Database commands
pub use database::*;

// Legacy device commands (temporary)
pub use device::*;

// File dialog commands
pub use file_dialogs::*;

// Updater commands
pub use updater::*; 