//! Android Module Test Utilities
//! 
//! This module provides shared test utilities and fixtures for testing
//! Android device operations, ADB commands, and file operations.

use std::collections::HashMap;

/// Mock Android device for testing
#[derive(Debug, Clone)]
pub struct MockAndroidDevice {
    pub id: String,
    pub name: String,
    pub status: String,
    pub packages: Vec<String>,
}

impl MockAndroidDevice {
    pub fn new(id: &str, name: &str) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            status: "device".to_string(),
            packages: vec![
                "com.example.app1".to_string(),
                "com.example.app2".to_string(),
                "com.test.database".to_string(),
            ],
        }
    }
}

/// Mock ADB command executor for testing
pub struct MockAdbExecutor {
    pub responses: HashMap<String, String>,
    pub should_fail: bool,
}

impl MockAdbExecutor {
    pub fn new() -> Self {
        let mut responses = HashMap::new();
        
        // Mock device list response
        responses.insert(
            "devices".to_string(),
            "List of devices attached\ntest_device_123\tdevice\n".to_string(),
        );
        
        // Mock package list response
        responses.insert(
            "packages".to_string(),
            "package:com.example.app1\npackage:com.example.app2\n".to_string(),
        );
        
        Self {
            responses,
            should_fail: false,
        }
    }
    
    pub fn set_response(&mut self, command: &str, response: &str) {
        self.responses.insert(command.to_string(), response.to_string());
    }
    
    pub fn simulate_failure(&mut self) {
        self.should_fail = true;
    }
}

/// Create temporary test database file
pub fn create_test_database() -> Result<String, Box<dyn std::error::Error>> {
    use std::fs;
    let temp_dir = std::env::temp_dir();
    let db_path = temp_dir.join("test_android.db");
    
    // Create a simple SQLite database for testing
    let db_content = b"SQLite format 3\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00";
    fs::write(&db_path, db_content)?;
    
    Ok(db_path.to_string_lossy().to_string())
}

/// Clean up test files
pub fn cleanup_test_files() {
    let temp_dir = std::env::temp_dir();
    let _ = std::fs::remove_file(temp_dir.join("test_android.db"));
}

// Re-export all test modules
pub mod device_management_test;
pub mod package_management_test;
pub mod file_operations_test; 