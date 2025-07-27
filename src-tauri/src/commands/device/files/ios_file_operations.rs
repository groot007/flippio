//! iOS File Operations Abstraction
//! 
//! This module provides a unified interface for iOS file operations using afcclient,
//! abstracting away the complexity of command execution and error handling.

use crate::commands::device::types::{DeviceResponse, DatabaseFile};
use crate::commands::device::execution::{DeviceToolExecutor};
use tauri::{Manager};
use log::{info, warn, error, debug};
use serde::{Serialize, Deserialize};
use std::path::Path;

/// Unified iOS file operations manager
pub struct IOSFileManager {
    tool_executor: DeviceToolExecutor,
}

/// iOS file operation configuration
#[derive(Debug, Clone)]
pub struct FileOperationConfig {
    pub device_id: String,
    pub package_name: String,
    pub timeout_seconds: u64,
    pub retry_count: u8,
}

impl Default for FileOperationConfig {
    fn default() -> Self {
        Self {
            device_id: String::new(),
            package_name: String::new(),
            timeout_seconds: 45, // iOS operations can be slow
            retry_count: 2,
        }
    }
}

impl IOSFileManager {
    /// Create a new iOS file manager
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        Self {
            tool_executor: DeviceToolExecutor::new(app_handle),
        }
    }
    
    /// List files in the Documents directory of an iOS app
    pub async fn list_documents_files(&self, config: &FileOperationConfig) -> DeviceResponse<Vec<String>> {
        info!("📂 Listing files in Documents directory for {} on {}", config.package_name, config.device_id);
        
        let args = [
            "--documents", &config.package_name,
            "-u", &config.device_id,
            "ls", "Documents"
        ];
        
        let result = self.tool_executor.execute_ios_tool("afcclient", &args, 
                                                        &format!("list Documents for {}", config.package_name)).await;
        
        match result {
            DeviceResponse { success: true, data: Some(command_result), .. } => {
                let files = self.parse_file_list(&command_result.stdout);
                DeviceResponse::success(files)
            }
            error_response => error_response.map_data(|_| Vec::new()),
        }
    }
    
    /// Check if a file exists on the iOS device
    pub async fn file_exists(&self, config: &FileOperationConfig, remote_path: &str) -> DeviceResponse<bool> {
        debug!("🔍 Checking if file exists: {} on {}", remote_path, config.device_id);
        
        let args = [
            "--documents", &config.package_name,
            "-u", &config.device_id,
            "stat", remote_path
        ];
        
        let result = self.tool_executor.execute_ios_tool("afcclient", &args, 
                                                        &format!("check file {} exists", remote_path)).await;
        
        match result {
            DeviceResponse { success: true, .. } => DeviceResponse::success(true),
            _ => DeviceResponse::success(false), // File doesn't exist or other error
        }
    }
    
    /// Remove a file from the iOS device
    pub async fn remove_file(&self, config: &FileOperationConfig, remote_path: &str) -> DeviceResponse<()> {
        warn!("🗑️ Removing file: {} from {}", remote_path, config.device_id);
        
        let args = [
            "--documents", &config.package_name,
            "-u", &config.device_id,
            "rm", remote_path
        ];
        
        let result = self.tool_executor.execute_ios_tool("afcclient", &args, 
                                                        &format!("remove file {}", remote_path)).await;
        
        match result {
            DeviceResponse { success: true, .. } => {
                warn!("✅ Successfully removed file: {}", remote_path);
                DeviceResponse::success(())
            }
            DeviceResponse { success: false, error, .. } => {
                error!("❌ Failed to remove file {}: {:?}", remote_path, error);
                DeviceResponse::error(&format!("Failed to remove file: {:?}", error.unwrap_or_default()))
            }
        }
    }
    
    /// Push a file to the iOS device
    pub async fn push_file(&self, config: &FileOperationConfig, local_path: &str, remote_path: &str) -> DeviceResponse<()> {
        warn!("📤 Pushing file: {} -> {} on {}", local_path, remote_path, config.device_id);
        
        let args = [
            "--documents", &config.package_name,
            "-u", &config.device_id,
            "put", local_path, remote_path
        ];
        
        let result = self.tool_executor.execute_ios_tool("afcclient", &args, 
                                                        &format!("push file {} to {}", local_path, remote_path)).await;
        
        match result {
            DeviceResponse { success: true, .. } => {
                warn!("✅ Successfully pushed file to: {}", remote_path);
                DeviceResponse::success(())
            }
            DeviceResponse { success: false, error, .. } => {
                error!("❌ Failed to push file to {}: {:?}", remote_path, error);
                DeviceResponse::error(&format!("Failed to push file: {:?}", error.unwrap_or_default()))
            }
        }
    }
    
    /// Pull a file from the iOS device
    pub async fn pull_file(&self, config: &FileOperationConfig, remote_path: &str, local_path: &str) -> DeviceResponse<()> {
        warn!("📥 Pulling file: {} -> {} from {}", remote_path, local_path, config.device_id);
        
        let args = [
            "--documents", &config.package_name,
            "-u", &config.device_id,
            "get", remote_path, local_path
        ];
        
        let result = self.tool_executor.execute_ios_tool("afcclient", &args, 
                                                        &format!("pull file {} to {}", remote_path, local_path)).await;
        
        match result {
            DeviceResponse { success: true, .. } => {
                warn!("✅ Successfully pulled file to: {}", local_path);
                DeviceResponse::success(())
            }
            DeviceResponse { success: false, error, .. } => {
                error!("❌ Failed to pull file from {}: {:?}", remote_path, error);
                DeviceResponse::error(&format!("Failed to pull file: {:?}", error.unwrap_or_default()))
            }
        }
    }
    
    /// Verify file was successfully transferred by checking its existence
    pub async fn verify_file_transfer(&self, config: &FileOperationConfig, remote_path: &str) -> DeviceResponse<bool> {
        debug!("✅ Verifying file transfer: {} on {}", remote_path, config.device_id);
        
        // Use file_exists to verify the transfer
        self.file_exists(config, remote_path).await
    }
    
    /// Parse file list output from afcclient
    fn parse_file_list(&self, output: &str) -> Vec<String> {
        parse_file_list_impl(output)
    }
    
    /// Create database file metadata
    pub fn create_database_files(&self, files: &[String], config: &FileOperationConfig, location: &str) -> Vec<DatabaseFile> {
        create_database_files_impl(files, config, location)
    }
}

