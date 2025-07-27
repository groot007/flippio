//! Legacy ADB module - Re-exports from new android module
//! 
//! This module provides backward compatibility by re-exporting
//! functions from the new crate::commands::android module structure.

// Re-export all Android ADB functionality from the new structure
pub use crate::commands::android::*; 