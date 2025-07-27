//! iOS Module Test Utilities
//! 
//! This module provides shared test utilities and fixtures for testing
//! iOS device operations, simulator management, and libimobiledevice tools.

/// Mock iOS device for testing
#[derive(Debug, Clone)]
pub struct MockIOSDevice {
    pub id: String,
    pub name: String,
    pub ios_version: String,
    pub apps: Vec<String>,
}

impl MockIOSDevice {
    pub fn new(id: &str, name: &str) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            ios_version: "17.0".to_string(),
            apps: vec![
                "com.apple.MobileStore".to_string(),
                "com.example.testapp".to_string(),
            ],
        }
    }
}

/// Mock iOS simulator for testing
#[derive(Debug, Clone)]
pub struct MockIOSSimulator {
    pub id: String,
    pub name: String,
    pub runtime: String,
    pub state: String,
}

impl MockIOSSimulator {
    pub fn new(id: &str, name: &str) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            runtime: "iOS 17.0".to_string(),
            state: "Shutdown".to_string(),
        }
    }
}

// Re-export all test modules
pub mod device_management_test;
pub mod simulator_management_test;
pub mod package_management_test;
pub mod file_operations_test;
pub mod tool_management_test;
pub mod diagnostics_test; 