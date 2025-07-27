//! Android-specific types and data structures

use serde::{Deserialize, Serialize};

/// Android device information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AndroidDevice {
    pub id: String,
    pub name: String,
    pub status: String,
    pub device_type: String,
}

/// Android package information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AndroidPackage {
    pub package_name: String,
    pub app_name: Option<String>,
    pub version: Option<String>,
    pub is_system_app: bool,
}

/// Android database file information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AndroidDatabaseFile {
    pub path: String,
    pub filename: String,
    pub size: u64,
    pub location: String,
    pub device_type: String,
}

/// ADB command result
#[derive(Debug, Clone)]
pub struct AdbCommandResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
} 