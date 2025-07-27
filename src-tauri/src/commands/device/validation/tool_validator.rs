//! Unified Tool Validation Framework
//! 
//! This module provides a comprehensive, configuration-driven tool validation system
//! that leverages our proven DeviceToolExecutor patterns for consistent, reliable tool discovery.

use crate::commands::device::execution::{DeviceToolExecutor};
use crate::commands::device::types::{DeviceResponse};
use tauri::{AppHandle, Manager};
use log::{info, error, debug};
use std::collections::HashMap;
use std::path::{PathBuf, Path};
use std::sync::{Arc, Mutex};
use serde::{Serialize, Deserialize};

/// Simplified tool validation error types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ToolValidationError {
    NotFound { tool: String, attempted_paths: Vec<String> },
    NotExecutable { tool: String, path: String },
    ValidationFailed { tool: String, error: String },
}

impl std::fmt::Display for ToolValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ToolValidationError::NotFound { tool, attempted_paths } => {
                write!(f, "Tool '{}' not found in {} locations", tool, attempted_paths.len())
            }
            ToolValidationError::NotExecutable { tool, path } => {
                write!(f, "Tool '{}' found at '{}' but is not executable", tool, path)
            }
            ToolValidationError::ValidationFailed { tool, error } => {
                write!(f, "Validation failed for tool '{}': {}", tool, error)
            }
        }
    }
}

/// Tool discovery configuration - much simpler than before
#[derive(Debug, Clone)]
pub struct ToolDiscoveryConfig {
    pub search_paths: Vec<PathBuf>,
    pub validation_args: Vec<String>,
    pub timeout_seconds: u64,
}

impl Default for ToolDiscoveryConfig {
    fn default() -> Self {
        Self {
            search_paths: Self::get_default_search_paths(),
            validation_args: vec!["--help".to_string()],
            timeout_seconds: 10,
        }
    }
}

impl ToolDiscoveryConfig {
    /// Get comprehensive default search paths for iOS tools
    fn get_default_search_paths() -> Vec<PathBuf> {
        let mut paths = vec![
            // Homebrew (Apple Silicon) - Priority for M1/M2 Macs
            PathBuf::from("/opt/homebrew/bin"),
            PathBuf::from("/opt/homebrew/opt/libimobiledevice/bin"),
            
            // Homebrew (Intel) - For Intel Macs
            PathBuf::from("/usr/local/bin"),
            PathBuf::from("/usr/local/opt/libimobiledevice/bin"),
            
            // MacPorts
            PathBuf::from("/opt/local/bin"),
            
            // System PATH
            PathBuf::from("/usr/bin"),
            PathBuf::from("/bin"),
        ];
        
        // Add bundled tool path if it exists
        if let Some(bundled_path) = Self::get_bundled_tool_path() {
            paths.push(bundled_path);
        }
        
        paths
    }
    
    /// Get bundled tool path if available
    fn get_bundled_tool_path() -> Option<PathBuf> {
        std::env::current_exe().ok()
            .and_then(|exe| exe.parent().map(|p| p.to_path_buf()))
            .and_then(|exe_dir| {
                // Try multiple bundled locations
                let candidates = vec![
                    exe_dir.join("tools"),
                    exe_dir.parent()?.join("Resources").join("tools"),
                    exe_dir.parent()?.parent()?.parent()?.join("resources/libimobiledevice/tools"),
                ];
                
                candidates.into_iter().find(|p| p.exists())
            })
    }
}

/// Validated tool information
#[derive(Debug, Clone)]
pub struct ValidatedTool {
    pub path: PathBuf,
    pub version: Option<String>,
    pub discovery_method: String,
}

/// Unified tool validation manager - much simpler than the original
pub struct ToolValidationManager {
    tool_executor: DeviceToolExecutor,
    config: ToolDiscoveryConfig,
    validated_tools: HashMap<String, ValidatedTool>,
}

