use super::types::*;
use super::helpers::*;
use log::{info, error};
use std::path::Path;
use std::fs;
use chrono;
use serde_json;

// Pull Android database file to local temp directory
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
    
    let temp_dir = ensure_temp_dir()?;
    info!("Temp directory: {:?}", temp_dir);
    
    let filename = Path::new(remote_path).file_name()
        .ok_or("Invalid remote path")?
        .to_string_lossy();
    let local_path = temp_dir.join(&*filename);
    info!("Local path will be: {:?}", local_path);
    
    // Execute ADB command based on admin access
    if admin_access {
        info!("Using admin access (run-as) mode");
        
        // Use shell command with redirection like in Electron
        // Important: Use exec-out with run-as and redirect to local file
        let adb_path = get_adb_path();
        let shell_cmd = format!("{} -s {} exec-out run-as {} cat {} > \"{}\"", 
                               adb_path, device_id, package_name, remote_path, local_path.display());
        
        info!("Executing shell command: {}", shell_cmd);
        
        // Use std::process::Command directly like in Electron for better compatibility
        let output = std::process::Command::new("sh")
            .arg("-c")
            .arg(&shell_cmd)
            .output()?;
        
        info!("Shell command completed");
        info!("Exit status: {:?}", output.status);
        
        if !output.stderr.is_empty() {
            let stderr_str = String::from_utf8_lossy(&output.stderr);
            info!("Stderr content: {}", stderr_str);
            // Note: stderr might contain non-error messages from adb
        }
        
        // For exec-out with redirection, check if file was created successfully
        // rather than relying solely on exit status
        if !local_path.exists() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            error!("Shell command failed - file not created: {}", error_msg);
            return Err(format!("ADB exec-out failed to create file: {}", error_msg).into());
        }
        
    } else {
        info!("Using standard pull mode");
        
        // For standard access, use adb pull
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
            
            // Check if it looks like a SQLite file (first 16 bytes should be SQLite header)
            if metadata.len() >= 16 {
                match fs::File::open(&local_path) {
                    Ok(mut file) => {
                        use std::io::Read;
                        let mut header = [0u8; 16];
                        if let Ok(_) = file.read_exact(&mut header) {
                            let header_str = String::from_utf8_lossy(&header[..15]); // First 15 bytes
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

// Push Android database file back to device
async fn push_android_db_file(
    device_id: &str,
    local_path: &str,
    package_name: &str,
    remote_path: &str,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let filename = Path::new(local_path).file_name()
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

#[tauri::command]
pub async fn adb_get_devices(_app_handle: tauri::AppHandle) -> Result<DeviceResponse<Vec<Device>>, String> {
    log::info!("Getting Android devices");
    
    let output = match execute_adb_command(&["devices", "-l"]).await {
        Ok(output) => output,
        Err(e) => {
            return Ok(DeviceResponse {
                success: false,
                data: None,
                error: Some(format!("Failed to execute adb command: {}. Make sure Android SDK is installed and ADB is in your PATH.", e)),
            });
        }
    };
    
    if output.status.success() {
        let devices_output = String::from_utf8_lossy(&output.stdout);
        let mut devices = Vec::new();
        
        for line in devices_output.lines().skip(1) {
            if !line.trim().is_empty() && line.contains("device") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    let device_id = parts[0].to_string();
                    let mut model = "Unknown".to_string();
                    let mut device_name = device_id.clone();
                    
                    // Determine if it's an Android device or emulator
                    // If the line contains "usb:" it's a physical device, otherwise it's an emulator
                    let is_physical_device = line.contains("usb:");
                    let description = if is_physical_device {
                        "Android device".to_string()
                    } else {
                        "Android emulator".to_string()
                    };
                    
                    // Parse device properties
                    for part in &parts[2..] {
                        if part.starts_with("model:") {
                            model = part.replace("model:", "");
                        } else if part.starts_with("device:") {
                            device_name = part.replace("device:", "");
                        }
                    }
                    
                    devices.push(Device {
                        id: device_id,
                        name: device_name,
                        model,
                        device_type: "android".to_string(),
                        description,
                    });
                }
            }
        }
        
        Ok(DeviceResponse {
            success: true,
            data: Some(devices),
            error: None,
        })
    } else {
        let error_output = String::from_utf8_lossy(&output.stderr);
        Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(error_output.to_string()),
        })
    }
}

#[tauri::command]
pub async fn adb_get_packages(_app_handle: tauri::AppHandle, device_id: String) -> Result<DeviceResponse<Vec<Package>>, String> {
    log::info!("Getting packages for device: {}", device_id);
    
    let output = match execute_adb_command(&["-s", &device_id, "shell", "pm", "list", "packages", "-3"]).await {
        Ok(output) => output,
        Err(e) => {
            return Ok(DeviceResponse {
                success: false,
                data: None,
                error: Some(format!("Failed to execute adb command: {}. Make sure the device is connected and ADB is working.", e)),
            });
        }
    };
    
    if output.status.success() {
        let packages_output = String::from_utf8_lossy(&output.stdout);
        let mut packages = Vec::new();
        
        for line in packages_output.lines() {
            if line.starts_with("package:") {
                let package_name = line.replace("package:", "").trim().to_string();
                
                // Get app name using dumpsys (simplified version)
                let display_name = package_name.clone(); // For now, use package name as display name
                
                packages.push(Package {
                    name: display_name,
                    bundle_id: package_name,
                });
            }
        }
        
        Ok(DeviceResponse {
            success: true,
            data: Some(packages),
            error: None,
        })
    } else {
        let error_output = String::from_utf8_lossy(&output.stderr);
        Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(error_output.to_string()),
        })
    }
}

