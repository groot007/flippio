use super::types::*;
use super::helpers::*;
use tauri::{State};
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
    info!("=== PULL iOS DB FILE STARTED ===");
    info!("Device ID: {}", device_id);
    info!("Package name: {}", package_name);
    info!("Remote path: {}", remote_path);
    info!("Is device (not simulator): {}", is_device);
    
    info!("Step 1: Creating temporary directory");
    let temp_dir = ensure_temp_dir()?;
    info!("✅ Temp directory: {}", temp_dir.display());
    
    info!("Step 2: Extracting filename from remote path");
    let filename = Path::new(remote_path).file_name()
        .ok_or("Invalid remote path")?
        .to_string_lossy();
    let local_path = temp_dir.join(&*filename);
    info!("✅ Local target path: {}", local_path.display());
    
    // Construct iOS command
    info!("Step 3: Constructing pull command");
    let ios_cmd = if is_device {
        info!("Using physical iOS device mode");
        // For physical iOS devices - use bundled afcclient
        let afcclient_path = get_libimobiledevice_tool_path("afcclient");
        let afcclient_cmd = afcclient_path
            .as_ref()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "afcclient".to_string());
        
        info!("afcclient path: {}", afcclient_cmd);
        let cmd = format!("{} --documents {} -u {} get {} {}", 
                afcclient_cmd, package_name, device_id, remote_path, local_path.display());
        info!("Device pull command: {}", cmd);
        cmd
    } else {
        info!("Using iOS simulator mode");
        let cmd = format!("xcrun simctl spawn {} cat {} > {}", 
                device_id, remote_path, local_path.display());
        info!("Simulator pull command: {}", cmd);
        cmd
    };
    
    info!("Step 4: Executing pull command");
    let output = std::process::Command::new("sh")
        .arg("-c")
        .arg(&ios_cmd)
        .output()?;
    
    info!("Command exit status: {:?}", output.status);
    if !output.stdout.is_empty() {
        info!("Command stdout: {}", String::from_utf8_lossy(&output.stdout));
    }
    if !output.stderr.is_empty() {
        info!("Command stderr: {}", String::from_utf8_lossy(&output.stderr));
    }
    
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        error!("❌ Pull command failed with error: {}", error_msg);
        return Err(format!("iOS pull failed: {}", error_msg).into());
    }
    
    info!("✅ Pull command executed successfully");
    
    info!("Step 5: Verifying pulled file exists and has valid content");
    if !local_path.exists() {
        error!("❌ Pulled file does not exist at: {}", local_path.display());
        return Err("Pulled file was not created".into());
    }
    
    match std::fs::metadata(&local_path) {
        Ok(metadata) => {
            info!("✅ Pulled file size: {} bytes", metadata.len());
            if metadata.len() == 0 {
                error!("❌ Pulled file is empty");
                return Err("Pulled file is empty".into());
            }
            
            // Quick check if it looks like a SQLite file (for database files)
            if metadata.len() >= 16 {
                if let Ok(mut file) = std::fs::File::open(&local_path) {
                    use std::io::Read;
                    let mut header = [0u8; 16];
                    if let Ok(_) = file.read_exact(&mut header) {
                        let header_str = String::from_utf8_lossy(&header[..15]);
                        if header_str.starts_with("SQLite format") {
                            info!("✅ File appears to be a valid SQLite database");
                        } else {
                            info!("⚠️  File does not appear to be SQLite (header: {})", header_str);
                        }
                    }
                }
            }
        }
        Err(e) => {
            error!("❌ Cannot read pulled file metadata: {}", e);
            return Err(format!("Cannot access pulled file: {}", e).into());
        }
    }
    
    info!("Step 6: Storing metadata for pulled file");
    // Store metadata
    let metadata = DatabaseFileMetadata {
        device_id: device_id.to_string(),
        package_name: package_name.to_string(),
        remote_path: remote_path.to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    };
    
    let metadata_path = format!("{}.meta.json", local_path.display());
    info!("Metadata will be stored at: {}", metadata_path);
    let metadata_json = serde_json::to_string_pretty(&metadata)?;
    fs::write(&metadata_path, metadata_json)?;
    info!("✅ Metadata stored successfully");
    
    let final_path = local_path.to_string_lossy().to_string();
    info!("=== PULL iOS DB FILE COMPLETED SUCCESSFULLY ===");
    info!("Final local file path: {}", final_path);
    
    Ok(final_path)
}


