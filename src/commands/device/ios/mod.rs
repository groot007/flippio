//! Legacy iOS module - Re-exports from new ios module
//! 
//! This module provides backward compatibility by re-exporting
//! functions from the new crate::commands::ios module structure.

// Re-export all iOS functionality from the new structure
pub use crate::commands::ios::*;

// Organize functions into submodules for backward compatibility
pub mod device {
    pub use crate::commands::ios::{device_get_ios_devices, device_check_app_existence};
}

pub mod packages {
    pub use crate::commands::ios::{device_get_ios_packages, device_get_ios_device_packages};
}

pub mod database {
    pub use crate::commands::ios::{get_ios_device_database_files, device_push_ios_database_file};
}

pub mod simulator {
    pub use crate::commands::ios::{get_ios_simulator_database_files, upload_simulator_ios_db_file};
}

pub mod diagnostic {
    pub use crate::commands::ios::{diagnose_ios_device, check_ios_device_status, get_ios_error_help};
} 