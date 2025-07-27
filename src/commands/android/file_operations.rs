//! Android File Operations
//! 
//! This module handles Android file operations including database file
//! pulling from devices, pushing files back, and file system operations via ADB.

use crate::commands::device::execution::DeviceToolExecutor;
use crate::commands::device::types::{DeviceResponse, DatabaseFile};
use crate::commands::device::helpers::{ensure_temp_dir, get_adb_path, execute_adb_command, clean_temp_dir};
use crate::commands::device::types::DatabaseFileMetadata;
use log::{info, error};
use std::fs;
use std::io::Read;

/// Additional response helpers for Android operations
trait DeviceResponseExt<T> {
    fn success(data: T) -> DeviceResponse<T>;
    fn error(message: &str) -> DeviceResponse<T>;
    fn map_data<U, F>(self, f: F) -> DeviceResponse<U>
    where
        F: FnOnce(T) -> U;
}

impl<T> DeviceResponseExt<T> for DeviceResponse<T> {
    fn success(data: T) -> DeviceResponse<T> {
        DeviceResponse {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    fn error(message: &str) -> DeviceResponse<T> {
        DeviceResponse {
            success: false,
            data: None,
            error: Some(message.to_string()),
        }
    }

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

/// Get Android database files from device
#[tauri::command]
pub async fn adb_get_android_database_files(
    app_handle: tauri::AppHandle,
    device_id: String,
    package_name: String,
) -> Result<DeviceResponse<Vec<DatabaseFile>>, String> {
    info!("🗄️ Getting Android database files for device: {} package: {}", device_id, package_name);
    
    let executor = DeviceToolExecutor::new(app_handle);
    
    // Clean temp directory at the start
    if let Err(e) = clean_temp_dir() {
        error!("Failed to clean temp directory: {}", e);
    }
    
    let mut database_files = Vec::new();
    
    // Search in multiple locations with priority order
    // Priority: /data/data/ > /sdcard/Android/data/ > /storage/emulated/0/Android/data/
    let locations = vec![
        ("/data/data/", true),
        ("/sdcard/Android/data/", false),
        ("/storage/emulated/0/Android/data/", false),
    ];
    
    for (location, admin_required) in locations {
        let path = format!("{}{}/", location, package_name);
        
        let result = if admin_required {
            executor.execute_adb(&["-s", &device_id, "shell", "run-as", &package_name, "find", &path, "-name", "*.db", "-o", "-name", "*.sqlite", "-o", "-name", "*.sqlite3"],
                                 &format!("find database files (admin) in {}", location)).await
        } else {
            executor.execute_adb(&["-s", &device_id, "shell", "find", &path, "-name", "*.db", "-o", "-name", "*.sqlite", "-o", "-name", "*.sqlite3"],
                                 &format!("find database files in {}", location)).await
        };
        
        if let DeviceResponse { success: true, data: Some(command_result), .. } = result {
            let files_output = &command_result.stdout;
            let mut found_files = Vec::new();
            
            for file_path in files_output.lines() {
                let file_path = file_path.trim();
                if !file_path.is_empty() {
                    found_files.push((file_path.to_string(), admin_required));
                }
            }
                
            // If files found in this location, process them and skip remaining locations
            if !found_files.is_empty() {
                info!("Found {} database files in {}, skipping other locations", found_files.len(), location);
                
                // Pull each found database file to local temp directory
                for (file_path, admin_access) in found_files {
                    match pull_android_db_file(&device_id, &package_name, &file_path, admin_access).await {
                        Ok(local_path) => {
                            let filename = std::path::Path::new(&file_path)
                                .file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("unknown")
                                .to_string();
                            
                            database_files.push(DatabaseFile {
                                filename: filename.clone(),
                                path: local_path, // Use local path instead of remote path
                                remote_path: Some(file_path.to_string()),
                                package_name: package_name.clone(),
                                location: location.to_string(),
                                device_type: "android".to_string(),
                            });
                        }
                        Err(e) => {
                            error!("Failed to pull database file {}: {}", file_path, e);
                            // Still add the file with remote path for fallback
                            let filename = std::path::Path::new(&file_path)
                                .file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("unknown")
                                .to_string();
                            
                            database_files.push(DatabaseFile {
                                filename: filename.clone(),
                                path: file_path.to_string(),
                                remote_path: Some(file_path.to_string()),
                                package_name: package_name.clone(),
                                location: location.to_string(),
                                device_type: "android".to_string(),
                            });
                        }
                    }
                }
                
                // Break out of the loop since we found files in this location
                break;
            }
        }
    }
    
    Ok(<DeviceResponse<Vec<DatabaseFile>> as DeviceResponseExt<Vec<DatabaseFile>>>::success(database_files))
}

/// Push database file back to Android device
#[tauri::command]
pub async fn adb_push_database_file(
    device_id: String,
    local_path: String,
    package_name: String,
    remote_path: String,
) -> Result<DeviceResponse<String>, String> {
    info!("📤 Pushing database file {} to Android device: {}", local_path, device_id);
    
    match push_android_db_file(&device_id, &local_path, &package_name, &remote_path).await {
        Ok(message) => Ok(<DeviceResponse<String> as DeviceResponseExt<String>>::success(message)),
        Err(e) => Ok(<DeviceResponse<String> as DeviceResponseExt<String>>::error(&format!("Failed to push database file: {}", e))),
    }
}

/// Pull a database file from Android device to local temp directory
async fn pull_android_db_file(
    device_id: &str,
    package_name: &str,
    remote_path: &str,
    admin_access: bool,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    info!("=== Starting pull_android_db_file ===");
    info!("Device ID: {}", device_id);
    info!("Package: {}", package_name);
    info!("Remote path: {}", remote_path);
    info!("Admin access: {}", admin_access);
    
    let temp_dir = ensure_temp_dir().map_err(|e| e.to_string())?;
    info!("Temp directory: {:?}", temp_dir);
    
    let filename = std::path::Path::new(remote_path).file_name()
        .ok_or("Invalid remote path")?
        .to_string_lossy();
    let local_path = temp_dir.join(&*filename);
    info!("Local path will be: {:?}", local_path);
    
    // Execute ADB command based on admin access
    if admin_access {
        info!("Using admin access (run-as) mode");
        
        // Use shell command with redirection
        let adb_path = get_adb_path();
        let shell_cmd = format!("{} -s {} exec-out run-as {} cat {} > \"{}\"", 
                               adb_path, device_id, package_name, remote_path, local_path.display());
        
        info!("Executing shell command: {}", shell_cmd);
        
        // Use std::process::Command directly for better compatibility
        let output = std::process::Command::new("sh")
            .arg("-c")
            .arg(&shell_cmd)
            .output()?;
        
        info!("Shell command completed");
        info!("Exit status: {:?}", output.status);
        
        if !output.stderr.is_empty() {
            let stderr_str = String::from_utf8_lossy(&output.stderr);
            info!("Stderr content: {}", stderr_str);
        }
        
        // For exec-out with redirection, check if file was created successfully
        if !local_path.exists() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            error!("Shell command failed - file not created: {}", error_msg);
            return Err(format!("ADB exec-out failed to create file: {}", error_msg).into());
        }
        
    } else {
        info!("Using standard pull mode");
        
        info!("Executing: adb -s {} pull {} {}", device_id, remote_path, local_path.display());
        
        let output = execute_adb_command(&["-s", device_id, "pull", remote_path, &local_path.to_string_lossy()]).await?;
        
        info!("ADB pull command completed");
        info!("Exit status: {:?}", output.status);
        info!("Stdout: {}", String::from_utf8_lossy(&output.stdout));
        
        if !output.stderr.is_empty() {
            let stderr_str = String::from_utf8_lossy(&output.stderr);
            info!("Stderr content: {}", stderr_str);
        }
        
        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            error!("ADB pull failed: {}", error_msg);
            return Err(format!("ADB pull failed: {}", error_msg).into());
        }
    }
    
    // Verify the file was created and has content
    match fs::metadata(&local_path) {
        Ok(metadata) => {
            info!("File successfully created: {:?}", local_path);
            info!("File size: {} bytes", metadata.len());
            
            if metadata.len() == 0 {
                error!("Created file is empty!");
                return Err("Pulled database file is empty".into());
            }
            
            // Check if it looks like a SQLite file
            if metadata.len() >= 16 {
                match fs::File::open(&local_path) {
                    Ok(mut file) => {
                        let mut header = [0u8; 16];
                        if let Ok(_) = file.read_exact(&mut header) {
                            let header_str = String::from_utf8_lossy(&header[..15]);
                            info!("File header: {:?}", header_str);
                            
                            if header_str.starts_with("SQLite format") {
                                info!("✅ File appears to be a valid SQLite database");
                            } else {
                                info!("⚠️  File does not appear to be a SQLite database");
                            }
                        }
                    }
                    Err(e) => {
                        error!("Could not read file header: {}", e);
                    }
                }
            }
        }
        Err(e) => {
            error!("File was not created: {}", e);
            return Err(format!("File was not created: {}", e).into());
        }
    }
    
    // Store metadata
    let metadata = DatabaseFileMetadata {
        device_id: device_id.to_string(),
        package_name: package_name.to_string(),
        remote_path: remote_path.to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    };
    
    let metadata_path = format!("{}.meta.json", local_path.display());
    let metadata_json = serde_json::to_string_pretty(&metadata)?;
    fs::write(&metadata_path, metadata_json)?;
    info!("Metadata written to: {}", metadata_path);
    
    info!("=== pull_android_db_file completed successfully ===");
    Ok(local_path.to_string_lossy().to_string())
}

/// Push a database file back to Android device
async fn push_android_db_file(
    device_id: &str,
    local_path: &str,
    package_name: &str,
    remote_path: &str,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let filename = std::path::Path::new(local_path).file_name()
        .ok_or("Invalid local path")?
        .to_string_lossy();
    let tmp_path = format!("/data/local/tmp/{}", filename);
    
    info!("=== Starting push_android_db_file ===");
    info!("Device ID: {}", device_id);
    info!("Local path: {}", local_path);
    info!("Package: {}", package_name);
    info!("Remote path: {}", remote_path);
    info!("Filename: {}", filename);
    
    // Check if remote path is on external storage (sdcard)
    if remote_path.contains("sdcard") || remote_path.contains("external") {
        // Direct push to external storage
        info!("Pushing directly to external storage");
        
        let output = execute_adb_command(&["-s", device_id, "push", local_path, remote_path]).await?;
        
        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            return Err(format!("ADB direct push failed: {}", error_msg).into());
        }
    } else {
        // Push to tmp directory first
        info!("Pushing to tmp directory first");
        
        let output = execute_adb_command(&["-s", device_id, "push", local_path, &tmp_path]).await?;
        
        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            return Err(format!("ADB push to tmp failed: {}", error_msg).into());
        }
        
        // Copy from tmp to app's data directory using run-as
        info!("Copying from tmp to app data directory");
        
        let output = execute_adb_command(&["-s", device_id, "shell", "run-as", package_name, "cp", &tmp_path, remote_path]).await?;
        
        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            return Err(format!("ADB copy from tmp failed: {}", error_msg).into());
        }
        
        // Clean up temp file on device
        let _ = execute_adb_command(&["-s", device_id, "shell", "rm", &tmp_path]).await;
    }
    
    info!("=== push_android_db_file completed successfully ===");
    Ok(format!("Database successfully pushed to {}", remote_path))
} 