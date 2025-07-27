//! Device Tool Execution Abstraction
//! 
//! This module provides a unified interface for executing device-specific tools
//! (ADB, iOS tools) with standardized error handling and response formatting.

use crate::commands::common::{ShellExecutor, CommandResult};
use crate::commands::device::types::{DeviceResponse};
use tauri::{Manager};
use log::{warn, error, debug};
use std::collections::HashMap;

/// Unified device tool executor
pub struct DeviceToolExecutor {
    shell_executor: ShellExecutor,
}

/// Configuration for tool execution
#[derive(Debug, Clone)]
pub struct ToolConfig {
    pub tool_name: String,
    pub timeout_seconds: u64,
    pub retry_count: u8,
    pub expected_exit_codes: Vec<i32>,
}

impl Default for ToolConfig {
    fn default() -> Self {
        Self {
            tool_name: "unknown".to_string(),
            timeout_seconds: 30,
            retry_count: 0,
            expected_exit_codes: vec![0],
        }
    }
}

impl DeviceToolExecutor {
    /// Create a new device tool executor
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        Self {
            shell_executor: ShellExecutor::new(app_handle),
        }
    }
    
    /// Execute an ADB command with standardized error handling
    pub async fn execute_adb(&self, args: &[&str], context: &str) -> DeviceResponse<CommandResult> {
        debug!("🤖 Executing ADB command: adb {}", args.join(" "));
        
        // Extract device ID from args if present
        let (device_id, adb_args) = if args.len() >= 2 && args[0] == "-s" {
            (Some(args[1]), &args[2..])
        } else {
            (None, args)
        };
        
        match self.shell_executor.execute_adb_command(device_id, adb_args, context).await {
            Ok(result) => {
                if result.is_success() {
                    debug!("✅ ADB command succeeded: {}", context);
                    DeviceResponse::success(result)
                } else {
                    error!("❌ ADB command failed: {}, stderr: {}", context, result.error_message().unwrap_or_default());
                    DeviceResponse::tool_error("ADB", context, &result.error_message().unwrap_or_default())
                }
            }
            Err(e) => {
                error!("❌ Failed to execute ADB command: {}", e);
                DeviceResponse::tool_error("ADB", context, &e)
            }
        }
    }
    
    /// Execute an iOS tool command with standardized error handling
    pub async fn execute_ios_tool(&self, tool_name: &str, args: &[&str], context: &str) -> DeviceResponse<CommandResult> {
        debug!("🍎 Executing iOS tool: {} {}", tool_name, args.join(" "));
        
        // Extract device ID from args if present (-u device_id)
        let (device_id, tool_args) = if args.len() >= 2 && args[0] == "-u" {
            (Some(args[1]), &args[2..])
        } else {
            (None, args)
        };
        
        match self.shell_executor.execute_ios_command(tool_name, device_id, tool_args, context).await {
            Ok(result) => {
                if result.is_success() {
                    debug!("✅ iOS tool command succeeded: {}", context);
                    DeviceResponse::success(result)
                } else {
                    error!("❌ iOS tool command failed: {}, stderr: {}", context, result.error_message().unwrap_or_default());
                    DeviceResponse::tool_error(tool_name, context, &result.error_message().unwrap_or_default())
                }
            }
            Err(e) => {
                error!("❌ Failed to execute iOS tool {}: {}", tool_name, e);
                DeviceResponse::tool_error(tool_name, context, &e)
            }
        }
    }
    
    /// Execute a simulator command (xcrun simctl)
    pub async fn execute_simctl(&self, args: &[&str], context: &str) -> DeviceResponse<CommandResult> {
        debug!("📱 Executing simctl command: xcrun simctl {}", args.join(" "));
        
        match self.shell_executor.execute_simctl_command(args, context).await {
            Ok(result) => {
                if result.is_success() {
                    debug!("✅ Simctl command succeeded: {}", context);
                    DeviceResponse::success(result)
                } else {
                    error!("❌ Simctl command failed: {}, stderr: {}", context, result.error_message().unwrap_or_default());
                    DeviceResponse::tool_error("xcrun simctl", context, &result.error_message().unwrap_or_default())
                }
            }
            Err(e) => {
                error!("❌ Failed to execute simctl command: {}", e);
                DeviceResponse::tool_error("xcrun simctl", context, &e)
            }
        }
    }
    
    /// Execute a generic tool command with full configuration
    pub async fn execute_tool_with_config(
        &self, 
        tool_name: &str, 
        args: &[&str], 
        config: &ToolConfig
    ) -> DeviceResponse<CommandResult> {
        debug!("🔧 Executing tool: {} {} (timeout: {}s, retries: {})", 
               tool_name, args.join(" "), config.timeout_seconds, config.retry_count);
        
        let context = &format!("{} {}", tool_name, args.join(" "));
        
        for attempt in 0..=config.retry_count {
            if attempt > 0 {
                // info!("🔄 Retrying {} command (attempt {} of {})", tool_name, attempt + 1, config.retry_count + 1); // Removed unused import
            }
            
            let result = match self.shell_executor.execute_tool_command(tool_name, args, context).await {
                Ok(result) => result,
                Err(e) => {
                    if attempt == config.retry_count {
                        error!("❌ Final attempt failed for {}: {}", tool_name, e);
                        return DeviceResponse::tool_error(tool_name, context, &e);
                    } else {
                        error!("❌ Attempt {} failed for {}: {}, retrying...", attempt + 1, tool_name, e);
                        continue;
                    }
                }
            };
            
            // Check if exit code is acceptable
            let exit_code = result.exit_code.unwrap_or(-1);
            if config.expected_exit_codes.contains(&exit_code) {
                debug!("✅ Tool command succeeded: {}", context);
                return DeviceResponse::success(result);
            } else if attempt == config.retry_count {
                error!("❌ Tool command failed with unexpected exit code {}: {}", exit_code, context);
                return DeviceResponse::tool_error(
                    tool_name, 
                    context, 
                    &format!("Unexpected exit code: {}", exit_code)
                );
            }
        }
        
        // This shouldn't be reached, but provide a fallback
        DeviceResponse::tool_error(tool_name, context, "Unknown execution error")
    }
}

