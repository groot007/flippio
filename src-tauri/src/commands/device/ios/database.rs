//! iOS Database File Operations
//!
//! This module handles database file operations for iOS devices including
//! detection, pulling, and pushing of database files.

use super::super::helpers::force_clean_temp_dir;
use super::super::types::{DatabaseFile, DeviceResponse};
use super::file_utils::{infer_ios_afc_access_mode, pull_ios_db_file, IosAfcAccessMode};
use super::tools::get_tool_command_legacy;
use log::{error, info};
use tauri_plugin_shell::ShellExt;

fn is_sqlite_database_file(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    lower.ends_with(".db") || lower.ends_with(".sqlite") || lower.ends_with(".sqlite3")
}

fn join_ios_scan_path(base: &str, entry: &str) -> String {
    if base == "/" {
        format!("/{}", entry.trim_start_matches('/'))
    } else {
        format!(
            "{}/{}",
            base.trim_end_matches('/'),
            entry.trim_start_matches('/')
        )
    }
}

async fn list_ios_directory_entries(
    app_handle: &tauri::AppHandle,
    access_mode: IosAfcAccessMode,
    device_id: &str,
    package_name: &str,
    path: &str,
) -> Result<Vec<String>, String> {
    let afcclient_cmd = get_tool_command_legacy("afcclient");
    let shell = app_handle.shell();
    let args = [
        access_mode.cli_flag(),
        package_name,
        "-u",
        device_id,
        "ls",
        path,
    ];

    let output = shell
        .command(&afcclient_cmd)
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to execute afcclient: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToOwned::to_owned)
        .collect())
}

async fn is_ios_directory(
    app_handle: &tauri::AppHandle,
    access_mode: IosAfcAccessMode,
    device_id: &str,
    package_name: &str,
    path: &str,
) -> Result<bool, String> {
    let afcclient_cmd = get_tool_command_legacy("afcclient");
    let shell = app_handle.shell();
    let args = [
        access_mode.cli_flag(),
        package_name,
        "-u",
        device_id,
        "info",
        path,
    ];

    let output = shell
        .command(&afcclient_cmd)
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to execute afcclient: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).contains("st_ifmt: S_IFDIR"))
}

