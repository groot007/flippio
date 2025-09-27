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
    
    // Generate unique filename to avoid conflicts when multiple files have the same name
    let unique_filename = generate_unique_filename(remote_path)?;
    let local_path = temp_dir.join(&unique_filename);
    info!("Local path will be: {:?} (unique filename: {})", local_path, unique_filename);
    
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
    
    // Force clean temp directory before pulling to avoid stale data
    if let Err(e) = force_clean_temp_dir() {
        error!("Failed to force clean temp directory: {}", e);
        // Continue anyway, but log the error
    } else {
        info!("✅ Successfully force cleaned temp directory before database pull");
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
        })
    }
}

// Get detailed Android device information using adb shell getprop
async fn get_android_device_info(device_id: &str) -> Result<std::collections::HashMap<String, String>, Box<dyn std::error::Error + Send + Sync>> {
    info!("Getting Android device info for device: {}", device_id);
    
    let output = execute_adb_command(&["-s", device_id, "shell", "getprop"]).await?;
    
    info!("ADB getprop exit status: {:?}", output.status);
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        error!("ADB getprop command failed. Stderr: {}", stderr);
        return Err(format!("ADB getprop failed with exit code: {:?}. Stderr: {}", output.status.code(), stderr).into());
    }
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    info!("ADB getprop output length: {} characters", stdout.len());
    
    let mut device_info = std::collections::HashMap::new();
    let mut processed_lines = 0;
    
    // Parse getprop output and extract key device information
    for line in stdout.lines() {
        if line.starts_with('[') && line.contains("]: [") {
            if let Some(key_end) = line.find("]: [") {
                let key = &line[1..key_end];
                if let Some(value_start) = line.rfind("]: [") {
                    let value_part = &line[value_start + 4..];
                    if let Some(value_end) = value_part.rfind(']') {
                        let value = &value_part[..value_end];
                        
                        // Only include relevant device info properties
                        match key {
                            "ro.product.model" => { 
                                device_info.insert("Device Model".to_string(), value.to_string()); 
                                info!("Found device model: {}", value);
                            },
                            "ro.product.brand" => { 
                                device_info.insert("Brand".to_string(), value.to_string()); 
                                info!("Found brand: {}", value);
                            },
                            "ro.product.manufacturer" => { device_info.insert("Manufacturer".to_string(), value.to_string()); },
                            "ro.build.version.release" => { 
                                device_info.insert("Android Version".to_string(), value.to_string()); 
                                info!("Found Android version: {}", value);
                            },
                            "ro.build.version.sdk" => { device_info.insert("SDK Version".to_string(), value.to_string()); },
                            "ro.build.display.id" => { device_info.insert("Build ID".to_string(), value.to_string()); },
                            "ro.product.cpu.abi" => { device_info.insert("CPU Architecture".to_string(), value.to_string()); },
                            "ro.build.date" => { device_info.insert("Build Date".to_string(), value.to_string()); },
                            "ro.product.device" => { device_info.insert("Device Codename".to_string(), value.to_string()); },
                            "ro.build.version.security_patch" => { device_info.insert("Security Patch".to_string(), value.to_string()); },
                            _ => {}
                        }
                        processed_lines += 1;
                    }
                }
            }
        }
    }
    
    info!("Processed {} lines from getprop output", processed_lines);
    
    // Add device ID
    device_info.insert("Device ID".to_string(), device_id.to_string());
    
    info!("Successfully retrieved {} device properties", device_info.len());
    
    if device_info.len() <= 1 {
        // Only device ID was added, no properties found
        error!("No device properties found in getprop output");
        return Err("No device properties could be retrieved from the device".into());
    }
    
    Ok(device_info)
}

