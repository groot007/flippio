//! iOS-specific types and data structures

use serde::{Deserialize, Serialize};

/// iOS device information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IOSDevice {
    pub id: String,
    pub name: String,
    pub device_type: String,
    pub status: String,
    pub ios_version: Option<String>,
}

/// iOS simulator information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IOSSimulator {
    pub id: String,
    pub name: String,
    pub runtime: String,
    pub state: String,
    pub device_type: String,
}

/// iOS package/app information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IOSPackage {
    pub bundle_id: String,
    pub app_name: Option<String>,
    pub version: Option<String>,
    pub display_name: Option<String>,
}

/// iOS database file information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IOSDatabaseFile {
    pub path: String,
    pub filename: String,
    pub size: u64,
    pub location: String,
    pub device_type: String,
    pub is_simulator: bool,
}

/// iOS tool validation result
#[derive(Debug, Clone)]
pub struct IOSToolValidationResult {
    pub tool_name: String,
    pub is_available: bool,
    pub path: Option<String>,
    pub version: Option<String>,
    pub error: Option<String>,
}

/// iOS tool configuration
#[derive(Debug, Clone)]
pub struct IOSToolConfig {
    pub tool_name: String,
    pub timeout_seconds: u64,
    pub retry_count: u8,
    pub expected_exit_codes: Vec<i32>,
}

impl Default for IOSToolConfig {
    fn default() -> Self {
        Self {
            tool_name: "unknown".to_string(),
            timeout_seconds: 30,
            retry_count: 2,
            expected_exit_codes: vec![0],
        }
    }
} 