/// Standalone parsing functions for testability
fn parse_file_list_impl(output: &str) -> Vec<String> {
    output
        .lines()
        .map(|line| line.trim().to_string())
        .filter(|filename| {
            filename.ends_with(".db") || 
            filename.ends_with(".sqlite") || 
            filename.ends_with(".sqlite3")
        })
        .collect()
}

fn create_database_files_impl(files: &[String], config: &FileOperationConfig, location: &str) -> Vec<DatabaseFile> {
    files
        .iter()
        .map(|filename| DatabaseFile {
            filename: filename.clone(),
            path: format!("/Documents/{}", filename),
            package_name: config.package_name.clone(),
            device_type: "ios".to_string(),
            location: location.to_string(),
            remote_path: Some(format!("Documents/{}", filename)),
        })
        .collect()
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
    fn test_file_operation_config_default() {
        let config = FileOperationConfig::default();
        assert_eq!(config.device_id, "");
        assert_eq!(config.package_name, "");
        assert_eq!(config.timeout_seconds, 45);
        assert_eq!(config.retry_count, 2);
    }
    
    #[test]
    fn test_parse_file_list() {
        let output = "file1.txt\ntest.db\nanother.sqlite\ndata.sqlite3\nnotdb.log";
        
        let files = parse_file_list_impl(output);
        assert_eq!(files.len(), 3);
        assert!(files.contains(&"test.db".to_string()));
        assert!(files.contains(&"another.sqlite".to_string()));
        assert!(files.contains(&"data.sqlite3".to_string()));
    }
    
    #[test]
    fn test_create_database_files() {
        let files = vec!["test.db".to_string(), "data.sqlite".to_string()];
        let config = FileOperationConfig {
            device_id: "test-device".to_string(),
            package_name: "com.example.app".to_string(),
            ..Default::default()
        };
        
        let db_files = create_database_files_impl(&files, &config, "Documents");
        assert_eq!(db_files.len(), 2);
        assert_eq!(db_files[0].filename, "test.db");
        assert_eq!(db_files[0].package_name, "com.example.app");
        assert_eq!(db_files[0].device_type, "ios");
    }
} 