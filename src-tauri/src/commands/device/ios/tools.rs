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
    match get_tool_command(tool_name) {
        Ok(path) => path,
        Err(_) => {
            error!("❌ All tool resolution methods failed for '{}', using bare command", tool_name);
            tool_name.to_string() // Last resort fallback
        }
    }
}
