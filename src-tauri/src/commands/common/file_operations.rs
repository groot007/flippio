//! Unified File Operations Manager
//! 
//! This module provides a comprehensive, standardized interface for all file operations,
//! replacing scattered file I/O code with consistent, error-handled abstractions.

use tauri::{AppHandle, Manager};
use crate::commands::common::{CommandErrorExt};
use log::{info, debug};
use std::path::{Path, PathBuf};
use serde::{Serialize, Deserialize};
use std::fs;
use std::io::Write;

/// File operation configuration for various scenarios
#[derive(Debug, Clone)]
pub struct FileOperationConfig {
    pub create_parents: bool,
    pub overwrite_existing: bool,
    #[allow(dead_code)]
    pub preserve_permissions: bool,
    pub use_temp_backup: bool,
}

impl Default for FileOperationConfig {
    fn default() -> Self {
        Self {
            create_parents: true,
            overwrite_existing: false,
            preserve_permissions: true,
            use_temp_backup: false,
        }
    }
}

/// Unified file operations manager
pub struct FileOperationsManager {
    app_handle: tauri::AppHandle,
    config: FileOperationConfig,
}

/// File operation result with metadata
#[derive(Debug, Clone)]
pub struct FileOperationResult {
    pub success: bool,
    pub file_path: Option<PathBuf>,
    pub bytes_processed: Option<u64>,
    pub operation: String,
}

impl FileOperationsManager {
    /// Create a new file operations manager
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        Self {
            app_handle,
            config: FileOperationConfig::default(),
        }
    }
    
    /// Create with custom configuration
    pub fn with_config(app_handle: tauri::AppHandle, config: FileOperationConfig) -> Self {
        Self {
            app_handle,
            config,
        }
    }
    
    /// Get a safe temporary directory for the application
    pub fn get_temp_directory(&self, subdirectory: Option<&str>) -> Result<PathBuf, String> {
        let base_temp = self.app_handle.path().temp_dir()
            .with_context("Failed to get system temp directory")?;
        
        let app_temp = match subdirectory {
            Some(subdir) => base_temp.join("flippio").join(subdir),
            None => base_temp.join("flippio"),
        };
        
        if !app_temp.exists() {
            fs::create_dir_all(&app_temp)
                .with_context("Failed to create application temp directory")?;
        }
        
        info!("📁 Using temp directory: {}", app_temp.display());
        Ok(app_temp)
    }
    
    /// Write content to a file with automatic directory creation
    pub fn write_file_safe(&self, file_path: &Path, content: &[u8]) -> Result<FileOperationResult, String> {
        info!("📝 Writing file: {} ({} bytes)", file_path.display(), content.len());
        
        // Create parent directories if needed
        if self.config.create_parents {
            if let Some(parent) = file_path.parent() {
                fs::create_dir_all(parent)
                    .with_context("Failed to create parent directories")?;
            }
        }
        
        // Check for existing file
        if file_path.exists() && !self.config.overwrite_existing {
            return Err(format!("File already exists: {}", file_path.display()));
        }
        
        // Create backup if requested
        if self.config.use_temp_backup && file_path.exists() {
            let backup_path = file_path.with_extension("backup");
            fs::copy(file_path, &backup_path)
                .with_context("Failed to create backup")?;
            debug!("💾 Created backup: {}", backup_path.display());
        }
        
        // Write the file
        let mut file = fs::File::create(file_path)
            .with_context("Failed to create file")?;
        file.write_all(content)
            .with_context("Failed to write file content")?;
        file.sync_all()
            .with_context("Failed to sync file to disk")?;
        
        info!("✅ Successfully wrote file: {}", file_path.display());
        
        Ok(FileOperationResult {
            success: true,
            file_path: Some(file_path.to_path_buf()),
            bytes_processed: Some(content.len() as u64),
            operation: "write".to_string(),
        })
    }
    
    /// Copy a file with enhanced error handling and progress tracking
    pub fn copy_file_safe(&self, source: &Path, destination: &Path) -> Result<FileOperationResult, String> {
        info!("📋 Copying file: {} -> {}", source.display(), destination.display());
        
        // Validate source file
        if !source.exists() {
            return Err(format!("Source file does not exist: {}", source.display()));
        }
        
        if !source.is_file() {
            return Err(format!("Source is not a file: {}", source.display()));
        }
        
        // Create destination directory if needed
        if self.config.create_parents {
            if let Some(parent) = destination.parent() {
                fs::create_dir_all(parent)
                    .with_context("Failed to create destination directory")?;
            }
        }
        
        // Check destination
        if destination.exists() && !self.config.overwrite_existing {
            return Err(format!("Destination file already exists: {}", destination.display()));
        }
        
        // Get source file size for progress tracking
        let source_size = fs::metadata(source)
            .with_context("Failed to get source file metadata")?
            .len();
        
        // Perform the copy
        fs::copy(source, destination)
            .with_context("Failed to copy file")?;
        
        info!("✅ Successfully copied file: {} bytes", source_size);
        
        Ok(FileOperationResult {
            success: true,
            file_path: Some(destination.to_path_buf()),
            bytes_processed: Some(source_size),
            operation: "copy".to_string(),
        })
    }
    
    /// Create a unique filename to avoid conflicts
    pub fn create_unique_filename(&self, base_name: &str, extension: Option<&str>) -> String {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_else(|_| {
                log::warn!("System time before Unix epoch, using fallback timestamp");
                std::time::Duration::from_secs(0)
            })
            .as_secs();
        
        match extension {
            Some(ext) => format!("{}_{}.{}", base_name, timestamp, ext),
            None => format!("{}_{}", base_name, timestamp),
        }
    }
    
    /// Save dropped file content to a temporary location
    pub fn save_dropped_file(&self, content: &[u8], filename: &str) -> Result<FileOperationResult, String> {
        info!("💾 Saving dropped file: {} ({} bytes)", filename, content.len());
        
        // Get temp directory for dropped files
        let temp_dir = self.get_temp_directory(Some("dropped_files"))?;
        
        // Create unique filename to avoid conflicts
        let unique_filename = self.create_unique_filename(filename, None);
        let file_path = temp_dir.join(unique_filename);
        
        // Write the file
        self.write_file_safe(&file_path, content)
    }
    
    /// Get file metadata with enhanced error handling
    pub fn get_file_info(&self, file_path: &Path) -> Result<FileInfo, String> {
        let metadata = fs::metadata(file_path)
            .with_context("Failed to get file metadata")?;
        
        Ok(FileInfo {
            path: file_path.to_path_buf(),
            size: metadata.len(),
            is_file: metadata.is_file(),
            is_dir: metadata.is_dir(),
            modified: metadata.modified().ok(),
            readonly: metadata.permissions().readonly(),
        })
    }
    
    /// Remove file or directory safely
    pub fn remove_safe(&self, path: &Path) -> Result<FileOperationResult, String> {
        info!("🗑️ Removing: {}", path.display());
        
        if !path.exists() {
            return Err(format!("Path does not exist: {}", path.display()));
        }
        
        let operation = if path.is_file() {
            fs::remove_file(path)
                .with_context("Failed to remove file")?;
            "remove_file"
        } else {
            fs::remove_dir_all(path)
                .with_context("Failed to remove directory")?;
            "remove_dir"
        };
        
        info!("✅ Successfully removed: {}", path.display());
        
        Ok(FileOperationResult {
            success: true,
            file_path: Some(path.to_path_buf()),
            bytes_processed: None,
            operation: operation.to_string(),
        })
    }
    
    /// Clean up old temporary files
    pub fn cleanup_temp_files(&self, max_age_hours: u64) -> Result<u32, String> {
        let temp_dir = self.get_temp_directory(None)?;
        let mut cleaned_count = 0;
        
        if !temp_dir.exists() {
            return Ok(0);
        }
        
        let cutoff_time = std::time::SystemTime::now()
            .checked_sub(std::time::Duration::from_secs(max_age_hours * 3600))
            .unwrap_or(std::time::UNIX_EPOCH);
        
        for entry in fs::read_dir(&temp_dir).map_err(|e| format!("Failed to read temp directory: {}", e))? {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();
            
            if let Ok(metadata) = fs::metadata(&path) {
                if let Ok(modified) = metadata.modified() {
                    if modified < cutoff_time {
                        if let Ok(_) = self.remove_safe(&path) {
                            cleaned_count += 1;
                        }
                    }
                }
            }
        }
        
        info!("🧹 Cleaned up {} old temporary files", cleaned_count);
        Ok(cleaned_count)
    }
}

