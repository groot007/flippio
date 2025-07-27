//! Unified Dialog Manager
//! 
//! This module provides a comprehensive interface for all dialog operations,
//! standardizing dialog configuration, error handling, and result processing.

use crate::commands::common::file_operations::{FileOperationsManager};
use tauri::{AppHandle};
use serde::{Serialize, Deserialize};
use log::{info, warn, error, debug};
use std::path::{Path, PathBuf};
use tauri_plugin_dialog::DialogExt;
use tokio::sync::oneshot;

/// Dialog configuration for different types of dialogs
#[derive(Debug, Clone)]
pub struct DialogConfig {
    pub title: Option<String>,
    pub default_path: Option<String>,
    pub filters: Vec<DialogFilter>,
    pub multiple_selection: bool,
}

impl Default for DialogConfig {
    fn default() -> Self {
        Self {
            title: None,
            default_path: None,
            filters: vec![
                DialogFilter {
                    name: "Database Files".to_string(),
                    extensions: vec!["db".to_string(), "sqlite".to_string(), "sqlite3".to_string(), "db3".to_string()],
                },
                DialogFilter {
                    name: "All Files".to_string(),
                    extensions: vec!["*".to_string()],
                },
            ],
            multiple_selection: false,
        }
    }
}

/// Dialog filter for file types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialogFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

/// Standardized dialog result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialogResult {
    pub success: bool,
    pub canceled: bool,
    pub file_paths: Option<Vec<String>>,
    pub file_path: Option<String>,
    pub error: Option<String>,
}

/// Dialog operations for saving files
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveDialogOptions {
    pub source_file_path: String,
    pub default_filename: Option<String>,
    pub filters: Option<Vec<DialogFilter>>,
}

/// Unified dialog manager
pub struct DialogManager {
    app_handle: tauri::AppHandle,
    file_manager: FileOperationsManager,
    config: DialogConfig,
}

impl DialogManager {
    /// Create a new dialog manager
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        let file_manager = FileOperationsManager::new(app_handle.clone());
        
