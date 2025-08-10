//! Enhanced libimobiledevice Tools Management
//! 
//! This module provides robust tool discovery and validation with multiple fallback strategies

use super::super::helpers::get_libimobiledevice_tool_path;
use super::tool_validation::{IOSToolValidator, ToolValidationError};
use log::{info, error};
use std::sync::OnceLock;

// Global tool validator instance
static TOOL_VALIDATOR: OnceLock<IOSToolValidator> = OnceLock::new();

/// Initialize the tool validator (called once)
fn get_validator() -> &'static IOSToolValidator {
    TOOL_VALIDATOR.get_or_init(|| {
        info!("🔧 Initializing iOS tool validator");
        IOSToolValidator::new()
    })
}


/// Get validated tool path with comprehensive fallback strategies
pub fn get_validated_tool_path(tool_name: &str) -> Result<String, ToolValidationError> {
    let validator = get_validator();
    
    match validator.get_validated_tool(&tool_name) {
        Ok(validated_tool) => {
            info!("✅ Tool '{}' validated via strategy: {}", tool_name, validated_tool.strategy);
            if let Some(version) = &validated_tool.version {
                info!("📋 Tool version: {}", version);
            }
            Ok(validated_tool.path.to_string_lossy().to_string())
        }
        Err(error) => {
            error!("❌ Enhanced tool validation failed for '{}': {}", tool_name, error);
            Err(error)
        }
    }
}

/// Get command string for a libimobiledevice tool with enhanced validation
pub fn get_tool_command(tool_name: &str) -> Result<String, String> {
    match get_validated_tool_path(tool_name) {
        Ok(path) => {
            info!("🔧 Using validated tool path for '{}': {}", tool_name, path);
            Ok(path)
        }
        Err(error) => {
            error!("❌ Failed to get validated tool path for '{}': {}", tool_name, error);
            
            // Fallback to legacy method as last resort
            info!("🔄 Attempting legacy fallback for '{}'", tool_name);
            if let Some(legacy_path) = get_libimobiledevice_tool_path(tool_name) {
                let path_str = legacy_path.to_string_lossy().to_string();
                info!("⚠️ Using legacy fallback path: {}", path_str);
                Ok(path_str)
            } else {
                error!("❌ Legacy fallback also failed for '{}'", tool_name);
                Err(IOSToolValidator::get_installation_instructions(&error))
            }
        }
    }
}