#[tauri::command]
pub async fn adb_get_android_database_files(
    _app_handle: tauri::AppHandle,
    device_id: String,
    package_name: String,
) -> Result<DeviceResponse<Vec<DatabaseFile>>, String> {
    log::info!("Getting Android database files for device: {} package: {}", device_id, package_name);
    
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
        
        let output = if admin_required {
            execute_adb_command(&["-s", &device_id, "shell", "run-as", &package_name, "find", &path, "-name", "*.db", "-o", "-name", "*.sqlite", "-o", "-name", "*.sqlite3"]).await
        } else {
            execute_adb_command(&["-s", &device_id, "shell", "find", &path, "-name", "*.db", "-o", "-name", "*.sqlite", "-o", "-name", "*.sqlite3"]).await
        };
        
        if let Ok(result) = output {
            if result.status.success() {
                let files_output = String::from_utf8_lossy(&result.stdout);
                let mut found_files = Vec::new();
                
                for file_path in files_output.lines() {
                    let file_path = file_path.trim();
                    if !file_path.is_empty() {
                        found_files.push((file_path.to_string(), admin_required));
                    }
                }
                
                // If files found in this location, process them and skip remaining locations
                if !found_files.is_empty() {
                    log::info!("Found {} database files in {}, skipping other locations", found_files.len(), location);
                    
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
                                    path: local_path, // Use local path instead of remote path
                                    package_name: package_name.clone(),
                                    filename,
                                    location: location.to_string(),
                                    remote_path: Some(file_path),
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
                                    path: file_path.clone(),
                                    package_name: package_name.clone(),
                                    filename,
                                    location: location.to_string(),
                                    remote_path: Some(file_path),
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
    }
    
    Ok(DeviceResponse {
        success: true,
        data: Some(database_files),
        error: None,
    })
}



// Push database file back to Android device
#[tauri::command]
pub async fn adb_push_database_file(
    device_id: String,
    local_path: String,
    package_name: String,
    remote_path: String,
) -> Result<DeviceResponse<String>, String> {
    log::info!("Pushing database file {} to Android device: {}", local_path, device_id);
    
    match push_android_db_file(&device_id, &local_path, &package_name, &remote_path).await {
        Ok(message) => Ok(DeviceResponse {
            success: true,
            data: Some(message),
            error: None,
        }),
        Err(e) => Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(format!("Failed to push database file: {}", e)),
        }),
    }
}
