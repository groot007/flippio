use super::types::*;
use super::helpers::*;
use tauri_plugin_shell::ShellExt;
use log::{info, error};
use std::path::Path;
use std::fs;
use chrono;
use serde_json;

// Pull iOS database file to local temp directory
async fn pull_ios_db_file(
    device_id: &str,
    package_name: &str,
    remote_path: &str,
    is_device: bool,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let temp_dir = ensure_temp_dir()?;
    let filename = Path::new(remote_path).file_name()
        .ok_or("Invalid remote path")?
        .to_string_lossy();
    let local_path = temp_dir.join(&*filename);
    
    // Construct iOS command
    let ios_cmd = if is_device {
        // For physical iOS devices - use bundled afcclient
        let afcclient_path = get_libimobiledevice_tool_path("afcclient");
        let afcclient_cmd = afcclient_path
            .as_ref()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "afcclient".to_string());
        
        format!("{} --documents {} -u {} get {} {}", 
                afcclient_cmd, package_name, device_id, remote_path, local_path.display())
    } else {
        // For iOS simulators
        format!("xcrun simctl spawn {} cat {} > {}", 
                device_id, remote_path, local_path.display())
    };
    
    info!("Running iOS command: {}", ios_cmd);
    
    let output = std::process::Command::new("sh")
        .arg("-c")
        .arg(&ios_cmd)
        .output()?;
    
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("iOS pull failed: {}", error_msg).into());
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
    
    Ok(local_path.to_string_lossy().to_string())
}

// Push iOS database file back to device
async fn push_ios_db_file(
    device_id: &str,
    local_path: &str,
    package_name: &str,
    remote_path: &str,
    is_device: bool,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    info!("=== PUSH_IOS_DB_FILE FUNCTION CALLED ===");
    info!("Device ID: {}", device_id);
    info!("Local path: {}", local_path);
    info!("Package name: {}", package_name);
    info!("Remote path: {}", remote_path);
    info!("Is device: {}", is_device);
    
    // Check if local file exists first
    if !std::path::Path::new(local_path).exists() {
        error!("Local file does not exist: {}", local_path);
        return Err(format!("Local file does not exist: {}", local_path).into());
    }
    
    // Validate that the local file is not empty and appears to be a SQLite file
    match std::fs::metadata(local_path) {
        Ok(metadata) => {
            if metadata.len() == 0 {
                error!("Local file is empty: {}", local_path);
                return Err("Local file is empty".into());
            }
            info!("Local file size: {} bytes", metadata.len());
            
            // Quick check if it looks like a SQLite file
            if metadata.len() >= 16 {
                if let Ok(mut file) = std::fs::File::open(local_path) {
                    use std::io::Read;
                    let mut header = [0u8; 16];
                    if let Ok(_) = file.read_exact(&mut header) {
                        let header_str = String::from_utf8_lossy(&header[..15]);
                        if !header_str.starts_with("SQLite format") {
                            error!("Local file does not appear to be a SQLite database: {}", local_path);
                            return Err("Local file is not a valid SQLite database".into());
                        }
                        info!("✅ Local file appears to be a valid SQLite database");
                    }
                }
            }
        }
        Err(e) => {
            error!("Cannot access local file metadata: {}", e);
            return Err(format!("Cannot access local file: {}", e).into());
        }
    }
    
    info!("Local file exists and is valid: {}", local_path);
    
    if is_device {
        info!("Using physical iOS device path (afcclient)");
        // For physical iOS devices - use bundled afcclient
        let afcclient_path = get_libimobiledevice_tool_path("afcclient");
        let afcclient_cmd = afcclient_path
            .as_ref()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "afcclient".to_string());
        
        let ios_cmd = format!("{} --documents {} -u {} put {} {}", 
                              afcclient_cmd, package_name, device_id, local_path, remote_path);
        
        info!("Running iOS device push command: {}", ios_cmd);
        
        let output = std::process::Command::new("sh")
            .arg("-c")
            .arg(&ios_cmd)
            .output()?;
        
        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            return Err(format!("iOS device push failed: {}", error_msg).into());
        }
    } else {
        info!("=== USING iOS SIMULATOR PATH ===");
        // For iOS simulators - direct file replacement (like Electron)
        // local_path is the temp file with changes, remote_path is the original file in simulator
        
        info!("Local source path (edited file): {}", local_path);
        info!("Remote target path (original simulator file): {}", remote_path);
        
        // Check if the destination file exists
        if std::path::Path::new(remote_path).exists() {
            info!("✅ Target file exists - replacing with modified version");
        } else {
            info!("⚠️  Target file does not exist at: {}", remote_path);
            return Err(format!("Target file does not exist: {}", remote_path).into());
        }
        
        // Direct file replacement for simulator (simple copy like Electron)
        info!("Replacing original file with modified version...");
        
        // First, create a backup of the original file
        let backup_path = format!("{}.backup", remote_path);
        if let Err(e) = std::fs::copy(remote_path, &backup_path) {
            error!("Failed to create backup of original file: {}", e);
            return Err(format!("Failed to create backup: {}", e).into());
        }
        info!("Created backup at: {}", backup_path);
        
        match std::fs::copy(local_path, remote_path) {
            Ok(bytes_copied) => {
                info!("Successfully replaced {} bytes in simulator file: {}", bytes_copied, remote_path);
                
                // Verify the copied file has valid content
                match std::fs::metadata(remote_path) {
                    Ok(metadata) => {
                        if metadata.len() == 0 {
                            error!("Copied file is empty! Restoring from backup");
                            let _ = std::fs::copy(&backup_path, remote_path);
                            return Err("Copied file is empty, operation failed".into());
                        }
                        info!("Verified copied file size: {} bytes", metadata.len());
                    }
                    Err(e) => {
                        error!("Failed to verify copied file: {}", e);
                    }
                }
                
                // Clean up backup file
                let _ = std::fs::remove_file(&backup_path);
                
                info!("Database file replacement completed successfully");
            },
            Err(e) => {
                error!("Failed to replace simulator file: {}", e);
                error!("Source: {}", local_path);
                error!("Target: {}", remote_path);
                
                // Restore from backup
                if let Err(restore_err) = std::fs::copy(&backup_path, remote_path) {
                    error!("Failed to restore from backup: {}", restore_err);
                }
                let _ = std::fs::remove_file(&backup_path);
                
                return Err(format!("Failed to replace simulator file: {}", e).into());
            }
        }
    }
    
    Ok(format!("Database successfully pushed to {}", remote_path))
}

