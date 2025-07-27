//! iOS Database File Operations
//! 
//! This module handles database file operations for iOS devices including
//! detection, pulling, and pushing of database files.

use super::super::types::{DeviceResponse, DatabaseFile};
use super::super::helpers::clean_temp_dir;
use super::file_utils::pull_ios_db_file;
use super::tools::get_tool_command_legacy;
use tauri_plugin_shell::ShellExt;
use log::{info, error};

/// Get database files from iOS physical device
#[tauri::command]
pub async fn get_ios_device_database_files(
    app_handle: tauri::AppHandle,
    device_id: String,
    package_name: String,
) -> Result<DeviceResponse<Vec<DatabaseFile>>, String> {
    info!("=== GET iOS DEVICE DATABASE FILES STARTED ===");
    info!("Device ID: {}", device_id);
    info!("Package name: {}", package_name);
    
    info!("Step 1: Cleaning temporary directory");
    // Clean temp directory before pulling new files
    if let Err(e) = clean_temp_dir() {
        log::warn!("❌ Failed to clean temp directory: {}", e);
    } else {
        info!("✅ Successfully cleaned temp directory before pulling new files");
    }
    
    let shell = app_handle.shell();
    let mut database_files = Vec::new();

    info!("Step 2: Scanning Documents directory for database files");
    let afcclient_cmd = get_tool_command_legacy("afcclient");
    info!("Using afcclient command: {}", afcclient_cmd);
    
    // Use the working alternative format directly as primary method
    let cmd_args = ["--documents", &package_name, "-u", &device_id, "ls", "Documents"];
    info!("Executing afcclient command:");
    info!("  Command: {}", afcclient_cmd);
    info!("  Arguments: {:?}", cmd_args);
    info!("  Full command line: {} {}", afcclient_cmd, cmd_args.join(" "));
    
    let output = shell.command(&afcclient_cmd)
        .args(cmd_args)
        .output()
        .await
        .map_err(|e| format!("Failed to execute afcclient: {}", e))?;
    
    info!("afcclient exit status: {:?}", output.status);
    
    if output.status.success() {
        let files_output = String::from_utf8_lossy(&output.stdout);
        info!("📁 Documents directory contents:");
        
        // Process each line to find database files
        for line in files_output.lines() {
            let file = line.trim();
            info!("  {}", file);
            
            // Check if it's a database file
            if !file.is_empty() && (file.ends_with(".db") || file.ends_with(".sqlite") || file.ends_with(".sqlite3")) {
                info!("🎯 Found database file: Documents/{}", file);
                
                // Try to pull this file
                let remote_path = format!("/Documents/{}", file);
                match pull_ios_db_file(&app_handle, &device_id, &package_name, &remote_path, true).await {
                    Ok(local_path) => {
                        info!("✅ Successfully pulled file to: {}", local_path);
                        let filename = file.to_string();
                        
                        let db_file = DatabaseFile {
                            path: local_path,
                            package_name: package_name.clone(),
                            filename,
                            remote_path: Some(remote_path.clone()),
                            location: "Documents".to_string(),
                            device_type: "iphone-device".to_string(),
                        };
                        
                        info!("Database file object created: {:?}", db_file);
                        database_files.push(db_file);
                    }
                    Err(e) => {
                        error!("❌ Failed to pull database file {}: {}", remote_path, e);
                        // Still add the file with remote path for fallback access
                        let filename = file.to_string();
                        
                        let fallback_db_file = DatabaseFile {
                            path: remote_path.clone(),
                            package_name: package_name.clone(),
                            filename,
                            remote_path: Some(remote_path.clone()),
                            location: "Documents".to_string(),
                            device_type: "iphone-device".to_string(),
                        };
                        
                        info!("Fallback database file object created: {:?}", fallback_db_file);
                        database_files.push(fallback_db_file);
                    }
                }
            }
        }
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        error!("❌ Failed to list Documents directory: {}", stderr);
        if stderr.contains("Permission denied") {
            info!("📱 Documents directory access denied (iOS security restriction)");
        }
        
        return Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(format!("Failed to access Documents directory: {}", stderr)),
        });
    }
    
    info!("=== GET iOS DEVICE DATABASE FILES COMPLETED ===");
    info!("📊 Final Results Summary:");
    info!("  Total database files found: {}", database_files.len());
    info!("  Device ID: {}", device_id);
    info!("  Package name: {}", package_name);
    
    if database_files.is_empty() {
        info!("⚠️  No database files found in Documents directory");
        info!("This could mean:");
        info!("   1. The app doesn't store database files in Documents");
        info!("   2. The app doesn't have any database files");
        info!("   3. Package name is incorrect");
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

/// Push database file to iOS physical device
#[tauri::command]
pub async fn device_push_ios_database_file(
    app_handle: tauri::AppHandle,
    device_id: String,
    local_path: String,
    package_name: String,
    remote_path: String,
) -> Result<DeviceResponse<String>, String> {
    info!("=== PUSH iOS DATABASE FILE STARTED ===");
    info!("Device ID: {}", device_id);
    info!("Local path: {}", local_path);
    info!("Package name: {}", package_name);
    info!("Remote path: {}", remote_path);
    
    info!("Step 1: Checking file paths");
    // Check if source and destination are the same file (for consistency with simulator)
    let _local_path_canonical = match std::fs::canonicalize(&local_path) {
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
    
    // For physical devices, we can't canonicalize remote paths, so just do a string comparison
    // This is more for consistency and future-proofing
    if local_path == remote_path {
        info!("✅ Source and destination paths are identical - this shouldn't happen for physical devices");
        info!("📁 File path: {}", local_path);
        // Continue with normal flow since physical devices always need the push operation
    }
    
    info!("Step 2: Validating local file exists");
    // Check if local file exists first
    if !std::path::Path::new(&local_path).exists() {
        error!("❌ Local file does not exist: {}", local_path);
        return Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(format!("Local file {} does not exist", local_path)),
        });
    }
    info!("✅ Local file exists");
    
    info!("Step 3: Validating local file content");
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
    
    info!("Step 4: Checking if file exists on device");
    let shell = app_handle.shell();
    let afcclient_cmd = get_tool_command_legacy("afcclient");
    info!("Using afcclient command: {}", afcclient_cmd);
    
    // Check if file exists on device first
    let check_args = [
        "--documents", &package_name,
        "-u", &device_id,
        "ls", &remote_path
    ];
    info!("Check file existence command: {} {}", afcclient_cmd, check_args.join(" "));
    
    let check_output = shell.command(&afcclient_cmd)
        .args(check_args)
        .output()
        .await
        .map_err(|e| format!("Failed to execute afcclient check: {}", e))?;
    
    info!("afcclient check exit status: {:?}", check_output.status);
    if !check_output.stdout.is_empty() {
        info!("afcclient check stdout: {}", String::from_utf8_lossy(&check_output.stdout));
    }
    if !check_output.stderr.is_empty() {
        info!("afcclient check stderr: {}", String::from_utf8_lossy(&check_output.stderr));
    }
    
    let file_exists = check_output.status.success();
    if file_exists {
        info!("📁 File exists on device, removing it first");
        
        // Remove existing file
        let remove_args = [
            "--documents", &package_name,
            "-u", &device_id,
            "rm", &remote_path
        ];
        info!("Remove file command: {} {}", afcclient_cmd, remove_args.join(" "));
        
        let remove_output = shell.command(&afcclient_cmd)
            .args(remove_args)
            .output()
            .await
            .map_err(|e| format!("Failed to execute afcclient remove: {}", e))?;
        
        info!("afcclient remove exit status: {:?}", remove_output.status);
        if !remove_output.stdout.is_empty() {
            info!("afcclient remove stdout: {}", String::from_utf8_lossy(&remove_output.stdout));
        }
        if !remove_output.stderr.is_empty() {
            info!("afcclient remove stderr: {}", String::from_utf8_lossy(&remove_output.stderr));
        }
        
        if !remove_output.status.success() {
            let error_msg = String::from_utf8_lossy(&remove_output.stderr);
            error!("❌ Failed to remove existing file: {}", error_msg);
            return Ok(DeviceResponse {
                success: false,
                data: None,
                error: Some(format!("Failed to remove existing file: {}", error_msg)),
            });
        }
        info!("✅ Existing file removed successfully");
    } else {
        info!("📁 File does not exist on device, proceeding with new file upload");
    }
    
    info!("Step 5: Pushing new file to iOS device");
    
    // Use afcclient to push file to device
    let args = [
        "--documents", &package_name,
        "-u", &device_id,
        "put", &local_path, &remote_path
    ];
    info!("Push command: {} {}", afcclient_cmd, args.join(" "));
    
    let output = shell.command(&afcclient_cmd)
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to execute afcclient push: {}", e))?;
    
    info!("afcclient push exit status: {:?}", output.status);
    if !output.stdout.is_empty() {
        info!("afcclient push stdout: {}", String::from_utf8_lossy(&output.stdout));
    }
    if !output.stderr.is_empty() {
        info!("afcclient push stderr: {}", String::from_utf8_lossy(&output.stderr));
    }
    
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        error!("❌ afcclient push command failed: {}", error_msg);
        return Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(format!("iOS push failed: {}", error_msg)),
        });
    }
    
    info!("✅ Push command executed successfully");
    
    info!("Step 6: Verifying file was pushed successfully");
    // Verify the file exists on device after push
    let verify_args = [
        "--documents", &package_name,
        "-u", &device_id,
        "ls", &remote_path
    ];
    info!("Verify file command: {} {}", afcclient_cmd, verify_args.join(" "));
    
    let verify_output = shell.command(&afcclient_cmd)
        .args(verify_args)
        .output()
        .await
        .map_err(|e| format!("Failed to execute afcclient verify: {}", e))?;
    
    info!("afcclient verify exit status: {:?}", verify_output.status);
    if !verify_output.stdout.is_empty() {
        info!("afcclient verify stdout: {}", String::from_utf8_lossy(&verify_output.stdout));
    }
    if !verify_output.stderr.is_empty() {
        info!("afcclient verify stderr: {}", String::from_utf8_lossy(&verify_output.stderr));
    }
    
    if !verify_output.status.success() {
        error!("❌ File verification failed - file may not have been pushed correctly");
        return Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some("File push verification failed".to_string()),
        });
    }
    
    info!("✅ File verified successfully on device");
    info!("=== PUSH iOS DATABASE FILE COMPLETED ===");
    
    Ok(DeviceResponse {
        success: true,
        data: Some(format!("Successfully pushed {} to {}", local_path, remote_path)),
        error: None,
    })
}
