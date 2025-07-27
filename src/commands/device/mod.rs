// Shared device infrastructure (used by android/, ios/, virtual_devices/ modules)
pub mod discovery;
pub mod execution;
pub mod files;
pub mod validation;
pub mod helpers;
pub mod types;

// Legacy compatibility modules (re-export from new structure)
pub mod adb;
pub mod ios;
pub mod virtual_device;

// Re-export core types for convenience
pub use types::*;

// Note: Android, iOS, and virtual device commands are now in their respective modules:
// - Android commands: crate::commands::android::*
// - iOS commands: crate::commands::ios::*  
// - Virtual device commands: crate::commands::virtual_devices::*
//
// The adb, ios, and virtual_device modules above provide backward compatibility. 