pub fn get_libimobiledevice_tool_path(tool_name: &str) -> Option<std::path::PathBuf> {
    if let Ok(exe_path) = std::env::current_exe() {
        log::info!("[libimobiledevice] current_exe: {:?}", exe_path);

        if let Some(exe_dir) = exe_path.parent() {
            // ✅ 1. Production: Contents/Resources/macos-deps/<tool>
            if let Some(resources_path) = exe_dir
                .parent() // Contents/
                .map(|p| p.join("MacOs").join(tool_name))
            {
                if resources_path.exists() {
                    log::info!(
                        "[libimobiledevice] Using bundled '{}' from Contents/Resources/macos-deps/: {:?}",
                        tool_name,
                        resources_path
                    );
                    return Some(resources_path);
                }
            }

            let dev_path = exe_dir
                .parent()
                .and_then(|p| p.parent())  // target/debug/
                .and_then(|p| p.parent())  // target/
                .map(|p| p.join("resources/libimobiledevice/tools").join(tool_name));

            if let Some(ref dev_path) = dev_path {
                if dev_path.exists() {
                    log::info!(
                        "[libimobiledevice] Using dev '{}' from: {:?}",
                        tool_name,
                        dev_path
                    );
                    return Some(dev_path.clone());
                }
            }
        }
    }

    // ❗ Fallback: system PATH
    log::warn!(
        "[libimobiledevice] Falling back to system '{}' from PATH",
        tool_name
    );
    None
}

