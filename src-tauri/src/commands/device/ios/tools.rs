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

/// Get the path to a specific libimobiledevice tool with enhanced validation
#[allow(dead_code)]
#[tauri::command]
pub async fn get_libimobiledevice_tool_path_cmd(tool_name: String) -> Result<String, String> {
    match get_validated_tool_path(&tool_name) {
        Ok(path) => Ok(path),
        Err(error) => {
            error!("❌ Tool validation failed: {}", error);
            let instructions = IOSToolValidator::get_installation_instructions(&error);
            Err(instructions)
        }
    }
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

/// Check if a specific iOS tool is available and working
#[allow(dead_code)]
#[tauri::command]
pub async fn check_ios_tool_availability(tool_name: String) -> Result<serde_json::Value, String> {
    let validator = get_validator();
    
    match validator.get_validated_tool(&tool_name) {
        Ok(validated_tool) => {
            Ok(serde_json::json!({
                "available": true,
                "path": validated_tool.path.to_string_lossy(),
                "strategy": validated_tool.strategy,
                "version": validated_tool.version,
                "error": null
            }))
        }
        Err(error) => {
            Ok(serde_json::json!({
                "available": false,
                "path": null,
                "strategy": null,
                "version": null,
                "error": error.to_string(),
                "instructions": IOSToolValidator::get_installation_instructions(&error)
            }))
        }
    }
}

/// Get status of all iOS tools
#[allow(dead_code)]
#[tauri::command]
pub async fn get_ios_tools_status() -> Result<serde_json::Value, String> {
    let tools = ["idevice_id", "ideviceinfo", "afcclient", "ideviceinstaller"];
    let validator = get_validator();
    
    let mut tool_status = serde_json::Map::new();
    let mut all_available = true;
    
    for tool_name in &tools {
        match validator.get_validated_tool(tool_name) {
            Ok(validated_tool) => {
                tool_status.insert(tool_name.to_string(), serde_json::json!({
                    "available": true,
                    "path": validated_tool.path.to_string_lossy(),
                    "strategy": validated_tool.strategy,
                    "version": validated_tool.version
                }));
            }
            Err(error) => {
                all_available = false;
                tool_status.insert(tool_name.to_string(), serde_json::json!({
                    "available": false,
                    "error": error.to_string()
                }));
            }
        }
    }
    
    Ok(serde_json::json!({
        "all_available": all_available,
        "tools": tool_status,
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

// Legacy function for backward compatibility
pub fn get_tool_path_with_logging(tool_name: &str) -> Option<std::path::PathBuf> {
    match get_validated_tool_path(tool_name) {
        Ok(path) => Some(std::path::PathBuf::from(path)),
        Err(_) => {
            // Fallback to legacy method
            get_libimobiledevice_tool_path(tool_name)
        }
    }
}
