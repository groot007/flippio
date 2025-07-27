//! Shell Command Execution Utilities
//! 
//! This module provides a unified abstraction for executing shell commands across all device
//! and system operations, standardizing error handling, logging, and timeout management.

use tauri_plugin_shell::{ShellExt};
use crate::commands::common::{CommandErrorExt};
use std::collections::HashMap;
use log::{warn, error, debug};

/// Unified shell command executor with standardized error handling and logging
pub struct ShellExecutor {
    app_handle: tauri::AppHandle,
}

/// Result of a shell command execution
#[derive(Debug, Clone)]
pub struct CommandResult {
    pub stdout: String,
    pub stderr: String,
    pub success: bool,
    pub exit_code: Option<i32>,
}

impl CommandResult {
    /// Create a new successful command result
    #[allow(dead_code)]
    pub fn success(stdout: String) -> Self {
        Self {
            success: true,
            exit_code: Some(0),
            stdout,
            stderr: String::new(),
        }
    }
    
    /// Create a new failed command result
    #[allow(dead_code)]
    pub fn failure(stderr: String, exit_code: Option<i32>) -> Self {
        Self {
            success: false,
            exit_code,
            stdout: String::new(),
            stderr,
        }
    }
    
    /// Check if the command was successful
    pub fn is_success(&self) -> bool {
        self.success
    }
    
    /// Get the output (stdout if success, stderr if failure)
    #[allow(dead_code)]
    pub fn output(&self) -> &str {
        if !self.stdout.is_empty() {
            &self.stdout
        } else {
            &self.stderr
        }
    }
    
    /// Get error message if command failed
    pub fn error_message(&self) -> Option<String> {
        if self.success {
            None
        } else {
            Some(if self.stderr.is_empty() {
                format!("Command failed with exit code: {:?}", self.exit_code)
            } else {
                self.stderr.clone()
            })
        }
    }
}

