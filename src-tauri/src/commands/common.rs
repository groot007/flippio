// Common commands module
// Implements file dialog and other common IPC commands

use serde::{Deserialize, Serialize};
use tauri_plugin_dialog::{DialogExt};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct DialogResult {
    pub canceled: bool,
    pub file_paths: Option<Vec<String>>,
    pub file_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveDialogOptions {
    pub db_file_path: String,
    pub default_path: Option<String>,
    pub filters: Option<Vec<DialogFilter>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DialogFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

#[tauri::command]
pub async fn dialog_select_file(
    app_handle: tauri::AppHandle,
    _options: Option<serde_json::Value>
) -> Result<DialogResult, String> {
    use tokio::sync::oneshot;
    
    let (tx, rx) = oneshot::channel();
    
    let mut dialog = app_handle.dialog().file();
    
    // Add database file filters
    dialog = dialog.add_filter("Database Files", &["db", "sqlite", "sqlite3", "db3"]);
    dialog = dialog.add_filter("All Files", &["*"]);
    
    dialog.pick_file(move |file_path| {
        let _ = tx.send(file_path);
    });
    
    // Wait for the user to select a file or cancel
    match rx.await {
        Ok(Some(path)) => Ok(DialogResult {
            canceled: false,
            file_paths: Some(vec![path.to_string()]),
            file_path: Some(path.to_string()),
        }),
        Ok(None) | Err(_) => Ok(DialogResult {
            canceled: true,
            file_paths: None,
            file_path: None,
        }),
    }
}

#[tauri::command]
pub async fn dialog_save_file(
    app_handle: tauri::AppHandle,
    options: SaveDialogOptions
) -> Result<Option<String>, String> {
    use tokio::sync::oneshot;
    
    let (tx, rx) = oneshot::channel();
    
    let mut dialog = app_handle.dialog().file();
    
    // Set default filename from options if provided
    if let Some(default_path) = &options.default_path {
        dialog = dialog.set_file_name(default_path);
    }
    
    // Set filters if provided
    if let Some(filters) = &options.filters {
        for filter in filters {
            let extensions: Vec<&str> = filter.extensions.iter().map(|s| s.as_str()).collect();
            dialog = dialog.add_filter(&filter.name, &extensions);
        }
    }
    
    dialog.save_file(move |file_path| {
        let _ = tx.send(file_path);
    });
    
    // Wait for the user to select a save location or cancel
    match rx.await {
        Ok(Some(path)) => {
            // Copy the database file to the selected location
            let source_path = Path::new(&options.db_file_path);
            let dest_string = path.to_string();
            let dest_path = Path::new(&dest_string);
            
            std::fs::copy(source_path, dest_path)
                .map_err(|e| format!("Failed to copy file: {}", e))?;
            
            Ok(Some(path.to_string()))
        },
        Ok(None) | Err(_) => Ok(None),
    }
}