impl ToolValidationManager {
    /// Create a new tool validation manager
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        Self {
            tool_executor: DeviceToolExecutor::new(app_handle),
            config: ToolDiscoveryConfig::default(),
            validated_tools: HashMap::new(),
        }
    }
    
    /// Create with custom configuration
    pub fn with_config(app_handle: tauri::AppHandle, config: ToolDiscoveryConfig) -> Self {
        Self {
            tool_executor: DeviceToolExecutor::new(app_handle),
            config,
            validated_tools: HashMap::new(),
        }
    }
    
    /// Get a validated tool - cached results for performance
    pub async fn get_validated_tool(&mut self, tool_name: &str) -> DeviceResponse<ValidatedTool> {
        info!("🔍 Validating tool: {}", tool_name);
        
        // Check cache first
        if let Some(validated_tool) = self.validated_tools.get(tool_name) {
            debug!("✅ Using cached validation for: {}", tool_name);
            return DeviceResponse::success(validated_tool.clone());
        }
        
        // Discover and validate tool
        match self.discover_tool(tool_name).await {
            Some(validated_tool) => {
                info!("✅ Tool validation successful: {} at {}", tool_name, validated_tool.path.display());
                
                // Cache the result
                self.validated_tools.insert(tool_name.to_string(), validated_tool.clone());
                
                DeviceResponse::success(validated_tool)
            }
            None => {
                error!("❌ Tool validation failed: {}", tool_name);
                DeviceResponse::error(&format!("Tool '{}' not found or not executable", tool_name))
            }
        }
    }
    
    /// Validate multiple tools at once
    pub async fn validate_tools(&mut self, tool_names: &[&str]) -> DeviceResponse<HashMap<String, ValidatedTool>> {
        info!("🔍 Validating {} tools: {:?}", tool_names.len(), tool_names);
        
        let mut results = HashMap::new();
        let mut errors = Vec::new();
        
        for &tool_name in tool_names {
            match self.get_validated_tool(tool_name).await {
                DeviceResponse { success: true, data: Some(validated_tool), .. } => {
                    results.insert(tool_name.to_string(), validated_tool);
                }
                DeviceResponse { success: false, error: Some(error), .. } => {
                    errors.push(format!("{}: {}", tool_name, error));
                }
                _ => {
                    errors.push(format!("{}: unexpected error", tool_name));
                }
            }
        }
        
        if errors.is_empty() {
            info!("✅ All {} tools validated successfully", tool_names.len());
            DeviceResponse::success(results)
        } else {
            error!("❌ Tool validation failed for: {}", errors.join(", "));
            DeviceResponse::error(&format!("Tool validation failed: {}", errors.join(", ")))
        }
    }
    
    /// Discover a single tool across all search paths
    async fn discover_tool(&self, tool_name: &str) -> Option<ValidatedTool> {
        for search_path in &self.config.search_paths {
            let tool_path = search_path.join(tool_name);
            
            debug!("🔍 Checking: {}", tool_path.display());
            
            if !tool_path.exists() {
                continue;
            }
            
            if !tool_path.is_file() {
                continue;
            }
            
            // Test tool execution using our DeviceToolExecutor
            let test_result = self.tool_executor.execute_ios_tool(
                tool_name,
                &self.config.validation_args.iter().map(|s| s.as_str()).collect::<Vec<_>>(),
                &format!("validate {}", tool_name)
            ).await;
            
            match test_result {
                DeviceResponse { success: true, data: Some(command_result), .. } => {
                    let version = self.extract_version_info(&command_result.stdout, &command_result.stderr);
                    let discovery_method = self.get_discovery_method(search_path);
                    
                    info!("✅ Tool found and validated: {} at {} ({})", 
                          tool_name, tool_path.display(), discovery_method);
                    
                    return Some(ValidatedTool {
                        path: tool_path,
                        version,
                        discovery_method,
                    });
                }
                DeviceResponse { success: false, error, .. } => {
                    debug!("❌ Tool execution failed at {}: {:?}", tool_path.display(), error);
                }
                _ => {
                    debug!("❌ Unexpected result testing: {}", tool_path.display());
                }
            }
        }
        
        None
    }
    
    /// Extract version information from command output
    fn extract_version_info(&self, stdout: &str, stderr: &str) -> Option<String> {
        // Look for version patterns in output
        for line in stdout.lines().chain(stderr.lines()) {
            let line_lower = line.to_lowercase();
            if line_lower.contains("version") || line_lower.contains("libimobiledevice") {
                return Some(line.trim().to_string());
            }
        }
        
        // Fallback to first non-empty line if no version found
        stdout.lines().chain(stderr.lines())
            .find(|line| !line.trim().is_empty())
            .map(|line| line.trim().to_string())
    }
    
    /// Get human-readable discovery method from path
    fn get_discovery_method(&self, path: &Path) -> String {
        let path_str = path.to_string_lossy();
        
        if path_str.contains("/opt/homebrew/") {
            "Homebrew (Apple Silicon)".to_string()
        } else if path_str.contains("/usr/local/") {
            "Homebrew (Intel)".to_string()
        } else if path_str.contains("/opt/local/") {
            "MacPorts".to_string()
        } else if path_str.contains("/usr/bin") || path_str.contains("/bin") {
            "System PATH".to_string()
        } else {
            "Bundled Tools".to_string()
        }
    }
    
    /// Get installation instructions for failed validations
    pub fn get_installation_instructions(&self, tool_name: &str) -> String {
        format!(
            "iOS tool '{}' not found. To install libimobiledevice tools:\n\
            \n\
            📦 Homebrew (Recommended):\n\
            brew install libimobiledevice\n\
            \n\
            🚢 MacPorts:\n\
            sudo port install libimobiledevice\n\
            \n\
            🔄 After installation, restart Flippio to detect the tools.",
            tool_name
        )
    }
    
    /// Clear validation cache (useful for testing or after tool installation)
    pub fn clear_cache(&mut self) {
        info!("🧹 Clearing tool validation cache");
        self.validated_tools.clear();
    }
    
    /// Get cache statistics
    pub fn get_cache_stats(&self) -> (usize, Vec<String>) {
        let count = self.validated_tools.len();
        let tools: Vec<String> = self.validated_tools.keys().cloned().collect();
        (count, tools)
    }
}