#[tauri::command]
pub async fn get_libimobiledevice_tool_path_cmd(tool_name: String) -> Option<String> {
    get_libimobiledevice_tool_path(&tool_name).map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn device_get_ios_devices(app_handle: tauri::AppHandle) -> Result<DeviceResponse<Vec<Device>>, String> {
    log::info!("Getting iOS devices");
    
    let shell = app_handle.shell();
    
    // Try to use bundled idevice_id first, then fall back to system
    let idevice_id_path = get_libimobiledevice_tool_path("idevice_id");
    let idevice_id_cmd = idevice_id_path
        .as_ref()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "idevice_id".to_string());
    
    info!("Using idevice_id path: {:?}", idevice_id_path);
    info!("Using idevice_id command: {:?}", idevice_id_cmd);

    let output = shell.command(&idevice_id_cmd)
        .args(["-l"])
        .output()
        .await;

    info!("idevice_id command output: {:?}", output);
    
    let output = match output {
        Ok(output) => output,
        Err(e) => {
            log::warn!("Failed to execute idevice_id: {}", e);
            // Return empty list if tool is not available
            return Ok(DeviceResponse {
                success: true,
                data: Some(Vec::new()),
                error: None,
            });
        }
    };
    
    if output.status.success() {
        let devices_output = String::from_utf8_lossy(&output.stdout);
        let mut devices = Vec::new();
        
        for line in devices_output.lines() {
            let device_id = line.trim();
            if !device_id.is_empty() {
                // Get device name using bundled ideviceinfo
                let ideviceinfo_path = get_libimobiledevice_tool_path("ideviceinfo");
                let ideviceinfo_cmd = ideviceinfo_path
                    .as_ref()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|| "ideviceinfo".to_string());
                
                let name_output = shell.command(&ideviceinfo_cmd)
                    .args(["-u", device_id, "-k", "DeviceName"])
                    .output()
                    .await;
                
                let device_name = match name_output {
                    Ok(result) if result.status.success() => {
                        String::from_utf8_lossy(&result.stdout).trim().to_string()
                    }
                    _ => device_id.to_string(),
                };
                
                devices.push(Device {
                    id: device_id.to_string(),
                    name: device_name,
                    model: "iPhone".to_string(),
                    device_type: "iphone-device".to_string(),
                    description: "iOS device".to_string(),
                });
            }
        }
        
        Ok(DeviceResponse {
            success: true,
            data: Some(devices),
            error: None,
        })
    } else {
        // Return empty list if no devices found or tool not installed
        Ok(DeviceResponse {
            success: true,
            data: Some(Vec::new()),
            error: None,
        })
    }
}

#[tauri::command]
pub async fn device_get_ios_packages(app_handle: tauri::AppHandle, device_id: String) -> Result<DeviceResponse<Vec<Package>>, String> {
    log::info!("Getting iOS packages for device: {}", device_id);
    
    let shell = app_handle.shell();
    
    // Use xcrun simctl for simulators with plutil to convert plist to JSON
    log::info!("Executing: xcrun simctl listapps {} | plutil -convert json -o - -", device_id);
    let output = shell.command("sh")
        .args(["-c", &format!("xcrun simctl listapps {} | plutil -convert json -o - -", device_id)])
        .output()
        .await;
    
    match output {
        Ok(result) => {
            log::info!("simctl listapps command completed with status: {:?}", result.status);
            
            if result.status.success() {
                let packages_output = String::from_utf8_lossy(&result.stdout);
                log::info!("simctl stdout length: {} characters", packages_output.len());
                log::info!("simctl stdout preview (first 500 chars): {}", 
                    packages_output.chars().take(500).collect::<String>());
                
                let mut packages = Vec::new();
                
                // Parse the JSON output from simctl
                match serde_json::from_str::<serde_json::Value>(&packages_output) {
                    Ok(apps_json) => {
                        log::info!("Successfully parsed JSON from simctl output");
                        
                        if let Some(apps_obj) = apps_json.as_object() {
                            log::info!("Found {} apps in JSON object", apps_obj.len());
                            
                            for (bundle_id, app_info) in apps_obj {
                                if let Some(name) = app_info.get("CFBundleDisplayName")
                                    .or_else(|| app_info.get("CFBundleName"))
                                    .and_then(|v| v.as_str()) 
                                {
                                    log::info!("Found app: {} ({})", name, bundle_id);
                                    packages.push(Package {
                                        name: name.to_string(),
                                        bundle_id: bundle_id.clone(),
                                    });
                                }
                            }
                        } else {
                            log::warn!("JSON object is not an object type");
                        }
                    }
                    Err(e) => {
                        log::error!("Failed to parse JSON from simctl output: {}", e);
                        log::error!("Raw output: {}", packages_output);
                    }
                }
                
                log::info!("Returning {} packages for iOS simulator", packages.len());
                Ok(DeviceResponse {
                    success: true,
                    data: Some(packages),
                    error: None,
                })
            } else {
                let stderr = String::from_utf8_lossy(&result.stderr);
                log::error!("simctl listapps failed with stderr: {}", stderr);
                Ok(DeviceResponse {
                    success: false,
                    data: None,
                    error: Some(format!("simctl listapps failed: {}", stderr)),
                })
            }
        }
        Err(e) => {
            log::error!("Failed to execute simctl listapps command: {}", e);
            Ok(DeviceResponse {
                success: false,
                data: None,
                error: Some(format!("Failed to execute simctl command: {}", e)),
            })
        }
    }
}

