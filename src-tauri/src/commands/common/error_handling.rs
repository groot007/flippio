//! Common Error Handling Utilities
//! 
//! This module provides utilities to standardize error handling across all Flippio commands,
//! eliminating repetitive error patterns and providing consistent user-friendly messages.

use crate::commands::database::types::DbResponse;
use crate::commands::device::types::DeviceResponse;

/// Extension trait for adding context to errors
#[allow(dead_code)]
pub trait CommandErrorExt<T> {
    /// Add simple context to an error
    fn with_context(self, context: &str) -> Result<T, String>;
    
    /// Add operation and resource context to an error
    fn with_operation_context(self, operation: &str, resource: &str) -> Result<T, String>;
    
    /// Add device-specific context to an error
    #[allow(dead_code)]
    fn with_device_context(self, operation: &str, device_id: &str) -> Result<T, String>;
    
    /// Add database-specific context to an error  
    #[allow(dead_code)]
    fn with_database_context(self, operation: &str, database: &str) -> Result<T, String>;
}

impl<T, E: std::fmt::Display> CommandErrorExt<T> for Result<T, E> {
    fn with_context(self, context: &str) -> Result<T, String> {
        self.map_err(|e| format!("{}: {}", context, e))
    }
    
    fn with_operation_context(self, operation: &str, resource: &str) -> Result<T, String> {
        self.map_err(|e| format!("Failed to {} {}: {}", operation, resource, e))
    }
    
    fn with_device_context(self, operation: &str, device_id: &str) -> Result<T, String> {
        self.map_err(|e| format!("🔌 Failed to {} device '{}': {}", operation, device_id, e))
    }
    
    fn with_database_context(self, operation: &str, database: &str) -> Result<T, String> {
        self.map_err(|e| format!("🗄️ Failed to {} database '{}': {}", operation, database, e))
    }
}

/// Database Response Builders
impl<T> DbResponse<T> {
    /// Create a successful database response
    #[allow(dead_code)]
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }
    
    /// Create an error database response
    #[allow(dead_code)]
    pub fn error(message: &str) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message.to_string()),
        }
    }
    
    /// Create an error database response with formatted message
    #[allow(dead_code)]
    pub fn error_fmt(operation: &str, resource: &str, error: &str) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(format!("Failed to {} {}: {}", operation, resource, error)),
        }
    }
    
    /// Convert from a Result, using operation context for errors
    #[allow(dead_code)]
    pub fn from_result_with_context(
        result: Result<T, impl std::fmt::Display>, 
        operation: &str, 
        resource: &str
    ) -> Self {
        match result {
            Ok(data) => Self::success(data),
            Err(e) => Self::error_fmt(operation, resource, &e.to_string()),
        }
    }
}

/// Device Response Builders  
impl<T> DeviceResponse<T> {
    /// Create a successful device response
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }
    
    /// Create an error device response
    pub fn error(message: &str) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message.to_string()),
        }
    }
    
    /// Create a device-specific error response
    #[allow(dead_code)]
    pub fn device_error(operation: &str, device_id: &str, error: &str) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(format!("Failed to {} on device '{}': {}", operation, device_id, error)),
        }
    }
    
    /// Create an error device response with tool context
    pub fn tool_error(tool_name: &str, operation: &str, error: &str) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(format!("⚙️ {} failed during {}: {}", tool_name, operation, error)),
        }
    }
    
    /// Convert from a Result, using device context for errors
    #[allow(dead_code)]
    pub fn from_result_with_device_context(
        result: Result<T, impl std::fmt::Display>, 
        operation: &str, 
        device_id: &str
    ) -> Self {
        match result {
            Ok(data) => Self::success(data),
            Err(e) => Self::device_error(operation, device_id, &e.to_string()),
        }
    }
}

/// Utility functions for common error scenarios
pub mod common_errors {
    
    /// Create a "tool not found" error message with helpful suggestions
    #[allow(dead_code)]
    pub fn tool_not_found_error(tool_name: &str) -> String {
        match tool_name {
            "adb" => format!("⚙️ ADB not found. Please install Android SDK and ensure ADB is in your PATH."),
            "idevice_id" | "ideviceinstaller" | "afcclient" => {
                format!("⚙️ {} not found. Please install libimobiledevice tools.", tool_name)
            },
            "xcrun" => format!("⚙️ Xcode Command Line Tools not found. Please install Xcode."),
            _ => format!("⚙️ {} not found. Please ensure it's installed and in your PATH.", tool_name),
        }
    }
    
    /// Create a "device not connected" error message
    #[allow(dead_code)]
    pub fn device_not_connected_error(device_id: &str, device_type: &str) -> String {
        format!("🔌 {} device '{}' not connected or not accessible. Please check your connection.", device_type, device_id)
    }
    
    /// Create a "permission denied" error message  
    #[allow(dead_code)]
    pub fn permission_denied_error(operation: &str, resource: &str) -> String {
        format!("🔒 Permission denied: cannot {} {}. Please check file permissions.", operation, resource)
    }
    
    /// Create a "file not found" error message
    #[allow(dead_code)]
    pub fn file_not_found_error(file_path: &str) -> String {
        format!("📄 File not found: '{}'. Please check the file path.", file_path)
    }
    
    /// Create a "database corruption" error message
    #[allow(dead_code)]
    pub fn database_corruption_error(database: &str) -> String {
        format!("🗄️ Database '{}' appears to be corrupted or is not a valid SQLite database.", database)
    }
}

/// Macro for simplified error handling with context
#[macro_export]
macro_rules! with_context {
    ($result:expr, $context:expr) => {
        $result.with_context($context)
    };
    ($result:expr, $operation:expr, $resource:expr) => {
        $result.with_operation_context($operation, $resource)
    };
}

/// Macro for creating standardized log messages with error context
#[macro_export]
macro_rules! log_operation {
    (info, $operation:expr, $resource:expr) => {
        log::info!("🔄 Starting {} for {}", $operation, $resource)
    };
    (success, $operation:expr, $resource:expr) => {
        log::info!("✅ Successfully completed {} for {}", $operation, $resource)
    };
    (error, $operation:expr, $resource:expr, $error:expr) => {
        log::error!("❌ Failed to {} {}: {}", $operation, $resource, $error)
    };
}

#[cfg(test)]
mod tests {
    use super::CommandErrorExt; // Import the trait to use its methods
    use crate::commands::database::types::DbResponse;
    use crate::commands::device::types::DeviceResponse;
    
    #[test]
    fn test_command_error_ext() {
        let result: Result<String, &str> = Err("connection timeout");
        let error = result.with_operation_context("connect to", "database").unwrap_err();
        assert_eq!(error, "Failed to connect to database: connection timeout");
    }
    
    #[test]
    fn test_db_response_builders() {
        let success_response = DbResponse::success("data".to_string());
        assert!(success_response.success);
        assert_eq!(success_response.data, Some("data".to_string()));
        
        let error_response: DbResponse<String> = DbResponse::error("test error");
        assert!(!error_response.success);
        assert_eq!(error_response.error, Some("test error".to_string()));
    }
    
    #[test]
    fn test_device_response_builders() {
        let success_response = DeviceResponse::success(vec!["device1".to_string()]);
        assert!(success_response.success);
        
        let error_response: DeviceResponse<Vec<String>> = DeviceResponse::device_error(
            "connect to", "device123", "network error"
        );
        assert!(!error_response.success);
        assert!(error_response.error.unwrap().contains("device123"));
    }
} 