pub fn get_libimobiledevice_tool_path(tool_name: &str) -> Option<std::path::PathBuf> {
    if let Ok(exe_path) = std::env::current_exe() {
        log::info!("[libimobiledevice] current_exe: {:?}", exe_path);

        if let Some(exe_dir) = exe_path.parent() {
            // ✅ 1. Production: Contents/MacOs/<tool>
            if let Some(resources_path) = exe_dir
                .parent() // Contents/
                .map(|p| p.join("MacOs").join(tool_name))
            {
                if resources_path.exists() {
                    log::info!(
                        "[libimobiledevice] Using bundled '{}' from Contents/MacOs/: {:?}",
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
                
                // Parse the JSON output from
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
pub async fn get_ios_device_database_files(
    app_handle: tauri::AppHandle,
    device_id: String,
    package_name: String,
) -> Result<DeviceResponse<Vec<DatabaseFile>>, String> {
    log::info!("=== GET iOS DEVICE DATABASE FILES STARTED ===");
    log::info!("Device ID: {}", device_id);
    log::info!("Package name: {}", package_name);
    
    info!("Step 1: Cleaning temporary directory");
    // Clean temp directory before pulling new files
    if let Err(e) = clean_temp_dir() {
        log::warn!("❌ Failed to clean temp directory: {}", e);
    } else {
        log::info!("✅ Successfully cleaned temp directory before pulling new files");
    }
    
    let shell = app_handle.shell();
    let mut database_files = Vec::new();

    info!("Step 2: Scanning iOS app data locations for database files");
    // Search in common iOS app data locations
    let locations = vec!["Documents"];
    info!("Locations to scan: {:?}", locations);
    
    for (loc_index, location) in locations.iter().enumerate() {
        info!("Step 2.{}: Scanning location '{}'", loc_index + 1, location);
        
        // Use bundled afcclient tool to list files in the app's container
        let afcclient_path = get_libimobiledevice_tool_path("afcclient");
        info!("🔧 afcclient tool detection:");
        info!("  Tool path result: {:?}", afcclient_path);

        let afcclient_cmd = afcclient_path
            .as_ref()
            .map(|p| {
                let cmd = p.to_string_lossy().to_string();
                info!("  Using resolved path: {}", cmd);
                cmd
            })
            .unwrap_or_else(|| {
                info!("  Falling back to system afcclient");
                "afcclient".to_string()
            });
        
        info!("  Final command: {}", afcclient_cmd);
        
        // Check if the tool is executable
        if let Some(path) = &afcclient_path {
            match std::fs::metadata(path) {
                Ok(metadata) => {
                    info!("  Tool file exists: {} bytes", metadata.len());
                    #[cfg(unix)]
                    {
                        use std::os::unix::fs::PermissionsExt;
                        let mode = metadata.permissions().mode();
                        info!("  Tool permissions: {:o}", mode);
                        if mode & 0o111 != 0 {
                            info!("  ✅ Tool is executable");
                        } else {
                            error!("  ❌ Tool is not executable!");
                        }
                    }
                }
                Err(e) => {
                    error!("  ❌ Cannot access tool file: {}", e);
                }
            }
        }
        
        let cmd_args = ["--documents", &package_name, "-u", &device_id, "ls", location];
        info!("Executing afcclient command:");
        info!("  Command: {}", afcclient_cmd);
        info!("  Arguments: {:?}", cmd_args);
        info!("  Full command line: {} {}", afcclient_cmd, cmd_args.join(" "));
        
        let output = shell.command(&afcclient_cmd)
            .args(cmd_args)
            .output()
            .await;
        
        match output {
            Ok(result) => {
                info!("Command exit status: {:?}", result.status);
                if !result.stdout.is_empty() {
                    info!("Command stdout: {}", String::from_utf8_lossy(&result.stdout));
                }
                if !result.stderr.is_empty() {
                    info!("Command stderr: {}", String::from_utf8_lossy(&result.stderr));
                }
                
                if result.status.success() {
                    let files_output = String::from_utf8_lossy(&result.stdout);
                    info!("📄 Raw file listing output:");
                    info!("'{}'", files_output);
                    info!("📊 Total lines in output: {}", files_output.lines().count());
                    
                    let mut found_files = Vec::new();
                    let mut all_files_listed = Vec::new();
                    
                    info!("🔍 Parsing file list from location '{}'", location);
                    for (line_num, file) in files_output.lines().enumerate() {
                        let file = file.trim();
                        all_files_listed.push(file.to_string());
                        info!("  Line {}: '{}'", line_num + 1, file);
                        
                        if !file.is_empty() {
                            if file.ends_with(".db") || file.ends_with(".sqlite") || file.ends_with(".sqlite3") {
                                let remote_path = format!("/{}/{}", location, file);
                                info!("✅ Found database file: {}", remote_path);
                                found_files.push(remote_path);
                            } else {
                                info!("   ↳ Not a database file (extension check failed)");
                            }
                        } else {
                            info!("   ↳ Empty line, skipping");
                        }
                    }
                    
                    info!("📋 All files found: {:?}", all_files_listed);
                    info!("🗄️ Database files found: {:?}", found_files);
                    info!("📊 Summary: {} total files, {} database files in location '{}'", all_files_listed.len(), found_files.len(), location);
                
                    info!("Step 3.{}: Pulling database files from location '{}'", loc_index + 1, location);
                    // Pull each found database file to local temp directory
                    for (file_index, remote_path) in found_files.iter().enumerate() {
                        info!("Step 3.{}.{}: Pulling file '{}'", loc_index + 1, file_index + 1, remote_path);
                        
                        match pull_ios_db_file(&device_id, &package_name, &remote_path, true).await {
                            Ok(local_path) => {
                                info!("✅ Successfully pulled file to: {}", local_path);
                                let filename = std::path::Path::new(&remote_path)
                                    .file_name()
                                    .and_then(|n| n.to_str())
                                    .unwrap_or("unknown")
                                    .to_string();
                                
                                let db_file = DatabaseFile {
                                    path: local_path,
                                    package_name: package_name.clone(),
                                    filename,
                                    remote_path: Some(remote_path.clone()),
                                    location: location.to_string(),
                                    device_type: "iphone-device".to_string(),
                                };
                                
                                info!("Database file object created: {:?}", db_file);
                                database_files.push(db_file);
                            }
                            Err(e) => {
                                error!("❌ Failed to pull iOS device database file {}: {}", remote_path, e);
                                error!("Adding file to list with remote path for fallback access");
                                // Still add the file with remote path for fallback
                                let filename = std::path::Path::new(&remote_path)
                                    .file_name()
                                    .and_then(|n| n.to_str())
                                    .unwrap_or("unknown")
                                    .to_string();
                                
                                let fallback_db_file = DatabaseFile {
                                    path: remote_path.clone(),
                                    package_name: package_name.clone(),
                                    filename,
                                    remote_path: Some(remote_path.clone()),
                                    location: location.to_string(),
                                    device_type: "iphone-device".to_string(),
                                };
                                
                                info!("Fallback database file object created: {:?}", fallback_db_file);
                                database_files.push(fallback_db_file);
                        }
                    }
                }
                } else {
                    // Listing failed - this can happen due to iOS security restrictions
                    let stderr = String::from_utf8_lossy(&result.stderr);
                    error!("❌ Directory listing failed for location '{}': {}", location, stderr);
                    if stderr.contains("Permission denied") {
                        info!("📱 App may allow file uploads but restrict directory browsing due to iOS security settings");
                        info!("💡 Files can still be pushed to the device even if listing is not possible");
                    }
                }
            }
            Err(e) => {
                // Command execution failed
                error!("❌ Failed to execute afcclient ls command for location '{}': {}", location, e);
            }
        }
    }
    
    info!("=== GET iOS DEVICE DATABASE FILES COMPLETED ===");
    info!("📊 Final Results Summary:");
    info!("  Total database files found: {}", database_files.len());
    info!("  Device ID: {}", device_id);
    info!("  Package name: {}", package_name);
    
    if database_files.is_empty() {
        error!("⚠️  No database files found! This could mean:");
        error!("   1. The app doesn't have any database files");
        error!("   2. Database files are in different locations not being scanned");
        error!("   3. afcclient command is not working properly");
        error!("   4. Permission issues preventing file access");
    } else {
        info!("✅ Database files found:");
        for (index, db_file) in database_files.iter().enumerate() {
            info!("  File {}: {}", index + 1, db_file.filename);
            info!("    ↳ Local path: {}", db_file.path);
            info!("    ↳ Remote path: {:?}", db_file.remote_path);
            info!("    ↳ Location: {}", db_file.location);
            info!("    ↳ Device type: {}", db_file.device_type);
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
    
    // Check if local file exists first
    if !std::path::Path::new(&local_path).exists() {
        error!("Local file does not exist: {}", local_path);
        return Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(format!("Local file does not exist: {}", local_path)),
        });
    }
    
    // Validate that the local file is not empty and appears to be a SQLite file
    match std::fs::metadata(&local_path) {
        Ok(metadata) => {
            if metadata.len() == 0 {
                error!("❌ Local file is empty: {}", local_path);
                return Ok(DeviceResponse {
                    success: false,
                    data: None,
                    error: Some("Local file is empty".to_string()),
                });
            }
            info!("✅ Local file size: {} bytes", metadata.len());
            
            // Quick check if it looks like a SQLite file
            if metadata.len() >= 16 {
                if let Ok(mut file) = std::fs::File::open(&local_path) {
                    use std::io::Read;
                    let mut header = [0u8; 16];
                    if let Ok(_) = file.read_exact(&mut header) {
                        let header_str = String::from_utf8_lossy(&header[..15]);
                        if !header_str.starts_with("SQLite format") {
                            error!("❌ Local file does not appear to be a SQLite database: {}", local_path);
                            error!("File header: {}", header_str);
                            return Ok(DeviceResponse {
                                success: false,
                                data: None,
                                error: Some("Local file is not a valid SQLite database".to_string()),
                            });
                        }
                        info!("✅ Local file appears to be a valid SQLite database");
                    }
                }
            }
        }
        Err(e) => {
            error!("Cannot access local file metadata: {}", e);
            return Ok(DeviceResponse {
                success: false,
                data: None,
                error: Some(format!("Cannot access local file: {}", e)),
            });
        }
    }
    
    info!("Step 3: Starting iOS device push operation");
    info!("Using physical iOS device path (afcclient)");
    
    info!("Step 4: Locating afcclient tool");
    // For physical iOS devices - use bundled afcclient
    let afcclient_path = get_libimobiledevice_tool_path("afcclient");
    let afcclient_cmd = afcclient_path
        .as_ref()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "afcclient".to_string());
    
    info!("afcclient path: {:?}", afcclient_path);
    info!("afcclient command: {}", afcclient_cmd);
    
    // Check if afcclient exists
    if afcclient_path.is_none() {
        error!("❌ afcclient tool not found in expected locations");
        return Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some("afcclient tool not found".to_string()),
        });
    }
    info!("✅ afcclient tool located successfully");
    
    info!("Step 5: Preparing target directory on device");
    // First, try to create the directory structure if it doesn't exist
    let parent_dir = std::path::Path::new(&remote_path).parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "/Documents".to_string());
    
    info!("Ensuring parent directory exists: {}", parent_dir);
    
    // Create directory structure if needed
    let mkdir_cmd = format!("{} --documents {} -u {} mkdir {}", 
                          afcclient_cmd, package_name, device_id, parent_dir);
    
    info!("Running directory creation command: {}", mkdir_cmd);
    
    let mkdir_output = std::process::Command::new("sh")
        .arg("-c")
        .arg(&mkdir_cmd)
        .output()
        .map_err(|e| format!("Failed to execute mkdir command: {}", e))?;
    
    info!("mkdir exit status: {:?}", mkdir_output.status);
    if !mkdir_output.stdout.is_empty() {
        info!("mkdir stdout: {}", String::from_utf8_lossy(&mkdir_output.stdout));
    }
    if !mkdir_output.stderr.is_empty() {
        info!("mkdir stderr: {}", String::from_utf8_lossy(&mkdir_output.stderr));
    }
    
    // Directory creation might fail if it already exists, which is fine
    info!("✅ Directory preparation completed");
    
    info!("Step 6: Implementing robust push flow (delete → verify → upload → verify)");
    // Now implement the robust push flow: delete → verify deletion → upload → verify upload
    
    // Extract target filename for the flow
    let target_filename = std::path::Path::new(&remote_path)
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| "database.db".to_string());
    
    // Step 1: Try to delete existing file first (if it exists)
    info!("Step 6.1: Attempting to delete existing file '{}'", target_filename);
    let delete_cmd = format!("{} --documents {} -u {} rm Documents/{}", 
                            afcclient_cmd, package_name, device_id, target_filename);
    
    info!("Running delete command: {}", delete_cmd);
    let delete_output = std::process::Command::new("sh")
        .arg("-c")
        .arg(&delete_cmd)
        .output()
        .map_err(|e| format!("Failed to execute delete command: {}", e))?;
    
    info!("Delete command exit status: {:?}", delete_output.status);
    if !delete_output.stdout.is_empty() {
        info!("Delete command stdout: {}", String::from_utf8_lossy(&delete_output.stdout));
    }
    if !delete_output.stderr.is_empty() {
        info!("Delete command stderr: {}", String::from_utf8_lossy(&delete_output.stderr));
    }
    
    if delete_output.status.success() {
        info!("✅ Existing file deleted successfully");
    } else {
        info!("ℹ️  File deletion failed (file may not exist) - continuing with upload");
    }
    
    // Step 2: Verify file is not present before upload
    info!("Step 6.2: Verifying file is not present before upload");
    let pre_check_cmd = format!("{} --documents {} -u {} ls Documents", 
                              afcclient_cmd, package_name, device_id);
    
    info!("Running pre-upload verification: {}", pre_check_cmd);
    let pre_check_output = std::process::Command::new("sh")
        .arg("-c")
        .arg(&pre_check_cmd)
        .output()
        .map_err(|e| format!("Failed to execute pre-check command: {}", e))?;
    
    info!("Pre-check exit status: {:?}", pre_check_output.status);
    if pre_check_output.status.success() {
        let files_list = String::from_utf8_lossy(&pre_check_output.stdout);
        info!("📂 Files in Documents before upload: {}", files_list.trim());
        
        if files_list.contains(&target_filename) {
            info!("⚠️  File '{}' still present after deletion attempt", target_filename);
        } else {
            info!("✅ Confirmed: File '{}' is not present, ready for upload", target_filename);
        }
    } else {
        info!("⚠️  Cannot verify pre-upload state due to listing restrictions");
    }
    
    // Step 3: Upload the file
    info!("Step 6.3: Uploading file to device");
    // Fix: afcclient requires full path with Documents/ prefix for uploads
    let ios_target_path = format!("Documents/{}", target_filename);
    
    let ios_cmd = format!("{} --documents {} -u {} put {} {}", 
                          afcclient_cmd, package_name, device_id, local_path, ios_target_path);
    
    info!("Running iOS device push command: {}", ios_cmd);
    info!("Source: {}", local_path);
    info!("Target: {}", ios_target_path);
    
    let output = std::process::Command::new("sh")
        .arg("-c")
        .arg(&ios_cmd)
        .output()
        .map_err(|e| format!("Failed to execute upload command: {}", e))?;
    
    info!("Upload command exit status: {:?}", output.status);
    if !output.stdout.is_empty() {
        info!("Upload command stdout: {}", String::from_utf8_lossy(&output.stdout));
    }
    if !output.stderr.is_empty() {
        info!("Upload command stderr: {}", String::from_utf8_lossy(&output.stderr));
    }
    
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        let stdout_msg = String::from_utf8_lossy(&output.stdout);
        error!("❌ iOS device push failed with stderr: {}", error_msg);
        error!("❌ iOS device push stdout: {}", stdout_msg);
        return Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(format!("iOS device push failed: {}\nstdout: {}", error_msg, stdout_msg)),
        });
    } else {
        info!("✅ iOS device push command completed successfully");
        
        // Step 4: Verify the file was uploaded successfully
        info!("Step 6.4: Verifying file upload by listing Documents directory");
        let verify_cmd = format!("{} --documents {} -u {} ls Documents", 
                               afcclient_cmd, package_name, device_id);
        
        info!("Running verification command: {}", verify_cmd);
        let verify_output = std::process::Command::new("sh")
            .arg("-c")
            .arg(&verify_cmd)
            .output()
            .map_err(|e| format!("Failed to execute verify command: {}", e))?;
        
        info!("Verification command exit status: {:?}", verify_output.status);
        if verify_output.status.success() {
            let files_list = String::from_utf8_lossy(&verify_output.stdout);
            info!("📂 Current files in Documents: {}", files_list.trim());
            
            if files_list.contains(&target_filename) {
                info!("✅ Upload verified: File '{}' is now present in Documents directory", target_filename);
            } else {
                info!("⚠️  Upload verification failed: File '{}' not found in Documents directory", target_filename);
                info!("📋 Available files: {}", files_list.trim());
            }
        } else {
            // Note: Some iOS apps allow file uploads but restrict directory listing
            info!("📝 File upload completed - verification via listing may not be possible due to app permissions");
            let stderr = String::from_utf8_lossy(&verify_output.stderr);
            if !stderr.is_empty() {
                info!("Verification stderr: {}", stderr);
            }
            if stderr.contains("Permission denied") {
                info!("🔒 Directory listing restricted by app permissions, but upload should have succeeded");
            }
        }
    }
    
    info!("=== DEVICE PUSH iOS DATABASE FILE COMPLETED SUCCESSFULLY ===");
    
    Ok(DeviceResponse {
        success: true,
        data: Some(format!("Database successfully pushed to {}", remote_path)),
        error: None,
    })
}

