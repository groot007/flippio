//! Legacy virtual_device module - Re-exports from new virtual_devices module
//! 
//! This module provides backward compatibility by re-exporting
//! functions from the new crate::commands::virtual_devices module structure.

// Re-export all virtual device functionality from the new structure
pub use crate::commands::virtual_devices::*; 