async fn collect_ios_device_database_files(
    app_handle: &tauri::AppHandle,
    device_id: &str,
    package_name: &str,
    access_mode: IosAfcAccessMode,
    scan_root: &str,
    location_label: &str,
    database_files: &mut Vec<DatabaseFile>,
) {
    info!("Scanning iOS device path '{}' for SQLite files", scan_root);

    let mut directories_to_visit = vec![scan_root.to_string()];

    while let Some(current_dir) = directories_to_visit.pop() {
        let entries = match list_ios_directory_entries(
            app_handle,
            access_mode,
            device_id,
            package_name,
            &current_dir,
        )
        .await
        {
            Ok(entries) => entries,
            Err(stderr) => {
                error!("❌ Failed to list {}: {}", current_dir, stderr);
                continue;
            }
        };

        for entry in entries {
            let entry_path = join_ios_scan_path(&current_dir, &entry);

            match is_ios_directory(
                app_handle,
                access_mode,
                device_id,
                package_name,
                &entry_path,
            )
            .await
            {
                Ok(true) => {
                    directories_to_visit.push(entry_path);
                }
                Ok(false) => {
                    if !is_sqlite_database_file(&entry_path) {
                        continue;
                    }

                    info!("🎯 Found database file: {}", entry_path);
                    let remote_path = if entry_path.starts_with('/') {
                        entry_path.clone()
                    } else {
                        format!("/{}", entry_path)
                    };

                    match pull_ios_db_file(
                        app_handle,
                        device_id,
                        package_name,
                        &remote_path,
                        true,
                        access_mode,
                    )
                    .await
                    {
                        Ok(local_path) => {
                            info!("✅ Successfully pulled file to: {}", local_path);
                            let filename = std::path::Path::new(&entry_path)
                                .file_name()
                                .and_then(|name| name.to_str())
                                .unwrap_or(&entry)
                                .to_string();

                            database_files.push(DatabaseFile {
                                path: local_path,
                                package_name: package_name.to_string(),
                                filename,
                                remote_path: Some(remote_path),
                                location: location_label.to_string(),
                                device_type: "iphone-device".to_string(),
                            });
                        }
                        Err(e) => {
                            error!("❌ Failed to pull database file {}: {}", remote_path, e);
                            let filename = std::path::Path::new(&entry_path)
                                .file_name()
                                .and_then(|name| name.to_str())
                                .unwrap_or(&entry)
                                .to_string();

                            database_files.push(DatabaseFile {
                                path: remote_path.clone(),
                                package_name: package_name.to_string(),
                                filename,
                                remote_path: Some(remote_path),
                                location: location_label.to_string(),
                                device_type: "iphone-device".to_string(),
                            });
                        }
                    }
                }
                Err(stderr) => {
                    error!("❌ Failed to inspect {}: {}", entry_path, stderr);
                }
            }
        }
    }
}

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

    info!("Step 1: Force cleaning temporary directory to avoid stale data");
    // Force clean temp directory before pulling new files to avoid stale data
    if let Err(e) = force_clean_temp_dir() {
        log::warn!("❌ Failed to force clean temp directory: {}", e);
    } else {
        info!("✅ Successfully force cleaned temp directory before pulling new database files");
    }

    let shell = app_handle.shell();
    let mut database_files = Vec::new();

    info!("Step 2: Scanning Documents and Library for database files");
    let afcclient_cmd = get_tool_command_legacy("afcclient");
    info!("Using afcclient command: {}", afcclient_cmd);

    let documents_check = shell
        .command(&afcclient_cmd)
        .args([
            "--documents",
            &package_name,
            "-u",
            &device_id,
            "ls",
            "Documents",
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to execute afcclient: {}", e))?;

    info!(
        "Documents accessibility exit status: {:?}",
        documents_check.status
    );

    if documents_check.status.success() {
        collect_ios_device_database_files(
            &app_handle,
            &device_id,
            &package_name,
            IosAfcAccessMode::Documents,
            "Documents",
            "Documents",
            &mut database_files,
        )
        .await;
    } else {
        let stderr = String::from_utf8_lossy(&documents_check.stderr);
        error!("❌ Failed to access Documents directory: {}", stderr);
        if stderr.contains("Permission denied") {
            info!("📱 Documents directory access denied (iOS security restriction)");
        }
    }

    let library_check = shell
        .command(&afcclient_cmd)
        .args([
            "--container",
            &package_name,
            "-u",
            &device_id,
            "ls",
            "Library",
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to execute afcclient: {}", e))?;

    info!(
        "Library accessibility exit status: {:?}",
        library_check.status
    );

    if library_check.status.success() {
        collect_ios_device_database_files(
            &app_handle,
            &device_id,
            &package_name,
            IosAfcAccessMode::Container,
            "Library",
            "Library",
            &mut database_files,
        )
        .await;
    } else {
        let stderr = String::from_utf8_lossy(&library_check.stderr);
        error!("❌ Failed to access Library directory: {}", stderr);
    }

    if !documents_check.status.success() && !library_check.status.success() {
        let documents_error = String::from_utf8_lossy(&documents_check.stderr)
            .trim()
            .to_string();
        let library_error = String::from_utf8_lossy(&library_check.stderr)
            .trim()
            .to_string();

        return Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(format!(
                "Failed to access iOS app data. Documents: {}. Library: {}",
                documents_error, library_error
            )),
        });
    }

    info!("=== GET iOS DEVICE DATABASE FILES COMPLETED ===");
    info!("📊 Final Results Summary:");
    info!("  Total database files found: {}", database_files.len());
    info!("  Device ID: {}", device_id);
    info!("  Package name: {}", package_name);

    if database_files.is_empty() {
        info!("⚠️  No database files found in Documents or Library");
        info!("This could mean:");
        info!("   1. The app doesn't store database files in Documents or Library");
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
                            error!(
                                "❌ Local file does not appear to be a SQLite database: {}",
                                local_path
                            );
                            error!("File header: {}", header_str);
                            return Ok(DeviceResponse {
                                success: false,
                                data: None,
                                error: Some(
                                    "Local file is not a valid SQLite database".to_string(),
                                ),
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
    let access_mode = infer_ios_afc_access_mode(&remote_path);
    info!("Using afcclient command: {}", afcclient_cmd);

    // Check if file exists on device first
    let check_args = [
        access_mode.cli_flag(),
        &package_name,
        "-u",
        &device_id,
        "ls",
        &remote_path,
    ];
    info!(
        "Check file existence command: {} {}",
        afcclient_cmd,
        check_args.join(" ")
    );

    let check_output = shell
        .command(&afcclient_cmd)
        .args(check_args)
        .output()
        .await
        .map_err(|e| format!("Failed to execute afcclient check: {}", e))?;

    info!("afcclient check exit status: {:?}", check_output.status);
    if !check_output.stdout.is_empty() {
        info!(
            "afcclient check stdout: {}",
            String::from_utf8_lossy(&check_output.stdout)
        );
    }
    if !check_output.stderr.is_empty() {
        info!(
            "afcclient check stderr: {}",
            String::from_utf8_lossy(&check_output.stderr)
        );
    }

    let file_exists = check_output.status.success();
    if file_exists {
        info!("📁 File exists on device, removing it first");

        // Remove existing file
        let remove_args = [
            access_mode.cli_flag(),
            &package_name,
            "-u",
            &device_id,
            "rm",
            &remote_path,
        ];
        info!(
            "Remove file command: {} {}",
            afcclient_cmd,
            remove_args.join(" ")
        );

        let remove_output = shell
            .command(&afcclient_cmd)
            .args(remove_args)
            .output()
            .await
            .map_err(|e| format!("Failed to execute afcclient remove: {}", e))?;

        info!("afcclient remove exit status: {:?}", remove_output.status);
        if !remove_output.stdout.is_empty() {
            info!(
                "afcclient remove stdout: {}",
                String::from_utf8_lossy(&remove_output.stdout)
            );
        }
        if !remove_output.stderr.is_empty() {
            info!(
                "afcclient remove stderr: {}",
                String::from_utf8_lossy(&remove_output.stderr)
            );
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
        access_mode.cli_flag(),
        &package_name,
        "-u",
        &device_id,
        "put",
        &local_path,
        &remote_path,
    ];
    info!("Push command: {} {}", afcclient_cmd, args.join(" "));

    let output = shell
        .command(&afcclient_cmd)
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to execute afcclient push: {}", e))?;

    info!("afcclient push exit status: {:?}", output.status);
    if !output.stdout.is_empty() {
        info!(
            "afcclient push stdout: {}",
            String::from_utf8_lossy(&output.stdout)
        );
    }
    if !output.stderr.is_empty() {
        info!(
            "afcclient push stderr: {}",
            String::from_utf8_lossy(&output.stderr)
        );
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
        access_mode.cli_flag(),
        &package_name,
        "-u",
        &device_id,
        "ls",
        &remote_path,
    ];
    info!(
        "Verify file command: {} {}",
        afcclient_cmd,
        verify_args.join(" ")
    );

    let verify_output = shell
        .command(&afcclient_cmd)
        .args(verify_args)
        .output()
        .await
        .map_err(|e| format!("Failed to execute afcclient verify: {}", e))?;

    info!("afcclient verify exit status: {:?}", verify_output.status);
    if !verify_output.stdout.is_empty() {
        info!(
            "afcclient verify stdout: {}",
            String::from_utf8_lossy(&verify_output.stdout)
        );
    }
    if !verify_output.stderr.is_empty() {
        info!(
            "afcclient verify stderr: {}",
            String::from_utf8_lossy(&verify_output.stderr)
        );
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
        data: Some(format!(
            "Successfully pushed {} to {}",
            local_path, remote_path
        )),
        error: None,
    })
}