/// Helper trait for extracting common data from command results
pub trait CommandResultExt {
    /// Extract device IDs from command output
    fn extract_device_ids(&self) -> Vec<String>;
    
    /// Extract key-value pairs from command output
    fn extract_properties(&self) -> HashMap<String, String>;
    
    /// Check if output contains specific patterns
    fn contains_pattern(&self, pattern: &str) -> bool;
}

impl CommandResultExt for CommandResult {
    fn extract_device_ids(&self) -> Vec<String> {
        let mut device_ids = Vec::new();
        
        for line in self.stdout.lines() {
            let line = line.trim();
            if !line.is_empty() && !line.starts_with('#') {
                // For ADB: first word is usually the device ID
                // For iOS: the entire line might be the device ID
                if let Some(device_id) = line.split_whitespace().next() {
                    if !device_id.is_empty() {
                        device_ids.push(device_id.to_string());
                    }
                }
            }
        }
        
        device_ids
    }
    
    fn extract_properties(&self) -> HashMap<String, String> {
        let mut properties = HashMap::new();
        
        for line in self.stdout.lines() {
            // Look for key:value or key=value patterns
            if let Some(separator_pos) = line.find(':').or_else(|| line.find('=')) {
                let key = line[..separator_pos].trim().to_string();
                let value = line[separator_pos + 1..].trim().to_string();
                if !key.is_empty() && !value.is_empty() {
                    properties.insert(key, value);
                }
            }
        }
        
        properties
    }
    
    fn contains_pattern(&self, pattern: &str) -> bool {
        self.stdout.contains(pattern) || self.stderr.contains(pattern)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_tool_config_default() {
        let config = ToolConfig::default();
        assert_eq!(config.tool_name, "unknown");
        assert_eq!(config.timeout_seconds, 30);
        assert_eq!(config.retry_count, 0);
        assert_eq!(config.expected_exit_codes, vec![0]);
    }
    
    #[test]
    fn test_command_result_extract_device_ids() {
        let result = CommandResult::success("device1\ndevice2\n".to_string());
        let device_ids = result.extract_device_ids();
        assert_eq!(device_ids, vec!["device1", "device2"]);
    }
    
    #[test]
    fn test_command_result_extract_properties() {
        let result = CommandResult::success("key1:value1\nkey2=value2\n".to_string());
        let properties = result.extract_properties();
        assert_eq!(properties.get("key1"), Some(&"value1".to_string()));
        assert_eq!(properties.get("key2"), Some(&"value2".to_string()));
    }
    
    #[test]
    fn test_command_result_contains_pattern() {
        let result = CommandResult::success("test output with pattern".to_string());
        assert!(result.contains_pattern("pattern"));
        assert!(!result.contains_pattern("missing"));
    }
} 