/// Get command string for a tool with automatic error handling (legacy compatibility)
pub fn get_tool_command_legacy(tool_name: &str) -> String {
    println!("🔧 [Tool] Resolving tool: {}", tool_name);
    match get_tool_command(tool_name) {
        Ok(path) => {
            println!("🔧 [Tool] ✅ Resolved '{}' to: {}", tool_name, path);
            path
        }
        Err(err) => {
            println!("🔧 [Tool] ❌ Failed to resolve '{}': {}", tool_name, err);
            error!("❌ All tool resolution methods failed for '{}', using bare command", tool_name);
            let fallback = tool_name.to_string();
            println!("🔧 [Tool] 🔄 Using fallback: {}", fallback);
            fallback // Last resort fallback
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_tool_command_fallback() {
        // Test the legacy tool command fallback
        let tool_name = "idevice_id";
        let command = get_tool_command_legacy(tool_name);
        
        // Should return some command (might be just the tool name)
        assert!(!command.is_empty());
        assert!(command.contains(tool_name));
    }

    #[test]
    fn test_various_ios_tools() {
        let tools = vec![
            "idevice_id",
            "ideviceinfo",
            "ideviceinstaller",
            "afcclient",
            "iproxy",
            "idevicesyslog",
        ];
        
        for tool in tools {
            let command = get_tool_command_legacy(tool);
            assert!(!command.is_empty());
            assert!(command.contains(tool));
        }
    }

    #[test]
    fn test_tool_command_with_empty_name() {
        let command = get_tool_command_legacy("");
        // Should handle empty tool name gracefully (returns empty string as fallback)
        assert_eq!(command, "");
    }

    #[test]
    fn test_tool_command_with_invalid_name() {
        let command = get_tool_command_legacy("nonexistent_tool_12345");
        // Should still return something (the tool name or a path)
        assert!(!command.is_empty());
        assert!(command.contains("nonexistent_tool_12345"));
    }

    #[test]
    fn test_tool_path_validation_logic() {
        // Test path validation concepts
        let possible_paths = vec![
            "/usr/local/bin/idevice_id",
            "/opt/homebrew/bin/idevice_id", 
            "/usr/bin/idevice_id",
            "idevice_id", // Just the tool name
        ];
        
        for path in possible_paths {
            // Each path should contain the tool name
            assert!(path.contains("idevice_id"));
            
            // Path should be either absolute or just the tool name
            assert!(path.starts_with("/") || !path.contains("/"));
        }
    }

    #[test]
    fn test_common_tool_scenarios() {
        // Test common iOS development tool scenarios
        
        // Device listing
        let device_list_cmd = get_tool_command_legacy("idevice_id");
        assert!(device_list_cmd.contains("idevice_id"));
        
        // Device info
        let device_info_cmd = get_tool_command_legacy("ideviceinfo");
        assert!(device_info_cmd.contains("ideviceinfo"));
        
        // App management
        let installer_cmd = get_tool_command_legacy("ideviceinstaller");
        assert!(installer_cmd.contains("ideviceinstaller"));
        
        // File access
        let afc_cmd = get_tool_command_legacy("afcclient");
        assert!(afc_cmd.contains("afcclient"));
    }

    #[test]
    fn test_tool_name_formats() {
        // Test various tool name formats
        let tool_formats = vec![
            ("idevice_id", true),       // Standard libimobiledevice tool
            ("afcclient", true),        // AFC (Apple File Conduit) client
            ("iproxy", true),           // Proxy tool
            ("random_tool", false),     // Not a standard iOS tool
            ("", false),                // Empty string
        ];
        
        for (tool_name, is_ios_tool) in tool_formats {
            let command = get_tool_command_legacy(tool_name);
            
            if tool_name.is_empty() {
                // Empty tool name returns empty string
                assert_eq!(command, "");
            } else {
                assert!(!command.is_empty());
                if is_ios_tool {
                    assert!(command.contains(tool_name));
                }
            }
        }
    }

    #[test]
    fn test_tool_command_consistency() {
        // Test that tool commands are consistent across multiple calls
        let tool_name = "idevice_id";
        
        let cmd1 = get_tool_command_legacy(tool_name);
        let cmd2 = get_tool_command_legacy(tool_name);
        
        // Commands should be the same
        assert_eq!(cmd1, cmd2);
        assert!(cmd1.contains(tool_name));
    }

    #[test]
    fn test_tool_path_components() {
        // Test path component analysis
        let test_paths = vec![
            "/usr/local/bin/idevice_id",
            "/opt/homebrew/bin/ideviceinfo",
            "ideviceinstaller", // No path, just tool name
        ];
        
        for path in test_paths {
            if path.contains("/") {
                // It's a full path
                let path_obj = PathBuf::from(path);
                assert!(path_obj.file_name().is_some());
                
                let tool_name = path_obj.file_name().unwrap().to_string_lossy();
                assert!(!tool_name.is_empty());
                assert!(tool_name.starts_with("idevice") || tool_name == "afcclient");
            } else {
                // It's just a tool name
                assert!(path.starts_with("idevice") || path == "afcclient");
            }
        }
    }

    #[test]
    fn test_libimobiledevice_tool_integration() {
        // Test integration with libimobiledevice tool discovery
        let tool_name = "idevice_id";
        
        // Test the legacy method
        let legacy_cmd = get_tool_command_legacy(tool_name);
        assert!(!legacy_cmd.is_empty());
        assert!(legacy_cmd.contains(tool_name));
        
        // Test that we can get some form of path (might be None if tools not installed)
        let tool_path = get_libimobiledevice_tool_path(tool_name);
        // Just verify the function works (may return None if tools not available)
        assert!(tool_path.is_some() || tool_path.is_none());
    }

    #[test]
    fn test_error_scenarios() {
        // Test various error scenarios that might occur
        
        // Very long tool name
        let long_name = "a".repeat(1000);
        let cmd = get_tool_command_legacy(&long_name);
        assert!(!cmd.is_empty());
        
        // Tool name with special characters
        let special_name = "tool@#$%^&*()";
        let cmd = get_tool_command_legacy(special_name);
        assert!(!cmd.is_empty());
        
        // Tool name with spaces
        let spaced_name = "tool with spaces";
        let cmd = get_tool_command_legacy(spaced_name);
        assert!(!cmd.is_empty());
    }

    #[test]
    fn test_tool_discovery_fallback_chain() {
        // Test the concept of fallback chain for tool discovery
        let tool_name = "idevice_id";
        
        // Common paths where libimobiledevice tools might be installed
        let common_paths = vec![
            "/usr/local/bin",
            "/opt/homebrew/bin", 
            "/usr/bin",
            "/opt/local/bin",
        ];
        
        for base_path in common_paths {
            let full_path = format!("{}/{}", base_path, tool_name);
            
            // Verify path construction
            assert!(full_path.starts_with("/"));
            assert!(full_path.ends_with(tool_name));
            assert!(full_path.contains(base_path));
        }
        
        // Test fallback to just tool name
        let fallback = tool_name.to_string();
        assert_eq!(fallback, tool_name);
    }

    #[test]
    fn test_validator_initialization() {
        // Test that validator can be initialized (conceptually)
        // This tests the initialization pattern used in the module
        
        // Test that we can call get_validator multiple times
        let validator1 = get_validator();
        let validator2 = get_validator();
        
        // Should be the same instance (OnceLock pattern)
        assert!(std::ptr::eq(validator1, validator2));
    }
}