#[tauri::command]
pub async fn upload_simulator_ios_db_file(
    _app_handle: tauri::AppHandle,
    device_id: String,
    local_file_path: String,
    package_name: String,
    remote_location: String,
    db_pool_state: State<'_, crate::commands::database::DbPool>,
) -> Result<DeviceResponse<String>, String> {
    log::info!("=== UPLOAD SIMULATOR iOS DB FILE STARTED ===");
    log::info!("Device ID: {}", device_id);
    log::info!("Local file path: {}", local_file_path);
    log::info!("Package name: {}", package_name);
    log::info!("Remote location: {}", remote_location);
    
    info!("Step 0: Ensuring database connection is closed to prevent file locks");
    // Close any existing database connection to prevent file locks during copy
    {
        let mut pool_guard = db_pool_state.write().await;
        if let Some(pool) = pool_guard.take() {
            info!("🔒 Closing active database connection before file operations");
            pool.close().await;
            info!("✅ Database connection closed");
        } else {
            info!("ℹ️  No active database connection to close");
        }
    }
    
    // Small delay to ensure connection is fully closed
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    
    info!("Step 0.5: Checking if source and destination are the same");
    // Check if we're trying to copy file to itself
    let local_path_canonical = match std::fs::canonicalize(&local_file_path) {
        Ok(path) => path,
        Err(e) => {
            error!("❌ Cannot canonicalize local file path: {}", e);
            return Ok(DeviceResponse {
                success: false,
                data: None,
                error: Some(format!("Cannot access local file: {}", e)),
            });
        }
    };
    
    let remote_path_canonical = match std::fs::canonicalize(&remote_location) {
        Ok(path) => path,
        Err(_) => {
            // Remote file might not exist yet, that's ok
            std::path::PathBuf::from(&remote_location)
        }
    };
    
    if local_path_canonical == remote_path_canonical {
        info!("✅ Source and destination are the same file - no copy needed");
        info!("📁 File path: {}", local_path_canonical.display());
        
        // Verify the file exists and has content
        match std::fs::metadata(&local_file_path) {
            Ok(metadata) => {
                if metadata.len() == 0 {
                    error!("❌ File exists but is empty: {}", local_file_path);
                    return Ok(DeviceResponse {
                        success: false,
                        data: None,
                        error: Some("File is empty".to_string()),
                    });
                }
                info!("✅ File already in place with {} bytes", metadata.len());
                return Ok(DeviceResponse {
                    success: true,
                    data: Some("File already in correct location".to_string()),
                    error: None,
                });
            }
            Err(e) => {
                error!("❌ Cannot access file: {}", e);
                return Ok(DeviceResponse {
                    success: false,
                    data: None,
                    error: Some(format!("Cannot access file: {}", e)),
                });
            }
        }
    }
    
    info!("📋 Source: {}", local_path_canonical.display());
    info!("📋 Destination: {}", remote_path_canonical.display());
    log::info!("Local file path: {}", local_file_path);
    log::info!("Package name: {}", package_name);
    log::info!("Remote location: {}", remote_location);
    
    info!("Step 1: Validating local file exists");
    // Check if local file exists first
    if !std::path::Path::new(&local_file_path).exists() {
        error!("❌ Local file does not exist: {}", local_file_path);
        return Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(format!("Local file {} does not exist", local_file_path)),
        });
    }
    info!("✅ Local file exists");
    
    info!("Step 2: Validating local file content");
    // Validate that the local file is not empty and appears to be a SQLite file
    match std::fs::metadata(&local_file_path) {
        Ok(metadata) => {
            if metadata.len() == 0 {
                error!("❌ Local file is empty: {}", local_file_path);
                return Ok(DeviceResponse {
                    success: false,
                    data: None,
                    error: Some("Local file is empty".to_string()),
                });
            }
            info!("✅ Local file size: {} bytes", metadata.len());
            
            // Quick check if it looks like a SQLite file
            if metadata.len() >= 16 {
                if let Ok(mut file) = std::fs::File::open(&local_file_path) {
                    use std::io::Read;
                    let mut header = [0u8; 16];
                    if let Ok(_) = file.read_exact(&mut header) {
                        let header_str = String::from_utf8_lossy(&header[..15]);
                        if !header_str.starts_with("SQLite format") {
                            error!("❌ Local file does not appear to be a SQLite database: {}", local_file_path);
                            error!("File header: {}", header_str);
                            return Ok(DeviceResponse {
                                success: false,
                                data: None,
                                error: Some("Local file is not a valid SQLite database".to_string()),
                            });
                        }
                        info!("✅ Local file appears to be a valid SQLite database");
                    } else {
                        error!("❌ Cannot read file header for validation");
                    }
                } else {
                    error!("❌ Cannot open file for header validation");
                }
            } else {
                info!("⚠️  File too small for SQLite header validation");
            }
        }
        Err(e) => {
            error!("❌ Cannot access local file metadata: {}", e);
            return Ok(DeviceResponse {
                success: false,
                data: None,
                error: Some(format!("Cannot access local file: {}", e)),
            });
        }
    }
    
    info!("Step 3: Starting iOS simulator direct file replacement");
    
    info!("Using iOS simulator mode (direct file replacement)");
    // For iOS simulators - direct file replacement (like Electron)
    // local_file_path is the temp file with changes, remote_location is the original file in simulator
    
    info!("Local source path (edited file): {}", local_file_path);
    info!("Remote target path (original simulator file): {}", remote_location);
    
    info!("Step 4: Verifying target file exists");
    // Check if the destination file exists
    if std::path::Path::new(&remote_location).exists() {
        info!("✅ Target file exists - ready to replace with modified version");
        match std::fs::metadata(&remote_location) {
            Ok(target_metadata) => {
                info!("Target file current size: {} bytes", target_metadata.len());
            }
            Err(e) => {
                info!("⚠️  Cannot read target file metadata: {}", e);
            }
        }
    } else {
        error!("❌ Target file does not exist at: {}", remote_location);
        return Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(format!("Target file does not exist: {}", remote_location)),
        });
    }
    
    info!("Step 5: Creating backup and performing file replacement");
    // Direct file replacement for simulator (simple copy like Electron)
    
    info!("Step 5.1: Creating backup of original file");
    // First, create a backup of the original file
    let backup_path = format!("{}.backup", remote_location);
    info!("Backup path: {}", backup_path);
    
    if let Err(e) = std::fs::copy(&remote_location, &backup_path) {
        error!("❌ Failed to create backup of original file: {}", e);
        return Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(format!("Failed to create backup: {}", e)),
        });
    }
    info!("✅ Created backup at: {}", backup_path);
    
    info!("Step 5.2: Copying modified file to replace original");
    
    // First verify the source file before copying
    match std::fs::metadata(&local_file_path) {
        Ok(source_metadata) => {
            if source_metadata.len() == 0 {
                error!("❌ Source file is empty before copy: {}", local_file_path);
                return Ok(DeviceResponse {
                    success: false,
                    data: None,
                    error: Some("Source file is empty, cannot copy".to_string()),
                });
            }
            info!("✅ Source file size before copy: {} bytes", source_metadata.len());
            info!("🔍 Source file permissions: {:?}", source_metadata.permissions());
            
            // Try to read a small portion of the file to verify it's accessible
            match std::fs::File::open(&local_file_path) {
                Ok(mut file) => {
                    use std::io::Read;
                    let mut buffer = [0u8; 32];
                    match file.read(&mut buffer) {
                        Ok(bytes_read) => {
                            info!("✅ Successfully read {} bytes from source file for validation", bytes_read);
                            if bytes_read > 0 {
                                let header = String::from_utf8_lossy(&buffer[..std::cmp::min(16, bytes_read)]);
                                info!("📄 Source file header: {}", header);
                            }
                        }
                        Err(e) => {
                            error!("❌ Cannot read from source file: {}", e);
                            return Ok(DeviceResponse {
                                success: false,
                                data: None,
                                error: Some(format!("Cannot read source file: {}", e)),
                            });
                        }
                    }
                }
                Err(e) => {
                    error!("❌ Cannot open source file for reading: {}", e);
                    return Ok(DeviceResponse {
                        success: false,
                        data: None,
                        error: Some(format!("Cannot open source file: {}", e)),
                    });
                }
            }
        }
        Err(e) => {
            error!("❌ Cannot access source file before copy: {}", e);
            return Ok(DeviceResponse {
                success: false,
                data: None,
                error: Some(format!("Cannot access source file: {}", e)),
            });
        }
    }
    
    // Check destination directory permissions
    if let Some(parent_dir) = std::path::Path::new(&remote_location).parent() {
        match std::fs::metadata(parent_dir) {
            Ok(dir_metadata) => {
                info!("🔍 Destination directory permissions: {:?}", dir_metadata.permissions());
            }
            Err(e) => {
                error!("❌ Cannot access destination directory: {}", e);
            }
        }
    }
    
    // Check if destination file exists and its current state
    if std::path::Path::new(&remote_location).exists() {
        match std::fs::metadata(&remote_location) {
            Ok(dest_metadata) => {
                info!("📋 Destination file exists, current size: {} bytes", dest_metadata.len());
                info!("🔍 Destination file permissions: {:?}", dest_metadata.permissions());
            }
            Err(e) => {
                error!("❌ Cannot access existing destination file: {}", e);
            }
        }
    } else {
        info!("📋 Destination file does not exist, will be created");
    }
    
    // Try copying with more robust error handling
    let copy_result = std::fs::copy(&local_file_path, &remote_location);
    match copy_result {
        Ok(bytes_copied) => {
            info!("✅ Copy operation completed, {} bytes copied to: {}", bytes_copied, remote_location);
            
            // Check if the copy actually copied any bytes
            if bytes_copied == 0 {
                error!("❌ Copy operation copied 0 bytes! Attempting manual copy");
                
                // Try manual copy as fallback
                let manual_copy_result = manual_file_copy(&local_file_path, &remote_location);
                match manual_copy_result {
                    Ok(manual_bytes) => {
                        info!("✅ Manual copy successful: {} bytes", manual_bytes);
                        
                        // Verify the manual copy worked
                        match std::fs::metadata(&remote_location) {
                            Ok(final_metadata) => {
                                if final_metadata.len() != manual_bytes {
                                    error!("❌ Manual copy size mismatch! Reported: {}, Actual: {}", manual_bytes, final_metadata.len());
                                }
                            }
                            Err(e) => {
                                error!("❌ Cannot verify manual copy result: {}", e);
                            }
                        }
                    }
                    Err(manual_error) => {
                        error!("❌ Manual copy also failed: {}", manual_error);
                        
                        // Try one more approach with a temporary file
                        info!("🔄 Trying copy via temporary file as last resort");
                        let temp_path = format!("{}.tmp", remote_location);
                        
                        match std::fs::copy(&local_file_path, &temp_path) {
                            Ok(temp_bytes) => {
                                if temp_bytes > 0 {
                                    info!("✅ Temporary file copy successful: {} bytes", temp_bytes);
                                    // Move temp file to final location
                                    match std::fs::rename(&temp_path, &remote_location) {
                                        Ok(_) => {
                                            info!("✅ Successfully moved temp file to final location");
                                        }
                                        Err(rename_error) => {
                                            error!("❌ Failed to move temp file: {}", rename_error);
                                            let _ = std::fs::remove_file(&temp_path);
                                            
                                            // Restore from backup and fail
                                            if std::path::Path::new(&backup_path).exists() {
                                                error!("🔄 Attempting to restore from backup");
                                                let _ = std::fs::copy(&backup_path, &remote_location);
                                            }
                                            
                                            return Ok(DeviceResponse {
                                                success: false,
                                                data: None,
                                                error: Some(format!("All copy methods failed. Last error: {}", rename_error)),
                                            });
                                        }
                                    }
                                } else {
                                    error!("❌ Temporary file copy also returned 0 bytes");
                                    let _ = std::fs::remove_file(&temp_path);
                                    
                                    // Restore from backup and fail
                                    if std::path::Path::new(&backup_path).exists() {
                                        error!("🔄 Attempting to restore from backup");
                                        let _ = std::fs::copy(&backup_path, &remote_location);
                                    }
                                    
                                    return Ok(DeviceResponse {
                                        success: false,
                                        data: None,
                                        error: Some("All copy methods failed - all returned 0 bytes".to_string()),
                                    });
                                }
                            }
                            Err(temp_error) => {
                                error!("❌ Temporary file copy failed: {}", temp_error);
                                
                                // Restore from backup and fail
                                if std::path::Path::new(&backup_path).exists() {
                                    error!("🔄 Attempting to restore from backup");
                                    let _ = std::fs::copy(&backup_path, &remote_location);
                                }
                                
                                return Ok(DeviceResponse {
                                    success: false,
                                    data: None,
                                    error: Some(format!("All copy methods failed. Manual: {}, Temp: {}", manual_error, temp_error)),
                                });
                            }
                        }
                    }
                }
            }
            
            info!("Step 5.3: Verifying copied file integrity");
            // Verify the copied file has valid content
            match std::fs::metadata(&remote_location) {
                Ok(metadata) => {
                    if metadata.len() == 0 {
                        error!("❌ Copied file is empty! Restoring from backup");
                        let _ = std::fs::copy(&backup_path, &remote_location);
                        return Ok(DeviceResponse {
                            success: false,
                            data: None,
                            error: Some("Copied file is empty, operation failed".to_string()),
                        });
                    }
                    
                    if metadata.len() != bytes_copied {
                        error!("❌ File size mismatch! Expected: {}, Actual: {}", bytes_copied, metadata.len());
                        let _ = std::fs::copy(&backup_path, &remote_location);
                        return Ok(DeviceResponse {
                            success: false,
                            data: None,
                            error: Some("File size mismatch after copy".to_string()),
                        });
                    }
                    
                    info!("✅ Verified copied file size: {} bytes", metadata.len());
                }
                Err(e) => {
                    error!("❌ Failed to verify copied file: {}", e);
                }
            }
            
            info!("Step 5.4: Cleaning up backup file");
            // Clean up backup file
            if let Err(e) = std::fs::remove_file(&backup_path) {
                info!("⚠️  Could not remove backup file: {}", e);
            } else {
                info!("✅ Backup file removed");
            }
            
            info!("=== UPLOAD SIMULATOR iOS DB FILE COMPLETED SUCCESSFULLY ===");
            
            Ok(DeviceResponse {
                success: true,
                data: Some(format!("File uploaded successfully to {}", remote_location)),
                error: None,
            })
        },
        Err(e) => {
            error!("❌ Failed to replace simulator file: {}", e);
            error!("Source: {}", local_file_path);
            error!("Target: {}", remote_location);
            
            info!("Step 5.5: Attempting to restore from backup due to copy failure");
            // Restore from backup
            if let Err(restore_err) = std::fs::copy(&backup_path, &remote_location) {
                error!("❌ Failed to restore from backup: {}", restore_err);
            } else {
                info!("✅ Successfully restored original file from backup");
            }
            
            info!("Cleaning up backup file");
            let _ = std::fs::remove_file(&backup_path);
            
            Ok(DeviceResponse {
                success: false,
                data: None,
                error: Some(format!("Failed to copy file: {}", e)),
            })
        }
    }
}