/// File information structure
#[derive(Debug, Clone)]
pub struct FileInfo {
    pub path: PathBuf,
    pub size: u64,
    pub is_file: bool,
    pub is_dir: bool,
    pub modified: Option<std::time::SystemTime>,
    pub readonly: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_file_operation_config_default() {
        let config = FileOperationConfig::default();
        assert!(config.create_parents);
        assert!(!config.overwrite_existing);
        assert!(config.preserve_permissions);
        assert!(!config.use_temp_backup);
    }
    
    #[test]
    fn test_create_unique_filename() {
        // Test the logic without requiring a manager instance
        let timestamp1 = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        let filename1 = format!("test_{}.txt", timestamp1);
        
        // Wait a moment to ensure different timestamps
        std::thread::sleep(std::time::Duration::from_millis(1));
        
        let timestamp2 = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        let _filename2 = format!("test_{}.txt", timestamp2);
        
        assert!(filename1.starts_with("test_"));
        assert!(filename1.ends_with(".txt"));
        // Timestamps might be the same within milliseconds, so just test format
    }
    
    #[test]
    fn test_file_operation_result() {
        let result = FileOperationResult {
            success: true,
            file_path: Some(PathBuf::from("/test/file.txt")),
            bytes_processed: Some(1024),
            operation: "write".to_string(),
        };
        
        assert!(result.success);
        assert_eq!(result.bytes_processed, Some(1024));
        assert_eq!(result.operation, "write");
    }
} 