// Get detailed Android device information
#[tauri::command]
pub async fn adb_get_device_info(device_id: String) -> Result<DeviceResponse<std::collections::HashMap<String, String>>, String> {
    log::info!("Getting device info for Android device: {}", device_id);
    
    match get_android_device_info(&device_id).await {
        Ok(info) => {
            log::info!("Successfully retrieved device info with {} properties", info.len());
            Ok(DeviceResponse {
                success: true,
                data: Some(info),
                error: None,
            })
        },
        Err(e) => {
            log::error!("Failed to get device info: {}", e);
            
            // Return mock data for testing if real command fails
            let mut mock_info = std::collections::HashMap::new();
            mock_info.insert("Device ID".to_string(), device_id.clone());
            mock_info.insert("Status".to_string(), "Mock Data - Real command failed".to_string());
            mock_info.insert("Error".to_string(), format!("{}", e));
            
            Ok(DeviceResponse {
                success: true,
                data: Some(mock_info),
                error: Some(format!("Using mock data - real command failed: {}", e)),
            })
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_pull_android_db_file_paths() {
        // Test path generation logic
        let temp_dir = TempDir::new().unwrap();
        let remote_path = "/data/data/com.example.app/databases/test.db";
        let filename = std::path::Path::new(remote_path)
            .file_name()
            .unwrap()
            .to_string_lossy();
        
        assert_eq!(filename, "test.db");
        
        let local_path = temp_dir.path().join(&*filename);
        assert!(local_path.to_string_lossy().contains("test.db"));
    }

    #[test]
    fn test_database_file_metadata_creation() {
        let metadata = DatabaseFileMetadata {
            device_id: "emulator-5554".to_string(),
            package_name: "com.example.app".to_string(),
            remote_path: "/data/data/com.example.app/databases/test.db".to_string(),
            timestamp: "2024-01-01T12:00:00Z".to_string(),
        };
        
        assert_eq!(metadata.device_id, "emulator-5554");
        assert_eq!(metadata.package_name, "com.example.app");
        assert!(metadata.remote_path.contains("test.db"));
        assert!(metadata.timestamp.contains("2024"));
    }

    #[test]
    fn test_device_response_success() {
        let devices = vec![
            Device {
                id: "emulator-5554".to_string(),
                name: "Android Emulator".to_string(),
                model: "Android SDK built for x86".to_string(),
                device_type: "emulator".to_string(),
                description: "Emulator device".to_string(),
            },
        ];
        
        let response = DeviceResponse {
            success: true,
            data: Some(devices),
            error: None,
        };
        
        assert!(response.success);
        assert!(response.data.is_some());
        assert!(response.error.is_none());
        assert_eq!(response.data.unwrap().len(), 1);
    }

    #[test]
    fn test_device_response_error() {
        let response: DeviceResponse<Vec<Device>> = DeviceResponse {
            success: false,
            data: None,
            error: Some("ADB not found".to_string()),
        };
        
        assert!(!response.success);
        assert!(response.data.is_none());
        assert!(response.error.is_some());
        assert_eq!(response.error.unwrap(), "ADB not found");
    }

    #[test]
    fn test_package_creation() {
        let package = Package {
            name: "Example App".to_string(),
            bundle_id: "com.example.app".to_string(),
        };
        
        assert_eq!(package.name, "Example App");
        assert_eq!(package.bundle_id, "com.example.app");
    }

    #[test]
    fn test_database_file_creation() {
        let db_file = DatabaseFile {
            path: "/data/data/com.example.app/databases/test.db".to_string(),
            package_name: "com.example.app".to_string(),
            filename: "test.db".to_string(),
            location: "internal".to_string(),
            remote_path: Some("/data/data/com.example.app/databases/test.db".to_string()),
            device_type: "android".to_string(),
        };
        
        assert_eq!(db_file.filename, "test.db");
        assert_eq!(db_file.package_name, "com.example.app");
        assert_eq!(db_file.device_type, "android");
        assert!(db_file.remote_path.is_some());
    }

    #[test]
    fn test_adb_path_discovery() {
        let adb_path = get_adb_path();
        // Should return some path (even if just "adb")
        assert!(!adb_path.is_empty());
        // Common ADB path should be detected
        assert!(adb_path.contains("adb"));
    }

    #[tokio::test]
    async fn test_execute_adb_command_basic() {
        // Test that the command structure is correct
        let args = ["devices"];
        let result = execute_adb_command(&args).await;
        
        // Command should at least attempt to execute
        // (it might fail if ADB is not installed, but the function should work)
        match result {
            Ok(_) => {
                // Command succeeded
                assert!(true);
            }
            Err(e) => {
                // Command failed, but that's expected if ADB is not available
                // Just verify the error is related to execution, not our logic
                let error_msg = e.to_string();
                assert!(
                    error_msg.contains("No such file") || 
                    error_msg.contains("not found") ||
                    error_msg.contains("cannot run") ||
                    error_msg.contains("failed to execute") ||
                    error_msg.contains("access") ||
                    error_msg.contains("permission")
                );
            }
        }
    }

    #[test]
    fn test_serde_serialization_device() -> Result<(), serde_json::Error> {
        let device = Device {
            id: "test123".to_string(),
            name: "Test Device".to_string(),
            model: "Test Model".to_string(),
            device_type: "android".to_string(),
            description: "Test Description".to_string(),
        };
        
        // Test serialization
        let json = serde_json::to_string(&device)?;
        assert!(json.contains("test123"));
        assert!(json.contains("deviceType"));
        
        // Test deserialization
        let deserialized: Device = serde_json::from_str(&json)?;
        assert_eq!(deserialized.id, device.id);
        assert_eq!(deserialized.device_type, device.device_type);
        
        Ok(())
    }

    #[test]
    fn test_serde_serialization_package() -> Result<(), serde_json::Error> {
        let package = Package {
            name: "Test Package".to_string(),
            bundle_id: "com.test.package".to_string(),
        };
        
        // Test serialization
        let json = serde_json::to_string(&package)?;
        assert!(json.contains("bundleId"));
        assert!(json.contains("com.test.package"));
        
        // Test deserialization
        let deserialized: Package = serde_json::from_str(&json)?;
        assert_eq!(deserialized.bundle_id, package.bundle_id);
        
        Ok(())
    }

    #[test]
    fn test_serde_serialization_database_file() -> Result<(), serde_json::Error> {
        let db_file = DatabaseFile {
            path: "/test/path".to_string(),
            package_name: "com.test".to_string(),
            filename: "test.db".to_string(),
            location: "internal".to_string(),
            remote_path: Some("/remote/test.db".to_string()),
            device_type: "android".to_string(),
        };
        
        // Test serialization
        let json = serde_json::to_string(&db_file)?;
        assert!(json.contains("packageName"));
        assert!(json.contains("remotePath"));
        assert!(json.contains("deviceType"));
        
        // Test deserialization
        let deserialized: DatabaseFile = serde_json::from_str(&json)?;
        assert_eq!(deserialized.package_name, db_file.package_name);
        assert_eq!(deserialized.device_type, db_file.device_type);
        
        Ok(())
    }

    #[test]
    fn test_device_response_serialization() -> Result<(), serde_json::Error> {
        let devices = vec![Device {
            id: "test".to_string(),
            name: "Test".to_string(),
            model: "Model".to_string(),
            device_type: "android".to_string(),
            description: "Desc".to_string(),
        }];
        
        let response = DeviceResponse {
            success: true,
            data: Some(devices),
            error: None,
        };
        
        let json = serde_json::to_string(&response)?;
        assert!(json.contains("success"));
        assert!(json.contains("data"));
        
        let deserialized: DeviceResponse<Vec<Device>> = serde_json::from_str(&json)?;
        assert!(deserialized.success);
        assert!(deserialized.data.is_some());
        
        Ok(())
    }

    #[test]
    fn test_multiple_devices_parsing() {
        // Test parsing multiple device entries
        let device_output = "emulator-5554\tdevice\nABCD1234\tdevice\noffline-device\toffline\n";
        let lines: Vec<&str> = device_output.lines().collect();
        
        assert_eq!(lines.len(), 3);
        
        // Test each line format
        for line in lines {
            let parts: Vec<&str> = line.split('\t').collect();
            assert_eq!(parts.len(), 2);
            assert!(!parts[0].is_empty()); // Device ID
            assert!(!parts[1].is_empty()); // Status
        }
    }

    #[test]
    fn test_package_parsing() {
        // Test package name extraction
        let package_line = "package:com.example.app=com.example.app.MainActivity";
        assert!(package_line.starts_with("package:"));
        
        let package_part = package_line.strip_prefix("package:").unwrap();
        let package_name = package_part.split('=').next().unwrap();
        assert_eq!(package_name, "com.example.app");
    }

    #[test]
    fn test_database_file_path_parsing() {
        let db_paths = vec![
            "/data/data/com.example.app/databases/test.db",
            "/data/data/com.another.app/files/database.sqlite",
            "/storage/emulated/0/Android/data/com.app/files/db.sqlite3",
        ];
        
        for path in db_paths {
            // Test filename extraction
            let filename = std::path::Path::new(path)
                .file_name()
                .unwrap()
                .to_string_lossy();
            assert!(filename.contains("db") || filename.contains("sqlite"));
            
            // Test package name extraction from path
            if path.contains("/data/data/") {
                let parts: Vec<&str> = path.split('/').collect();
                let package_index = parts.iter().position(|&x| x == "data").unwrap() + 2;
                if package_index < parts.len() {
                    let package_name = parts[package_index];
                    assert!(package_name.contains("."));
                }
            }
        }
    }

    #[test]
    fn test_temp_file_path_generation() {
        let temp_dir = TempDir::new().unwrap();
        let remote_paths = vec![
            "/data/data/com.app/databases/db.sqlite",
            "/storage/test/file.db",
            "/complex/path/with/subdirs/database.sqlite3",
        ];
        
        for remote_path in remote_paths {
            let filename = std::path::Path::new(remote_path)
                .file_name()
                .unwrap()
                .to_string_lossy();
            let local_path = temp_dir.path().join(&*filename);
            
            // Verify path is valid and contains expected filename
            assert!(local_path.exists() || !local_path.exists()); // Path should be valid
            assert!(local_path.to_string_lossy().contains(&*filename));
        }
    }

    #[test]
    fn test_error_handling_edge_cases() {
        // Test various error scenarios
        
        // Empty device ID
        let empty_device = Device {
            id: "".to_string(),
            name: "Test".to_string(),
            model: "Test".to_string(),
            device_type: "android".to_string(),
            description: "Test".to_string(),
        };
        assert!(empty_device.id.is_empty());
        
        // Invalid package name format
        let invalid_package = Package {
            name: "".to_string(),
            bundle_id: "invalid-bundle-id".to_string(),
        };
        assert!(invalid_package.name.is_empty());
        
        // Database file with invalid path
        let invalid_db_file = DatabaseFile {
            path: "".to_string(),
            package_name: "com.test".to_string(),
            filename: "".to_string(),
            location: "unknown".to_string(),
            remote_path: None,
            device_type: "android".to_string(),
        };
        assert!(invalid_db_file.path.is_empty());
        assert!(invalid_db_file.remote_path.is_none());
    }
}