impl ShellExecutor {
    /// Create a new shell executor
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        Self { app_handle }
    }
    
    /// Execute a command with comprehensive error handling and logging
    pub async fn execute_command(
        &self,
        command: &str,
        args: &[&str],
        context: &str,
    ) -> Result<CommandResult, String> {
        debug!("🔄 Executing: {} {} (context: {})", command, args.join(" "), context);
        
        let shell = self.app_handle.shell();
        let output = shell
            .command(command)
            .args(args)
            .output()
            .await
            .with_operation_context("execute", &format!("{} command", command))?;
        
        let result = CommandResult {
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            success: output.status.success(),
            exit_code: output.status.code(),
        };
        
        if result.success {
            debug!("✅ Command succeeded: {} (context: {})", command, context);
        } else {
            warn!("❌ Command failed: {} (context: {}), stderr: {}", command, context, result.stderr);
        }
        
        Ok(result)
    }
    
    /// Execute a command with timeout
    pub async fn execute_with_timeout(
        &self,
        command: &str,
        args: &[&str],
        timeout_secs: u64,
        context: &str,
    ) -> Result<CommandResult, String> {
        debug!("🔄 Executing with {}s timeout: {} {} (context: {})", 
                   timeout_secs, command, args.join(" "), context);
        
        // For now, use the regular execute_command with a note about timeout
        // TODO: Implement proper timeout when tauri shell plugin supports it
        warn!("Timeout requested but using regular execution (timeout not yet supported)");
        self.execute_command(command, args, context).await
    }
    
    /// Execute a command and return only stdout on success, error on failure
    pub async fn execute_for_output(
        &self,
        command: &str,
        args: &[&str],
        context: &str,
    ) -> Result<String, String> {
        let result = self.execute_command(command, args, context).await?;
        
        if result.success {
            Ok(result.stdout)
        } else {
            Err(result.error_message().unwrap_or_else(|| "Unknown error".to_string()))
        }
    }
    
    /// Execute a command with automatic tool validation
    pub async fn execute_tool_command(
        &self,
        tool_name: &str,
        args: &[&str],
        context: &str,
    ) -> Result<CommandResult, String> {
        match self.execute_command(tool_name, args, context).await {
            Ok(result) => Ok(result),
            Err(e) => {
                // Check if it's a "command not found" error
                if e.contains("not found") || e.contains("No such file") {
                    Err(format!("⚙️ {} not found. Please ensure it's installed and in your PATH.", tool_name))
                } else {
                    Err(e)
                }
            }
        }
    }
    
    /// Execute ADB command with device validation
    pub async fn execute_adb_command(
        &self,
        device_id: Option<&str>,
        adb_args: &[&str],
        context: &str,
    ) -> Result<CommandResult, String> {
        let mut args = Vec::new();
        
        // Add device specification if provided
        if let Some(device) = device_id {
            args.extend_from_slice(&["-s", device]);
        }
        args.extend_from_slice(adb_args);
        
        self.execute_tool_command("adb", &args, context).await
    }
    
    /// Execute iOS tool command with device ID
    pub async fn execute_ios_command(
        &self,
        tool_name: &str,
        device_id: Option<&str>,
        tool_args: &[&str],
        context: &str,
    ) -> Result<CommandResult, String> {
        let mut args = Vec::new();
        
        // Add device ID for tools that support it
        if let Some(device) = device_id {
            if matches!(tool_name, "ideviceinstaller" | "afcclient" | "ideviceinfo") {
                args.extend_from_slice(&["-u", device]);
            }
        }
        args.extend_from_slice(tool_args);
        
        // Use the iOS tool path resolution to get the correct path (bundled or system)
        let tool_path = crate::commands::device::ios::tools::get_tool_command_legacy(tool_name);
        debug!("🍎 Resolved iOS tool path: {} -> {}", tool_name, tool_path);
        
        self.execute_tool_command(&tool_path, &args, context).await
    }
    
    /// Execute simulator command (xcrun simctl)
    pub async fn execute_simctl_command(
        &self,
        simctl_args: &[&str],
        context: &str,
    ) -> Result<CommandResult, String> {
        let mut args = vec!["simctl"];
        args.extend_from_slice(simctl_args);
        
        self.execute_tool_command("xcrun", &args, context).await
    }
}

/// Convenience functions for common command patterns
impl ShellExecutor {
    /// Check if a tool is available
    pub async fn is_tool_available(&self, tool_name: &str) -> bool {
        match self.execute_command(tool_name, &["--version"], "tool check").await {
            Ok(result) => result.success,
            Err(_) => {
                // Try alternative check methods
                match tool_name {
                    "adb" => self.execute_command("adb", &["version"], "adb version check").await
                        .map(|r| r.success).unwrap_or(false),
                    "xcrun" => self.execute_command("xcrun", &["--version"], "xcrun check").await
                        .map(|r| r.success).unwrap_or(false),
                    _ => false,
                }
            }
        }
    }
    
    /// Get tool version information
    pub async fn get_tool_version(&self, tool_name: &str) -> Result<String, String> {
        let result = self.execute_command(tool_name, &["--version"], "version check").await?;
        
        if result.success {
            Ok(result.stdout.lines().next().unwrap_or("Unknown version").to_string())
        } else {
            Err(format!("Failed to get version for {}", tool_name))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_command_result_creation() {
        let success = CommandResult::success("output".to_string());
        assert!(success.is_success());
        assert_eq!(success.output(), "output");
        assert!(success.error_message().is_none());
        
        let failure = CommandResult::failure("error".to_string(), Some(1));
        assert!(!failure.is_success());
        assert_eq!(failure.output(), "error");
        assert!(failure.error_message().is_some());
    }
    
    #[test]
    fn test_command_result_output_priority() {
        let mut result = CommandResult::success("stdout".to_string());
        result.stderr = "stderr".to_string();
        assert_eq!(result.output(), "stdout"); // Should prefer stdout
        
        let failure = CommandResult::failure("stderr".to_string(), Some(1));
        assert_eq!(failure.output(), "stderr"); // Should use stderr when no stdout
    }
} 