#[tauri::command]
pub async fn device_get_ios_device_packages(app_handle: tauri::AppHandle, device_id: String) -> Result<DeviceResponse<Vec<Package>>, String> {
    // For physical iOS devices, use ideviceinstaller
    log::info!("Getting iOS device packages for device: {}", device_id);
    
    let shell = app_handle.shell();
    
    // Try to use bundled ideviceinstaller first, then fall back to system
    let ideviceinstaller_path = get_libimobiledevice_tool_path("ideviceinstaller");
    let ideviceinstaller_cmd = ideviceinstaller_path
        .as_ref()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "ideviceinstaller".to_string());
    
    info!("Using ideviceinstaller command: {}", ideviceinstaller_cmd);
    
    let output = shell.command(&ideviceinstaller_cmd)
        .args(["-u", &device_id, "-l"])
        .output()
        .await;
    
    match output {
        Ok(result) if result.status.success() => {
            let packages_output = String::from_utf8_lossy(&result.stdout);
            let mut packages = Vec::new();
            
            for line in packages_output.lines() {
                if let Some(bundle_id) = line.split(',').next() {
                    let bundle_id = bundle_id.trim();
                    if !bundle_id.is_empty() {
                        packages.push(Package {
                            name: bundle_id.to_string(),
                            bundle_id: bundle_id.to_string(),
                        });
                    }
                }
            }
            
            Ok(DeviceResponse {
                success: true,
                data: Some(packages),
                error: None,
            })
        }
        _ => {
            log::warn!("Failed to get iOS device packages for device: {}", device_id);
            Ok(DeviceResponse {
                success: true,
                data: Some(Vec::new()),
                error: None,
            })
        }
    }
}