        Self {
            app_handle,
            file_manager,
            config: DialogConfig::default(),
        }
    }
    
    /// Create with custom configuration
    pub fn with_config(app_handle: tauri::AppHandle, config: DialogConfig) -> Self {
        let file_manager = FileOperationsManager::new(app_handle.clone());
        
        Self {
            app_handle,
            file_manager,
            config,
        }
    }
    
    /// Show a file selection dialog
    pub async fn select_file(&self, config: Option<DialogConfig>) -> DialogResult {
        let dialog_config = config.unwrap_or_else(|| self.config.clone());
        
        info!("📂 Opening file selection dialog");
        debug!("Dialog config: {:?}", dialog_config);
        
        let (tx, rx) = oneshot::channel();
        
        let mut dialog = self.app_handle.dialog().file();
        
        // Configure title
        if let Some(title) = &dialog_config.title {
            dialog = dialog.set_title(title);
        }
        
        // Configure default path
        if let Some(default_path) = &dialog_config.default_path {
            dialog = dialog.set_directory(default_path);
        }
        
        // Configure filters
        for filter in &dialog_config.filters {
            let extensions: Vec<&str> = filter.extensions.iter().map(|s| s.as_str()).collect();
            dialog = dialog.add_filter(&filter.name, &extensions);
        }
        
        // Handle multiple vs single selection
        if dialog_config.multiple_selection {
            dialog.pick_files(move |file_paths| {
                let _ = tx.send(file_paths);
            });
        } else {
            dialog.pick_file(move |file_path| {
                let _ = tx.send(file_path.map(|p| vec![p]));
            });
        }
        
        // Wait for user selection
        match rx.await {
            Ok(Some(paths)) => {
                let path_strings: Vec<String> = paths.iter().map(|p| p.to_string()).collect();
                info!("✅ User selected {} file(s)", path_strings.len());
                
                DialogResult {
                    success: true,
                    canceled: false,
                    file_paths: Some(path_strings.clone()),
                    file_path: path_strings.first().cloned(),
                    error: None,
                }
            }
            Ok(None) | Err(_) => {
                info!("❌ User canceled file selection");
                DialogResult {
                    success: false,
                    canceled: true,
                    file_paths: None,
                    file_path: None,
                    error: None,
                }
            }
        }
    }
    
    /// Show a file save dialog and handle the file copy operation
    pub async fn save_file(&self, options: SaveDialogOptions) -> DialogResult {
        info!("💾 Opening file save dialog for: {}", options.source_file_path);
        
        let (tx, rx) = oneshot::channel();
        
        let mut dialog = self.app_handle.dialog().file();
        
        // Configure default filename
        if let Some(filename) = &options.default_filename {
            dialog = dialog.set_file_name(filename);
        }
        
        // Configure filters
        let filters = options.filters.unwrap_or_else(|| self.config.filters.clone());
        for filter in &filters {
            let extensions: Vec<&str> = filter.extensions.iter().map(|s| s.as_str()).collect();
            dialog = dialog.add_filter(&filter.name, &extensions);
        }
        
        dialog.save_file(move |file_path| {
            let _ = tx.send(file_path);
        });
        
        // Wait for user to select save location
        match rx.await {
            Ok(Some(destination_path)) => {
                let destination_pathbuf = destination_path.as_path().unwrap();
                info!("📁 User selected save location: {}", destination_pathbuf.display());
                
                // Perform the file copy operation
                let source_path = PathBuf::from(&options.source_file_path);
                
                match self.file_manager.copy_file_safe(&source_path, &destination_pathbuf) {
                    Ok(operation_result) => {
                        info!("✅ File saved successfully: {} bytes", operation_result.bytes_processed.unwrap_or(0));
                        
                        DialogResult {
                            success: true,
                            canceled: false,
                            file_paths: Some(vec![destination_pathbuf.to_string_lossy().to_string()]),
                            file_path: Some(destination_pathbuf.to_string_lossy().to_string()),
                            error: None,
                        }
                    }
                    Err(error) => {
                        error!("❌ Failed to save file: {}", error);
                        
                        DialogResult {
                            success: false,
                            canceled: false,
                            file_paths: None,
                            file_path: None,
                            error: Some(error),
                        }
                    }
                }
            }
            Ok(None) | Err(_) => {
                info!("❌ User canceled file save");
                DialogResult {
                    success: false,
                    canceled: true,
                    file_paths: None,
                    file_path: None,
                    error: None,
                }
            }
        }
    }
    
    /// Handle dropped file operations
    pub async fn handle_dropped_file(&self, content: Vec<u8>, filename: String) -> DialogResult {
        info!("📥 Handling dropped file: {} ({} bytes)", filename, content.len());
        
        match self.file_manager.save_dropped_file(&content, &filename) {
            Ok(operation_result) => {
                let file_path = operation_result.file_path
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();
                
                info!("✅ Successfully saved dropped file: {}", file_path);
                
                DialogResult {
                    success: true,
                    canceled: false,
                    file_paths: Some(vec![file_path.clone()]),
                    file_path: Some(file_path),
                    error: None,
                }
            }
            Err(error) => {
                error!("❌ Failed to save dropped file: {}", error);
                
                DialogResult {
                    success: false,
                    canceled: false,
                    file_paths: None,
                    file_path: None,
                    error: Some(error),
                }
            }
        }
    }
    
    /// Create dialog configuration for specific file types
    pub fn create_database_config() -> DialogConfig {
        DialogConfig {
            title: Some("Select Database File".to_string()),
            default_path: None,
            filters: vec![
                DialogFilter {
                    name: "Database Files".to_string(),
                    extensions: vec!["db".to_string(), "sqlite".to_string(), "sqlite3".to_string(), "db3".to_string()],
                },
                DialogFilter {
                    name: "All Files".to_string(),
                    extensions: vec!["*".to_string()],
                },
            ],
            multiple_selection: false,
        }
    }
    
    /// Create dialog configuration for CSV files
    pub fn create_csv_config() -> DialogConfig {
        DialogConfig {
            title: Some("Select CSV File".to_string()),
            default_path: None,
            filters: vec![
                DialogFilter {
                    name: "CSV Files".to_string(),
                    extensions: vec!["csv".to_string()],
                },
                DialogFilter {
                    name: "Text Files".to_string(),
                    extensions: vec!["txt".to_string(), "tsv".to_string()],
                },
                DialogFilter {
                    name: "All Files".to_string(),
                    extensions: vec!["*".to_string()],
                },
            ],
            multiple_selection: false,
        }
    }
    
    /// Create dialog configuration for multiple file selection
    pub fn create_multiple_files_config() -> DialogConfig {
        DialogConfig {
            title: Some("Select Files".to_string()),
            default_path: None,
            filters: vec![
                DialogFilter {
                    name: "All Files".to_string(),
                    extensions: vec!["*".to_string()],
                },
            ],
            multiple_selection: true,
        }
    }
}

impl DialogResult {
    /// Create a success result
    pub fn success(file_path: String) -> Self {
        Self {
            success: true,
            canceled: false,
            file_paths: Some(vec![file_path.clone()]),
            file_path: Some(file_path),
            error: None,
        }
    }
    
    /// Create a canceled result
    pub fn canceled() -> Self {
        Self {
            success: false,
            canceled: true,
            file_paths: None,
            file_path: None,
            error: None,
        }
    }
    
    /// Create an error result
    pub fn error(error_message: &str) -> Self {
        Self {
            success: false,
            canceled: false,
            file_paths: None,
            file_path: None,
            error: Some(error_message.to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_dialog_config_default() {
        let config = DialogConfig::default();
        assert_eq!(config.filters.len(), 2);
        assert!(!config.multiple_selection);
        assert!(config.title.is_none());
    }
    
    #[test]
    fn test_dialog_result_success() {
        let result = DialogResult::success("/path/to/file.db".to_string());
        assert!(result.success);
        assert!(!result.canceled);
        assert!(result.error.is_none());
        assert_eq!(result.file_path, Some("/path/to/file.db".to_string()));
    }
    
    #[test]
    fn test_dialog_result_canceled() {
        let result = DialogResult::canceled();
        assert!(!result.success);
        assert!(result.canceled);
        assert!(result.error.is_none());
        assert!(result.file_path.is_none());
    }
    
    #[test]
    fn test_dialog_result_error() {
        let result = DialogResult::error("Test error");
        assert!(!result.success);
        assert!(!result.canceled);
        assert_eq!(result.error, Some("Test error".to_string()));
        assert!(result.file_path.is_none());
    }
    
    #[test]
    fn test_create_database_config() {
        let config = DialogManager::create_database_config();
        assert_eq!(config.title, Some("Select Database File".to_string()));
        assert!(!config.multiple_selection);
        assert!(config.filters.iter().any(|f| f.name == "Database Files"));
    }
} 