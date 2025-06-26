// Tauri command to expose the resolved libimobiledevice tool path to the frontend
#[tauri::command]
pub async fn get_libimobiledevice_tool_path_cmd(tool_name: String) -> Option<String> {
    get_libimobiledevice_tool_path(&tool_name).map(|p| p.to_string_lossy().to_string())
}
// Device commands module
// Implements all device-related IPC commands (ADB, iOS, Virtual devices)

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri_plugin_shell::{ShellExt};
use log::{info, error};

// Temp directory utilities
fn get_temp_dir_path() -> PathBuf {
    std::env::temp_dir().join("flippio-db-temp")
}

fn ensure_temp_dir() -> Result<PathBuf, Box<dyn std::error::Error + Send + Sync>> {
    let temp_dir = get_temp_dir_path();
    
    // Only create temp directory if it doesn't exist
    if !temp_dir.exists() {
        fs::create_dir_all(&temp_dir)?;
    }
    
    Ok(temp_dir)
}

fn clean_temp_dir() -> Result<PathBuf, Box<dyn std::error::Error + Send + Sync>> {
    let temp_dir = get_temp_dir_path();
    
    // Remove existing temp directory if it exists
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir)?;
    }
    
    // Create fresh temp directory
    fs::create_dir_all(&temp_dir)?;
    
    Ok(temp_dir)
}

// Metadata for pulled database files
#[derive(Debug, Serialize, Deserialize)]
pub struct DatabaseFileMetadata {
    pub device_id: String,
    pub package_name: String,
    pub remote_path: String,
    pub timestamp: String,
}

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
    
    info!("Pushing database file {} to device {}", local_path, device_id);
    
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
    
    Ok(format!("Database successfully pushed to {}", remote_path))
}

// Push iOS database file back to device
async fn push_ios_db_file(
    device_id: &str,
    local_path: &str,
    package_name: &str,
    remote_path: &str,
    is_device: bool,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    info!("Pushing iOS database file {} to device {}", local_path, device_id);
    
    if is_device {
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
        // For iOS simulators - direct file copy to container
        // First get the container path
        let container_cmd = format!("xcrun simctl get_app_container {} {} data", 
                                   device_id, package_name);
        
        let output = std::process::Command::new("sh")
            .arg("-c")
            .arg(&container_cmd)
            .output()?;
        
        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to get iOS simulator container: {}", error_msg).into());
        }
        
        let container_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let full_remote_path = format!("{}{}", container_path, remote_path);
        
        // Direct file copy for simulator
        std::fs::copy(local_path, &full_remote_path)?;
    }
    
    Ok(format!("Database successfully pushed to {}", remote_path))
}

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

// Response types matching Electron IPC responses
#[derive(Debug, Serialize, Deserialize)]
pub struct DeviceResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Device {
    pub id: String,
    pub name: String,
    pub model: String,
    #[serde(rename = "deviceType")]
    pub device_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Package {
    pub name: String,
    #[serde(rename = "bundleId")]
    pub bundle_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DatabaseFile {
    pub path: String,
    #[serde(rename = "packageName")]
    pub package_name: String,
    pub filename: String,
    pub location: String,
    #[serde(rename = "remotePath")]
    pub remote_path: Option<String>,
    #[serde(rename = "deviceType")]
    pub device_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VirtualDevice {
    pub id: String,
    pub name: String,
    pub platform: String,
    pub state: Option<String>,
}

// Helper function to get ADB executable path
fn get_adb_path() -> String {
    // Try to find ADB in common locations
    let possible_paths = vec![
        "adb",  // System PATH
        "/usr/local/bin/adb",  // Homebrew on macOS
        "/opt/homebrew/bin/adb",  // Homebrew on Apple Silicon
        "/usr/bin/adb",  // Linux
        "/Android/Sdk/platform-tools/adb",  // Android SDK
        "~/Library/Android/sdk/platform-tools/adb",  // macOS Android SDK
        "~/Android/Sdk/platform-tools/adb",  // User Android SDK
    ];
    
    for path in possible_paths {
        let expanded_path = if path.starts_with("~") {
            if let Some(home) = std::env::var("HOME").ok() {
                path.replace("~", &home)
            } else {
                path.to_string()
            }
        } else {
            path.to_string()
        };
        
        // Check if the path exists and is executable
        if let Ok(output) = std::process::Command::new(&expanded_path)
            .arg("version")
            .output()
        {
            if output.status.success() {
                info!("Found ADB at: {}", expanded_path);
                return expanded_path;
            }
        }
    }
    
    // Fallback to just "adb" and hope it's in PATH
    info!("Using fallback ADB path: adb");
    "adb".to_string()
}

// Execute ADB command with proper error handling
async fn execute_adb_command(args: &[&str]) -> Result<std::process::Output, Box<dyn std::error::Error + Send + Sync>> {
    let adb_path = get_adb_path();
    
    info!("Executing ADB command: {} {}", adb_path, args.join(" "));
    
    let output = std::process::Command::new(&adb_path)
        .args(args)
        .output()?;
    
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        if !error_msg.is_empty() {
            error!("ADB command failed: {}", error_msg);
        }
    }
    
    Ok(output)
}

// ADB Commands

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
    
    // Search in multiple locations
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
            }
        }
    }
    
    Ok(DeviceResponse {
        success: true,
        data: Some(database_files),
        error: None,
    })
}