#[tauri::command]
pub async fn get_ios_simulator_database_files(
    app_handle: tauri::AppHandle,
    device_id: String,
    package_name: String,
) -> Result<DeviceResponse<Vec<DatabaseFile>>, String> {
    log::info!("=== GET iOS SIMULATOR DATABASE FILES STARTED ===");
    log::info!("Device ID: {}", device_id);
    log::info!("Package name: {}", package_name);
    
    info!("Step 1: Getting iOS simulator app container path");
    let shell = app_handle.shell();
    let mut database_files = Vec::new();
    
    // Get the app's data container path for iOS simulator using xcrun simctl
    info!("Executing: xcrun simctl get_app_container {} {} data", device_id, package_name);
    let output = shell.command("xcrun")
        .args(["simctl", "get_app_container", &device_id, &package_name, "data"])
        .output()
        .await;
    
    match output {
        Ok(result) => {
            info!("simctl get_app_container exit status: {:?}", result.status);
            if !result.stdout.is_empty() {
                info!("simctl stdout: {}", String::from_utf8_lossy(&result.stdout));
            }
            if !result.stderr.is_empty() {
                info!("simctl stderr: {}", String::from_utf8_lossy(&result.stderr));
            }
            
            if result.status.success() {
                let container_path = String::from_utf8_lossy(&result.stdout).trim().to_string();
                info!("✅ Got app container path: {}", container_path);
                
                info!("Step 2: Searching for database files in container");
                // Search for database files in the container using standard find command
                let find_cmd = ["find", &container_path, "-name", "*.db", "-o", "-name", "*.sqlite", "-o", "-name", "*.sqlite3"];
                info!("Executing: {}", find_cmd.join(" "));
                
                let find_output = shell.command("find")
                    .args([&container_path, "-name", "*.db", "-o", "-name", "*.sqlite", "-o", "-name", "*.sqlite3"])
                    .output()
                    .await;
                
                match find_output {
                    Ok(find_result) => {
                        info!("find command exit status: {:?}", find_result.status);
                        if !find_result.stdout.is_empty() {
                            info!("find command stdout: {}", String::from_utf8_lossy(&find_result.stdout));
                        }
                        if !find_result.stderr.is_empty() {
                            info!("find command stderr: {}", String::from_utf8_lossy(&find_result.stderr));
                        }
                        
                        if find_result.status.success() {
                            let files_output = String::from_utf8_lossy(&find_result.stdout);
                            let mut found_files = Vec::new();
                            
                            info!("Step 3: Processing found database files");
                            for file_path in files_output.lines() {
                                let file_path = file_path.trim();
                                if !file_path.is_empty() {
                                    info!("Found database file: {}", file_path);
                                    found_files.push(file_path.to_string());
                                }
                            }
                            
                            info!("Found {} database files total", found_files.len());
                            
                            // Process each found database file
                            for (file_index, file_path) in found_files.iter().enumerate() {
                                info!("Step 3.{}: Processing file '{}'", file_index + 1, file_path);
                                
                                // For iOS simulator, we store the direct file path (no temp copy needed like Electron)
                                // The file_path is already the full path in the simulator container
                                let filename = std::path::Path::new(&file_path)
                                    .file_name()
                                    .and_then(|n| n.to_str())
                                    .unwrap_or("unknown")
                                    .to_string();
                                
                                // Determine relative location from container path
                                let relative_path = file_path.replace(&container_path, "")
                                    .split('/')
                                    .filter(|p| !p.is_empty())
                                    .next()
                                    .unwrap_or("root")
                                    .to_string();
                                
                                info!("File details - filename: {}, relative_path: {}", filename, relative_path);
                                
                                // For iOS simulator, store the direct file path (matching Electron approach)
                                let db_file = DatabaseFile {
                                    path: file_path.clone(), // Use original file path directly, not temp copy
                                    package_name: package_name.clone(),
                                    filename,
                                    remote_path: Some(file_path.clone()),
                                    location: relative_path,
                                    device_type: "ios-simulator".to_string(),
                                };
                                
                                info!("Database file object created: {:?}", db_file);
                                database_files.push(db_file);
                            }
                        } else {
                            error!("❌ find command failed in container path: {}", container_path);
                        }
                    }
                    Err(e) => {
                        error!("❌ Failed to execute find command: {}", e);
                    }
                }
            } else {
                let stderr = String::from_utf8_lossy(&result.stderr);
                error!("❌ Failed to get app container path: {}", stderr);
                if stderr.contains("No such file or directory") || stderr.contains("not found") {
                    info!("💡 App '{}' may not be installed on simulator '{}'", package_name, device_id);
                }
            }
        }
        Err(e) => {
            error!("❌ Failed to execute xcrun simctl command: {}", e);
        }
    }
    
    info!("=== GET iOS SIMULATOR DATABASE FILES COMPLETED ===");
    info!("Total database files found: {}", database_files.len());
    for (index, db_file) in database_files.iter().enumerate() {
        info!("File {}: {} (location: {}, path: {})", 
              index + 1, db_file.filename, db_file.location, db_file.path);
    }
    
    Ok(DeviceResponse {
        success: true,
        data: Some(database_files),
        error: None,
    })
}