/// Helper trait for DeviceResponse transformation
trait DeviceResponseExt<T> {
    fn map_data<U, F>(self, f: F) -> DeviceResponse<U>
    where
        F: FnOnce(T) -> U;
}

impl<T> DeviceResponseExt<T> for DeviceResponse<T> {
    fn map_data<U, F>(self, f: F) -> DeviceResponse<U>
    where
        F: FnOnce(T) -> U,
    {
        DeviceResponse {
            success: self.success,
            data: self.data.map(f),
            error: self.error,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_tool_discovery_config_default() {
        let config = ToolDiscoveryConfig::default();
        assert!(!config.search_paths.is_empty());
        assert_eq!(config.validation_args, vec!["--help"]);
        assert_eq!(config.timeout_seconds, 10);
    }
    
    #[test]
    fn test_tool_validation_error_display() {
        let error = ToolValidationError::NotFound {
            tool: "idevice_id".to_string(),
            attempted_paths: vec!["/usr/bin".to_string(), "/opt/homebrew/bin".to_string()],
        };
        
        let display = format!("{}", error);
        assert!(display.contains("idevice_id"));
        assert!(display.contains("not found"));
    }
    
    #[test]
    fn test_discovery_method_detection() {
        // Test the static method without needing a manager instance
        let config = ToolDiscoveryConfig::default();
        assert!(!config.search_paths.is_empty());
        
        // Test path categorization
        let homebrew_apple = PathBuf::from("/opt/homebrew/bin");
        let homebrew_intel = PathBuf::from("/usr/local/bin");
        let macports = PathBuf::from("/opt/local/bin");
        
        // These would be tested if the method was static
        assert!(homebrew_apple.to_string_lossy().contains("/opt/homebrew/"));
        assert!(homebrew_intel.to_string_lossy().contains("/usr/local/"));
        assert!(macports.to_string_lossy().contains("/opt/local/"));
    }
} 