pub fn get_libimobiledevice_tool_path(tool_name: &str) -> Option<PathBuf> {
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
    
    // Use xcrun simctl for simulators
    let output = shell.command("xcrun")
        .args(["simctl", "listapps", &device_id])
        .output()
        .await;
    
    match output {
        Ok(result) if result.status.success() => {
            let packages_output = String::from_utf8_lossy(&result.stdout);
            let mut packages = Vec::new();
            
            // Parse the JSON output from simctl
            if let Ok(apps_json) = serde_json::from_str::<serde_json::Value>(&packages_output) {
                if let Some(apps_obj) = apps_json.as_object() {
                    for (bundle_id, app_info) in apps_obj {
                        if let Some(name) = app_info.get("CFBundleDisplayName")
                            .or_else(|| app_info.get("CFBundleName"))
                            .and_then(|v| v.as_str()) 
                        {
                            packages.push(Package {
                                name: name.to_string(),
                                bundle_id: bundle_id.clone(),
                            });
                        }
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
            // Fallback: return empty list
            Ok(DeviceResponse {
                success: true,
                data: Some(Vec::new()),
                error: None,
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
pub async fn adb_get_ios_database_files(
    app_handle: tauri::AppHandle,
    device_id: String,
    package_name: String,
) -> Result<DeviceResponse<Vec<DatabaseFile>>, String> {
    log::info!("Getting iOS database files for device: {} package: {}", device_id, package_name);
    
    // Clean temp directory at the start
    if let Err(e) = clean_temp_dir() {
        error!("Failed to clean temp directory: {}", e);
    }
    
    let shell = app_handle.shell();
    let mut database_files = Vec::new();
    
    // Get the app's data container path for iOS simulator
    let output = shell.command("xcrun")
        .args(["simctl", "get_app_container", &device_id, &package_name, "data"])
        .output()
        .await;
    
    if let Ok(result) = output {
        if result.status.success() {
            let container_path = String::from_utf8_lossy(&result.stdout).trim().to_string();
            
            // Search for database files in the container
            let find_output = shell.command("find")
                .args([&container_path, "-name", "*.db", "-o", "-name", "*.sqlite", "-o", "-name", "*.sqlite3"])
                .output()
                .await;
            
            if let Ok(find_result) = find_output {
                if find_result.status.success() {
                    let files_output = String::from_utf8_lossy(&find_result.stdout);
                    let mut found_files = Vec::new();
                    
                    for file_path in files_output.lines() {
                        let file_path = file_path.trim();
                        if !file_path.is_empty() {
                            found_files.push(file_path.to_string());
                        }
                    }
                    
                    // Copy each found database file to local temp directory
                    for file_path in found_files {
                        // Ensure temp directory exists
                        let temp_dir = match ensure_temp_dir() {
                            Ok(dir) => dir,
                            Err(e) => {
                                error!("Failed to ensure temp directory: {}", e);
                                continue;
                            }
                        };
                        
                        // For iOS simulator, we can directly copy the file since it's already local
                        let filename = std::path::Path::new(&file_path)
                            .file_name()
                            .unwrap_or_else(|| std::ffi::OsStr::new("unknown"));
                        let local_path = temp_dir.join(filename);
                        
                        match std::fs::copy(&file_path, &local_path) {
                            Ok(_) => {
                                let filename = filename
                                    .to_str()
                                    .unwrap_or("unknown")
                                    .to_string();
                                
                                // Determine relative location from container path
                                let relative_path = file_path.replace(&container_path, "")
                                    .split('/')
                                    .filter(|p| !p.is_empty())
                                    .next()
                                    .unwrap_or("root")
                                    .to_string();
                                

                                
                                // Store metadata
                                let metadata = DatabaseFileMetadata {
                                    device_id: device_id.clone(),
                                    package_name: package_name.clone(),
                                    remote_path: file_path.clone(),
                                    timestamp: chrono::Utc::now().to_rfc3339(),
                                };
                                
                                let metadata_path = format!("{}.meta.json", local_path.display());
                                if let Ok(metadata_json) = serde_json::to_string_pretty(&metadata) {
                                    let _ = std::fs::write(&metadata_path, metadata_json);
                                }
                                
                                database_files.push(DatabaseFile {
                                    path: local_path.to_string_lossy().to_string(),
                                    package_name: package_name.clone(),
                                    filename,
                                    remote_path: Some(file_path),
                                    location: relative_path,
                                    device_type: "iphone".to_string(),
                                });
                            }
                            Err(e) => {
                                error!("Failed to copy iOS database file {}: {}", file_path, e);
                                // Still add the file with remote path for fallback
                                let filename = std::path::Path::new(&file_path)
                                    .file_name()
                                    .and_then(|n| n.to_str())
                                    .unwrap_or("unknown")
                                    .to_string();
                                
                                let relative_path = file_path.replace(&container_path, "")
                                    .split('/')
                                    .filter(|p| !p.is_empty())
                                    .next()
                                    .unwrap_or("root")
                                    .to_string();
                                
                                database_files.push(DatabaseFile {
                                    path: file_path.clone(),
                                    package_name: package_name.clone(),
                                    filename,
                                    remote_path: Some(file_path),
                                    location: relative_path,
                                    device_type: "iphone".to_string(),
                                });
                            }
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
    
    // Try to get app container path
    let output = shell.command("xcrun")
        .args(["simctl", "get_app_container", &device_id, &package_name, "data"])
        .output()
        .await;
    
    match output {
        Ok(result) => Ok(DeviceResponse {
            success: true,
            data: Some(result.status.success()),
            error: None,
        }),
        Err(_) => Ok(DeviceResponse {
            success: true,
            data: Some(false),
            error: None,
        }),
    }
}

#[tauri::command]
pub async fn device_upload_ios_db_file(
    app_handle: tauri::AppHandle,
    device_id: String,
    package_name: String,
    local_file_path: String,
    remote_location: String,
) -> Result<DeviceResponse<String>, String> {
    log::info!("Uploading iOS database file from {} to {} on device {}", local_file_path, remote_location, device_id);
    
    // Check if local file exists
    if !std::path::Path::new(&local_file_path).exists() {
        return Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(format!("Local file {} does not exist", local_file_path)),
        });
    }
    
    // For simulators, copy file directly to the container
    let shell = app_handle.shell();
    let container_output = shell.command("xcrun")
        .args(["simctl", "get_app_container", &device_id, &package_name, "data"])
        .output()
        .await;
    
    if let Ok(result) = container_output {
        if result.status.success() {
            let container_path = String::from_utf8_lossy(&result.stdout).trim().to_string();
            let remote_full_path = format!("{}/{}", container_path, remote_location);
            
            // Copy file to simulator
            match std::fs::copy(&local_file_path, &remote_full_path) {
                Ok(_) => Ok(DeviceResponse {
                    success: true,
                    data: Some(format!("File uploaded successfully to {}", remote_location)),
                    error: None,
                }),
                Err(e) => Ok(DeviceResponse {
                    success: false,
                    data: None,
                    error: Some(format!("Failed to copy file: {}", e)),
                }),
            }
        } else {
            Ok(DeviceResponse {
                success: false,
                data: None,
                error: Some("Failed to get container path".to_string()),
            })
        }
    } else {
        Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some("Failed to get iOS container path".to_string()),
        })
    }
}

// Virtual Device Commands

#[tauri::command]
pub async fn get_android_emulators(app_handle: tauri::AppHandle) -> Result<DeviceResponse<Vec<VirtualDevice>>, String> {
    log::info!("Getting Android emulators");
    
    let shell = app_handle.shell();
    let output = shell.command("emulator")
        .args(["-list-avds"])
        .output()
        .await
        .map_err(|e| format!("Failed to execute emulator command: {}", e))?;
    
    if output.status.success() {
        let emulators_output = String::from_utf8_lossy(&output.stdout);
        let mut emulators = Vec::new();
        
        for line in emulators_output.lines() {
            let emulator_id = line.trim();
            if !emulator_id.is_empty() {
                emulators.push(VirtualDevice {
                    id: emulator_id.to_string(),
                    name: emulator_id.to_string(),
                    platform: "android".to_string(),
                    state: Some("stopped".to_string()),
                });
            }
        }
        
        Ok(DeviceResponse {
            success: true,
            data: Some(emulators),
            error: None,
        })
    } else {
        Ok(DeviceResponse {
            success: true,
            data: Some(Vec::new()),
            error: None,
        })
    }
}

#[tauri::command]
pub async fn get_ios_simulators(app_handle: tauri::AppHandle) -> Result<DeviceResponse<Vec<VirtualDevice>>, String> {
    log::info!("Getting iOS simulators");
    
    let shell = app_handle.shell();
    let output = shell.command("xcrun")
        .args(["simctl", "list", "devices", "available", "--json"])
        .output()
        .await
        .map_err(|e| format!("Failed to execute simctl: {}", e))?;
    
    if output.status.success() {
        let simulators_output = String::from_utf8_lossy(&output.stdout);
        let mut simulators = Vec::new();
        
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&simulators_output) {
            if let Some(devices) = json.get("devices").and_then(|d| d.as_object()) {
                for (runtime, device_list) in devices {
                    if let Some(device_array) = device_list.as_array() {
                        for device in device_array {
                            if let (Some(name), Some(udid), Some(state)) = (
                                device.get("name").and_then(|n| n.as_str()),
                                device.get("udid").and_then(|u| u.as_str()),
                                device.get("state").and_then(|s| s.as_str()),
                            ) {
                                simulators.push(VirtualDevice {
                                    id: udid.to_string(),
                                    name: format!("{} ({})", name, runtime),
                                    platform: "ios".to_string(),
                                    state: Some(state.to_string()),
                                });
                            }
                        }
                    }
                }
            }
        }
        
        Ok(DeviceResponse {
            success: true,
            data: Some(simulators),
            error: None,
        })
    } else {
        Ok(DeviceResponse {
            success: true,
            data: Some(Vec::new()),
            error: None,
        })
    }
}

#[tauri::command]
pub async fn launch_android_emulator(app_handle: tauri::AppHandle, emulator_id: String) -> Result<DeviceResponse<String>, String> {
    log::info!("Launching Android emulator: {}", emulator_id);
    
    let shell = app_handle.shell();
    
    // Launch emulator in background
    let command = shell.command("emulator")
        .args(["-avd", &emulator_id]);
    
    match command.spawn() {
        Ok(_) => Ok(DeviceResponse {
            success: true,
            data: Some(format!("Emulator {} launched", emulator_id)),
            error: None,
        }),
        Err(e) => Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(format!("Failed to launch emulator: {}", e)),
        }),
    }
}

#[tauri::command]
pub async fn launch_ios_simulator(app_handle: tauri::AppHandle, simulator_id: String) -> Result<DeviceResponse<String>, String> {
    log::info!("Launching iOS simulator: {}", simulator_id);
    
    let shell = app_handle.shell();
    let output = shell.command("xcrun")
        .args(["simctl", "boot", &simulator_id])
        .output()
        .await;
    
    match output {
        Ok(result) => {
            if result.status.success() || String::from_utf8_lossy(&result.stderr).contains("already booted") {
                // Open Simulator app
                let _ = shell.command("open")
                    .args(["-a", "Simulator"])
                    .output()
                    .await;
                
                Ok(DeviceResponse {
                    success: true,
                    data: Some(format!("Simulator {} launched", simulator_id)),
                    error: None,
                })
            } else {
                let stderr = String::from_utf8_lossy(&result.stderr);
                Ok(DeviceResponse {
                    success: false,
                    data: None,
                    error: Some(format!("Failed to launch simulator: {}", stderr)),
                })
            }
        }
        Err(e) => Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(format!("Failed to execute simctl: {}", e)),
        }),
    }
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

// Push database file back to iOS device
#[tauri::command] 
pub async fn device_push_ios_database_file(
    device_id: String,
    local_path: String,
    package_name: String,
    remote_path: String,
) -> Result<DeviceResponse<String>, String> {
    log::info!("Pushing database file {} to iOS device: {}", local_path, device_id);
    
    // Determine if it's a physical device (has UUID format) or simulator
    let is_device = device_id.len() == 40 && device_id.chars().all(|c| c.is_ascii_hexdigit() || c == '-');
    
    match push_ios_db_file(&device_id, &local_path, &package_name, &remote_path, is_device).await {
        Ok(message) => Ok(DeviceResponse {
            success: true,
            data: Some(message),
            error: None,
        }),
        Err(e) => Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(format!("Failed to push iOS database file: {}", e)),
        }),
    }
}
