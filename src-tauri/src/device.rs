use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::command;

#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize)]
pub struct Device {
    pub id: String,
    pub name: String,
    pub deviceType: String,
    pub status: String,
}

#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize)]
pub struct Package {
    pub name: String,
    pub bundleId: String,
    pub version: Option<String>,
    pub deviceType: String,
}

#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize)]
pub struct DatabaseFile {
    pub path: String,
    pub packageName: String,
    pub filename: String,
    pub location: String,
    pub remotePath: Option<String>,
    pub deviceType: String,
}

#[command]
pub async fn get_devices() -> Result<Vec<Device>, String> {
    println!("🔍 DEBUG: Getting devices...");
    let mut devices = Vec::new();
    
    // Get Android devices
    println!("🔍 DEBUG: Checking for Android devices with ADB...");
    match Command::new("adb").args(&["devices"]).output() {
        Ok(output) => {
            let output_str = String::from_utf8_lossy(&output.stdout);
            for line in output_str.lines().skip(1) {
                if !line.trim().is_empty() && line.contains("\t") {
                    let parts: Vec<&str> = line.split('\t').collect();
                    if parts.len() >= 2 {
                        let device = Device {
                            id: parts[0].to_string(),
                            name: format!("Android ({})", parts[0]),
                            deviceType: "android".to_string(),
                            status: parts[1].to_string(),
                        };
                        devices.push(device);
                    }
                }
            }
        }
        Err(e) => {
            println!("🔍 DEBUG: ADB command failed: {}", e);
            // ADB not available, skip Android devices
        }
    }
    
    // Get iOS simulators
    println!("🔍 DEBUG: Checking for iOS simulators...");
    match Command::new("xcrun")
        .args(&["simctl", "list", "devices", "--json"])
        .output()
    {
        Ok(output) => {
            let output_str = String::from_utf8_lossy(&output.stdout);
            println!("🔍 DEBUG: iOS simulators output length: {} chars", output_str.len());
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&output_str) {
                if let Some(devices_obj) = json.get("devices") {
                    println!("🔍 DEBUG: Found devices object in JSON");
                    for (runtime, device_list) in devices_obj.as_object().unwrap() {
                        if let Some(device_array) = device_list.as_array() {
                            for device in device_array {
                                if let (Some(name), Some(udid), Some(state)) = (
                                    device.get("name").and_then(|v| v.as_str()),
                                    device.get("udid").and_then(|v| v.as_str()),
                                    device.get("state").and_then(|v| v.as_str()),
                                ) {
                                    // Only include booted iOS simulators
                                    if state == "Booted" {
                                        let ios_device = Device {
                                            id: udid.to_string(),
                                            name: format!("{} ({})", name, runtime),
                                            deviceType: "iphone".to_string(),
                                            status: state.to_string(),
                                        };
                                        println!("🔍 DEBUG: Found booted iOS device: {:?}", ios_device);
                                        devices.push(ios_device);
                                    } else {
                                        println!("🔍 DEBUG: Skipping iOS device {} (state: {})", name, state);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        Err(e) => {
            println!("🔍 DEBUG: xcrun command failed: {}", e);
            // Xcode tools not available, skip iOS simulators
        }
    }
    
    println!("🔍 DEBUG: Total devices found: {}", devices.len());
    Ok(devices)
}

#[command]
pub async fn get_android_packages(device_id: String) -> Result<Vec<Package>, String> {
    println!("🔍 DEBUG: Getting Android packages for device: {}", device_id);
    let output = Command::new("adb")
        .args(&["-s", &device_id, "shell", "pm", "list", "packages", "-3"])
        .output()
        .map_err(|e| {
            println!("🔍 DEBUG: Failed to execute adb command: {}", e);
            format!("Failed to execute adb command: {}", e)
        })?;
    
    let output_str = String::from_utf8_lossy(&output.stdout);
    let mut packages = Vec::new();
    
    for line in output_str.lines() {
        if line.starts_with("package:") {
            let package_name = line.strip_prefix("package:").unwrap_or("").to_string();
            let package = Package {
                name: package_name.clone(),
                bundleId: package_name,
                version: None,
                deviceType: "android".to_string(),
            };
            packages.push(package);
        }
    }

    println!("🔍 DEBUG: Total Android packages found: {}", packages.len());
    Ok(packages)
}

#[command]
pub async fn get_ios_packages(device_id: String) -> Result<Vec<Package>, String> {
    // For iOS simulator, list installed apps
    let output = Command::new("xcrun")
        .args(&["simctl", "listapps", &device_id])
        .output()
        .map_err(|e| format!("Failed to execute xcrun command: {}", e))?;
    
    let output_str = String::from_utf8_lossy(&output.stdout);
    let mut packages = Vec::new();
    
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&output_str) {
        for (bundle_id, app_info) in json.as_object().unwrap_or(&serde_json::Map::new()) {
            if let Some(name) = app_info.get("CFBundleDisplayName").and_then(|v| v.as_str()) {
                packages.push(Package {
                    bundleId: bundle_id.clone(),
                    name: name.to_string(),
                    version: app_info.get("CFBundleVersion").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    deviceType: "iphone".to_string(),
                });
            }
        }
    }
    
    Ok(packages)
}

#[command]
pub async fn get_ios_device_packages(device_id: String) -> Result<Vec<Package>, String> {
    // For physical iOS devices, use ideviceinstaller
    let output = Command::new("ideviceinstaller")
        .args(&["-u", &device_id, "-l"])
        .output()
        .map_err(|e| format!("Failed to execute ideviceinstaller command: {}", e))?;
    
    let output_str = String::from_utf8_lossy(&output.stdout);
    let mut packages = Vec::new();
    
    for line in output_str.lines() {
        if line.contains(" - ") {
            let parts: Vec<&str> = line.split(" - ").collect();
            if parts.len() >= 2 {
                packages.push(Package {
                    bundleId: parts[0].trim().to_string(),
                    name: parts[1].trim().to_string(),
                    version: None,
                    deviceType: "iphone".to_string(),
                });
            }
        }
    }
    
    Ok(packages)
}

#[command]
pub async fn check_app_existence(device_id: String, application_id: String) -> Result<bool, String> {
    // Check if app exists on device
    let output = Command::new("adb")
        .args(&["-s", &device_id, "shell", "pm", "path", &application_id])
        .output()
        .map_err(|e| format!("Failed to execute adb command: {}", e))?;
    
    Ok(!output.stdout.is_empty())
}

#[command]
pub async fn get_android_database_files(device_id: String, application_id: String) -> Result<Vec<DatabaseFile>, String> {
    // Implementation for getting Android database files
    println!("🔍 DEBUG: get_android_database_files: {}", format!("/data/data/{}/databases/", application_id));
    let mut db_files = Vec::new();
    
    // Try to list database files in app's data directory
    let paths = [
        format!("/data/data/{}/databases/", application_id),
        format!("/data/data/{}/files/", application_id),
    ];
    
    // Create local temp directory for storing pulled files
    let local_dir = std::env::temp_dir().join("flippio_android_dbs").join(&application_id);
    std::fs::create_dir_all(&local_dir).map_err(|e| format!("Failed to create local directory: {}", e))?;

    for base_path in &paths {
        let output = Command::new("adb")
            .args(&["-s", &device_id, "shell", "run-as", &application_id, "ls", base_path])
            .output();
            
        if let Ok(output) = output {
            let output_str = String::from_utf8_lossy(&output.stdout);
            for line in output_str.lines() {
                let filename = line.trim();
                if filename.ends_with(".db") || filename.ends_with(".sqlite") || filename.ends_with(".sqlite3") {
                    let remote_path = format!("{}{}", base_path, filename);
                    let local_path = local_dir.join(filename);
                    
                    println!("🔍 DEBUG: Pulling database file from {} to {}", remote_path, local_path.display());
                    
                    // Pull the database file from device
                    let pull_output = Command::new("adb")
                        .args(&["-s", &device_id, "shell", "run-as", &application_id, "cat", &remote_path])
                        .output();
                    
                    if let Ok(pull_output) = pull_output {
                        if pull_output.status.success() {
                            // Write the file content to local filesystem
                            if let Err(e) = std::fs::write(&local_path, &pull_output.stdout) {
                                println!("🔍 DEBUG: Failed to write file {}: {}", local_path.display(), e);
                                continue;
                            }
                            
                            println!("🔍 DEBUG: Successfully pulled database file: {}", filename);
                            
                            db_files.push(DatabaseFile {
                                path: local_path.to_string_lossy().to_string(),
                                packageName: application_id.clone(),
                                filename: filename.to_string(),
                                location: "app_data".to_string(),
                                remotePath: Some(remote_path),
                                deviceType: "android".to_string(),
                            });
                        } else {
                            println!("🔍 DEBUG: Failed to pull file {}: {}", remote_path, String::from_utf8_lossy(&pull_output.stderr));
                        }
                    }
                }
            }
        }
    }

    // print db_files filenames for debugging
    for file in &db_files {
        println!("🔍 DEBUG: Found database file: {} at {}", file.filename, file.path);
    }

    Ok(db_files)
}

#[command]
pub async fn get_ios_database_files(device_id: String, application_id: String) -> Result<Vec<DatabaseFile>, String> {
    // Implementation for getting iOS simulator database files
    let mut db_files = Vec::new();
    
    // For iOS simulator, find app data directory
    let home_dir = dirs::home_dir().ok_or("Could not find home directory")?;
    let simulator_path = home_dir.join("Library/Developer/CoreSimulator/Devices")
        .join(&device_id)
        .join("data/Containers/Data/Application");
    
    if simulator_path.exists() {
        // Search for the app's container
        for entry in std::fs::read_dir(simulator_path).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let plist_path = entry.path().join(".com.apple.mobile_container_manager.metadata.plist");
            
            // Check if this container belongs to our app
            if plist_path.exists() {
                // Look for database files in Documents and Library directories
                let app_path = entry.path();
                let search_paths = [
                    app_path.join("Documents"),
                    app_path.join("Library"),
                    app_path.join("Library/Application Support"),
                ];
                
                for search_path in &search_paths {
                    if search_path.exists() {
                        search_db_files_recursive(&search_path, &application_id, &mut db_files)?;
                    }
                }
            }
        }
    }
    
    Ok(db_files)
}

#[command]
pub async fn get_ios_device_database_files(_device_id: String, _application_id: String) -> Result<Vec<DatabaseFile>, String> {
    // Implementation for getting iOS device database files
    // This would require more complex implementation using libimobiledevice tools
    Ok(Vec::new())
}

#[command]
pub async fn upload_ios_db_file(
    _device_id: String,
    _package_name: String,
    _local_file_path: String,
    _remote_location: String,
) -> Result<String, String> {
    // Implementation for uploading database file to iOS device
    Err("Not implemented for iOS devices yet".to_string())
}

#[command]
pub async fn push_database_file(
    device_id: String,
    local_path: String,
    package_name: String,
    remote_path: String,
) -> Result<serde_json::Value, String> {
    use std::path::Path;
    
    println!("🔍 DEBUG: push_database_file - device: {}, local: {}, package: {}, remote: {}", 
             device_id, local_path, package_name, remote_path);
    
    // Get filename from local path
    let filename = Path::new(&local_path)
        .file_name()
        .and_then(|f| f.to_str())
        .ok_or("Invalid local file path")?;
    
    let tmp_path = format!("/data/local/tmp/{}", filename);
    
    // Check if remote path is external storage (sdcard)
    if remote_path.contains("sdcard") || remote_path.contains("external") {
        println!("🔍 DEBUG: Pushing to external storage directly");
        let output = Command::new("adb")
            .args(&["-s", &device_id, "push", &local_path, &remote_path])
            .output()
            .map_err(|e| format!("Failed to execute adb push: {}", e))?;
        
        if output.status.success() {
            return Ok(serde_json::json!({
                "success": true,
                "message": format!("Database successfully pushed to {}", remote_path)
            }));
        } else {
            return Err(format!("Failed to push to external storage: {}", String::from_utf8_lossy(&output.stderr)));
        }
    }
    
    // For app data directories, use the two-step process
    println!("🔍 DEBUG: Pushing to tmp directory first: {}", tmp_path);
    
    // Step 1: Push file to device tmp directory
    let push_output = Command::new("adb")
        .args(&["-s", &device_id, "push", &local_path, &tmp_path])
        .output()
        .map_err(|e| format!("Failed to execute adb push to tmp: {}", e))?;
    
    if !push_output.status.success() {
        let stderr = String::from_utf8_lossy(&push_output.stderr);
        // Check if stderr contains success indicators
        if !stderr.contains("pushed") && !stderr.contains("100%") {
            return Err(format!("Failed to push to tmp directory: {}", stderr));
        }
    }
    
    println!("🔍 DEBUG: Copying from tmp to app data directory using run-as");
    
    // Step 2: Use run-as to copy from tmp to app's data directory
    let copy_output = Command::new("adb")
        .args(&[
            "-s", &device_id, 
            "shell", 
            "run-as", &package_name, 
            "cp", &tmp_path, &remote_path
        ])
        .output()
        .map_err(|e| format!("Failed to execute run-as copy: {}", e))?;
    
    if !copy_output.status.success() {
        let stderr = String::from_utf8_lossy(&copy_output.stderr);
        if !stderr.is_empty() {
            return Err(format!("Failed to copy to app directory: {}", stderr));
        }
    }
    
    println!("🔍 DEBUG: Cleaning up tmp file");
    
    // Step 3: Clean up the temp file on the device
    let _cleanup = Command::new("adb")
        .args(&["-s", &device_id, "shell", "rm", &tmp_path])
        .output();
    
    Ok(serde_json::json!({
        "success": true,
        "message": format!("Database successfully pushed to {}", remote_path)
    }))
}

fn search_db_files_recursive(
    path: &std::path::Path,
    package_name: &str,
    db_files: &mut Vec<DatabaseFile>,
) -> Result<(), String> {
    if path.is_dir() {
        for entry in std::fs::read_dir(path).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            
            if path.is_dir() {
                search_db_files_recursive(&path, package_name, db_files)?;
            } else if let Some(filename) = path.file_name().and_then(|f| f.to_str()) {
                if filename.ends_with(".db") || filename.ends_with(".sqlite") || filename.ends_with(".sqlite3") {
                    db_files.push(DatabaseFile {
                        path: path.to_string_lossy().to_string(),
                        packageName: package_name.to_string(),
                        filename: filename.to_string(),
                        location: "app_data".to_string(),
                        remotePath: Some(path.to_string_lossy().to_string()),
                        deviceType: "iphone".to_string(),
                    });
                }
            }
        }
    }
    
    Ok(())
}