/// Manual file copy function as a fallback when std::fs::copy fails
fn manual_file_copy(source: &str, destination: &str) -> Result<u64, std::io::Error> {
    use std::fs::File;
    use std::io::{BufReader, BufWriter, Read, Write};
    
    log::info!("🔧 Starting manual file copy from {} to {}", source, destination);
    
    // Open source file
    let mut source_file = File::open(source).map_err(|e| {
        log::error!("❌ Failed to open source file: {}", e);
        e
    })?;
    
    // Check source file size
    let source_metadata = source_file.metadata().map_err(|e| {
        log::error!("❌ Failed to get source file metadata: {}", e);
        e
    })?;
    log::info!("📏 Source file size for manual copy: {} bytes", source_metadata.len());
    
    if source_metadata.len() == 0 {
        log::error!("❌ Source file is empty for manual copy");
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "Source file is empty"));
    }
    
    // Create destination file
    let mut dest_file = File::create(destination).map_err(|e| {
        log::error!("❌ Failed to create destination file: {}", e);
        e
    })?;
    
    let mut source_reader = BufReader::new(&mut source_file);
    let mut dest_writer = BufWriter::new(&mut dest_file);
    
    let mut buffer = [0u8; 8192]; // 8KB buffer
    let mut total_bytes = 0u64;
    let mut iteration = 0;
    
    loop {
        iteration += 1;
        let bytes_read = source_reader.read(&mut buffer).map_err(|e| {
            log::error!("❌ Failed to read from source at iteration {}: {}", iteration, e);
            e
        })?;
        
        if bytes_read == 0 {
            log::info!("📖 Reached end of source file after {} iterations", iteration);
            break;
        }
        
        dest_writer.write_all(&buffer[..bytes_read]).map_err(|e| {
            log::error!("❌ Failed to write to destination at iteration {}: {}", iteration, e);
            e
        })?;
        
        total_bytes += bytes_read as u64;
        
        // Log progress every 1MB
        if total_bytes % (1024 * 1024) == 0 || iteration % 100 == 0 {
            log::info!("📋 Manual copy progress: {} bytes copied", total_bytes);
        }
    }
    
    log::info!("📝 Flushing destination writer");
    dest_writer.flush().map_err(|e| {
        log::error!("❌ Failed to flush destination writer: {}", e);
        e
    })?;
    
    drop(dest_writer);
    drop(dest_file);
    
    log::info!("💾 Syncing destination file to disk");
    // Sync to ensure data is written to disk
    std::fs::File::open(destination)?.sync_all().map_err(|e| {
        log::error!("❌ Failed to sync destination file: {}", e);
        e
    })?;
    
    log::info!("✅ Manual copy completed: {} bytes total", total_bytes);
    Ok(total_bytes)
}