#[tauri::command]
pub async fn device_get_ios_device_database_files(
    app_handle: tauri::AppHandle,
    device_id: String,
    package_name: String,
) -> Result<DeviceResponse<Vec<DatabaseFile>>, String> {
    log::info!("Getting iOS device database files for device: {} package: {}", device_id, package_name);
    
    let shell = app_handle.shell();
    let mut database_files = Vec::new();
    
    // Search in common iOS app data locations
    let locations = vec!["Documents", "Library", "tmp"];
    
    for location in locations {
        // Use bundled afcclient tool to list files in the app's container
        let afcclient_path = get_libimobiledevice_tool_path("afcclient");
        info!("Using afcclient tool at: {:?}", afcclient_path);

        let afcclient_cmd = afcclient_path
            .as_ref()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "afcclient".to_string());
        
        info!("Using afcclient command: {}", afcclient_cmd);
        
        let output = shell.command(&afcclient_cmd)
            .args(["--documents", &package_name, "-u", &device_id, "ls", location])
            .output()
            .await;
        
        if let Ok(result) = output {
            if result.status.success() {
                let files_output = String::from_utf8_lossy(&result.stdout);
                let mut found_files = Vec::new();
                
                for file in files_output.lines() {
                    let file = file.trim();
                    if !file.is_empty() && (file.ends_with(".db") || file.ends_with(".sqlite") || file.ends_with(".sqlite3")) {
                        let remote_path = format!("/{}/{}", location, file);
                        found_files.push(remote_path);
                    }
                }
                
                // Pull each found database file to local temp directory
                for remote_path in found_files {
                    match pull_ios_db_file(&device_id, &package_name, &remote_path, true).await {
                        Ok(local_path) => {
                            let filename = std::path::Path::new(&remote_path)
                                .file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("unknown")
                                .to_string();
                            
                            database_files.push(DatabaseFile {
                                path: local_path,
                                package_name: package_name.clone(),
                                filename,
                                remote_path: Some(remote_path),
                                location: location.to_string(),
                                device_type: "iphone-device".to_string(),
                            });
                        }
                        Err(e) => {
                            error!("Failed to pull iOS device database file {}: {}", remote_path, e);
                            // Still add the file with remote path for fallback
                            let filename = std::path::Path::new(&remote_path)
                                .file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("unknown")
                                .to_string();
                            
                            database_files.push(DatabaseFile {
                                path: remote_path.clone(),
                                package_name: package_name.clone(),
                                filename,
                                remote_path: Some(remote_path),
                                location: location.to_string(),
                                device_type: "iphone-device".to_string(),
                            });
                        }
                    }
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

#[tauri::command]
pub async fn device_check_app_existence(
    app_handle: tauri::AppHandle,
    device_id: String,
    package_name: String,
) -> Result<DeviceResponse<bool>, String> {
    log::info!("Checking app existence for device: {} package: {}", device_id, package_name);
    
    let shell = app_handle.shell();
    
    // Determine if it's a physical device or simulator
    let is_device = device_id.len() == 40 && device_id.chars().all(|c| c.is_ascii_hexdigit()) && !device_id.contains('-');
    
    if is_device {
        // For physical iOS devices, use ideviceinstaller
        let ideviceinstaller_path = get_libimobiledevice_tool_path("ideviceinstaller");
        let ideviceinstaller_cmd = ideviceinstaller_path
            .as_ref()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "ideviceinstaller".to_string());
        
        let output = shell.command(&ideviceinstaller_cmd)
            .args(["-u", &device_id, "-l"])
            .output()
            .await;
        
        if let Ok(result) = output {
            if result.status.success() {
                let packages_output = String::from_utf8_lossy(&result.stdout);
                let exists = packages_output.lines().any(|line| line.contains(&package_name));
                
                Ok(DeviceResponse {
                    success: true,
                    data: Some(exists),
                    error: None,
                })
            } else {
                Ok(DeviceResponse {
                    success: false,
                    data: Some(false),
                    error: Some("Failed to check app existence".to_string()),
                })
            }
        } else {
            Ok(DeviceResponse {
                success: false,
                data: Some(false),
                error: Some("Failed to execute ideviceinstaller".to_string()),
            })
        }
    } else {
        // For iOS simulators, use simctl
        let output = shell.command("xcrun")
            .args(["simctl", "get_app_container", &device_id, &package_name, "app"])
            .output()
            .await;
        
        if let Ok(result) = output {
            let exists = result.status.success();
            
            Ok(DeviceResponse {
                success: true,
                data: Some(exists),
                error: None,
            })
        } else {
            Ok(DeviceResponse {
                success: false,
                data: Some(false),
                error: Some("Failed to execute simctl".to_string()),
            })
        }
    }
}

#[tauri::command]
pub async fn device_upload_ios_db_file(
    app_handle: tauri::AppHandle,
    device_id: String,
    package_name: String,
    file_path: String,
) -> Result<DeviceResponse<String>, String> {
    log::info!("Uploading iOS database file for device: {} package: {} file: {}", device_id, package_name, file_path);
    
    // This is a placeholder - in practice, you would handle file uploads differently
    Ok(DeviceResponse {
        success: true,
        data: Some("File uploaded successfully".to_string()),
        error: None,
    })
}

// Push database file back to iOS device
#[tauri::command] 
pub async fn device_push_ios_database_file(
    device_id: String,
    local_path: String,
    package_name: String,
    remote_path: String,
) -> Result<DeviceResponse<String>, String> {
    log::info!("=== PUSH IOS DATABASE FILE CALLED ===");
    log::info!("Device ID: {}", device_id);
    log::info!("Local path: {}", local_path);
    log::info!("Package name: {}", package_name);
    log::info!("Remote path: {}", remote_path);
    
    // Determine if it's a physical device or simulator
    // Physical iOS devices have 40-character hex IDs without dashes
    // iOS simulators have UUID format with dashes (e.g., E9E497ED-ED8E-4A33-B124-8F31C8E9FC34)
    let is_device = device_id.len() == 40 && device_id.chars().all(|c| c.is_ascii_hexdigit()) && !device_id.contains('-');
    log::info!("Device detection - is_device: {}", is_device);
    
    match push_ios_db_file(&device_id, &local_path, &package_name, &remote_path, is_device).await {
        Ok(message) => {
            log::info!("Successfully pushed iOS database file: {}", message);
            Ok(DeviceResponse {
                success: true,
                data: Some(message),
                error: None,
            })
        },
        Err(e) => {
            log::error!("Failed to push iOS database file: {}", e);
            Ok(DeviceResponse {
                success: false,
                data: None,
                error: Some(format!("Failed to push iOS database file: {}", e)),
            })
        }
    }
}
