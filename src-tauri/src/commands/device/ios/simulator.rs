//! iOS Simulator Operations
//!
//! This module handles iOS simulator-specific operations including
//! database file management and app data access.

use super::super::helpers::force_clean_temp_dir;
use super::super::types::{DatabaseFile, DeviceResponse};
use log::{error, info};
use tauri::State;
use tauri_plugin_shell::ShellExt;

fn is_sqlite_database_file(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    lower.ends_with(".db") || lower.ends_with(".sqlite") || lower.ends_with(".sqlite3")
}

/// Upload database file to iOS simulator
#[tauri::command]
pub async fn upload_simulator_ios_db_file(
    _app_handle: tauri::AppHandle,
    device_id: String,
    local_file_path: String,
    package_name: String,
    remote_location: String,
    db_pool_state: State<'_, crate::commands::database::DbPool>,
) -> Result<DeviceResponse<String>, String> {
    info!("=== UPLOAD SIMULATOR iOS DB FILE STARTED ===");
    info!("Device ID: {}", device_id);
    info!("Local file path: {}", local_file_path);
    info!("Package name: {}", package_name);
    info!("Remote location: {}", remote_location);

    // Close any existing database connection to prevent file locks during copy
    {
        let mut pool_guard = db_pool_state.write().await;
        if let Some(pool) = pool_guard.take() {
            info!("🔒 Closing active database connection before file operations");
            pool.close().await;
            info!("✅ Database connection closed");
        }
    }

    // Small delay to ensure connection is fully closed
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // Check if source and destination are the same file
    if let (Ok(local_canonical), Ok(remote_canonical)) = (
        std::fs::canonicalize(&local_file_path),
        std::fs::canonicalize(&remote_location),
    ) {
        if local_canonical == remote_canonical {
            info!("✅ Source and destination are the same file - no copy needed");
            return Ok(DeviceResponse {
                success: true,
                data: Some("File already in correct location".to_string()),
                error: None,
            });
        }
    }

    // Validate local file exists and has content
    if !std::path::Path::new(&local_file_path).exists() {
        error!("❌ Local file does not exist: {}", local_file_path);
        return Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(format!("Local file {} does not exist", local_file_path)),
        });
    }

    // Simple file copy
    info!("� Copying {} to {}", local_file_path, remote_location);
    match std::fs::copy(&local_file_path, &remote_location) {
        Ok(bytes_copied) => {
            info!("✅ Successfully copied {} bytes", bytes_copied);
            Ok(DeviceResponse {
                success: true,
                data: Some(format!(
                    "Successfully uploaded {} to simulator at {}",
                    local_file_path, remote_location
                )),
                error: None,
            })
        }
        Err(e) => {
            error!("❌ Copy operation failed: {}", e);
            Ok(DeviceResponse {
                success: false,
                data: None,
                error: Some(format!("File copy failed: {}", e)),
            })
        }
    }
}

/// Get database files from iOS simulator
#[tauri::command]
pub async fn get_ios_simulator_database_files(
    app_handle: tauri::AppHandle,
    device_id: String,
    package_name: String,
) -> Result<DeviceResponse<Vec<DatabaseFile>>, String> {
    info!("=== GET iOS SIMULATOR DATABASE FILES STARTED ===");
    info!("Device ID (Simulator): {}", device_id);
    info!("Package name: {}", package_name);

    // Force clean temp directory before processing simulator database files to avoid stale data
    if let Err(e) = force_clean_temp_dir() {
        log::warn!("❌ Failed to force clean temp directory: {}", e);
    } else {
        info!("✅ Successfully force cleaned temp directory before simulator database processing");
    }

    let shell = app_handle.shell();
    let mut database_files = Vec::new();

    info!("Step 1: Getting app container path using xcrun simctl");
    let get_container_output = shell
        .command("xcrun")
        .args([
            "simctl",
            "get_app_container",
            &device_id,
            &package_name,
            "data",
        ])
        .output()
        .await;

    match get_container_output {
        Ok(container_result) => {
            info!(
                "get_app_container exit status: {:?}",
                container_result.status
            );
            if !container_result.stdout.is_empty() {
                info!(
                    "get_app_container stdout: {}",
                    String::from_utf8_lossy(&container_result.stdout)
                );
            }
            if !container_result.stderr.is_empty() {
                info!(
                    "get_app_container stderr: {}",
                    String::from_utf8_lossy(&container_result.stderr)
                );
            }

            if container_result.status.success() {
                let container_path = String::from_utf8_lossy(&container_result.stdout)
                    .trim()
                    .to_string();
                info!("✅ App container path: {}", container_path);

                info!("Step 2: Searching for database files in Documents and Library");

                for (location_label, directory_path) in [
                    ("Documents", format!("{}/Documents", container_path)),
                    ("Library", format!("{}/Library", container_path)),
                ] {
                    info!("Scanning {} path: {}", location_label, directory_path);

                    if !std::path::Path::new(&directory_path).exists() {
                        info!("Skipping missing {} path", location_label);
                        continue;
                    }

                    let find_output = shell
                        .command("find")
                        .args([&directory_path, "-type", "f"])
                        .output()
                        .await;

                    match find_output {
                        Ok(find_result) => {
                            info!(
                                "find command exit status for {}: {:?}",
                                location_label, find_result.status
                            );
                            if !find_result.stdout.is_empty() {
                                info!(
                                    "find command stdout for {}: {}",
                                    location_label,
                                    String::from_utf8_lossy(&find_result.stdout)
                                );
                            }
                            if !find_result.stderr.is_empty() {
                                info!(
                                    "find command stderr for {}: {}",
                                    location_label,
                                    String::from_utf8_lossy(&find_result.stderr)
                                );
                            }

                            if !find_result.status.success() {
                                let stderr = String::from_utf8_lossy(&find_result.stderr);
                                error!("❌ find command failed for {}: {}", location_label, stderr);
                                continue;
                            }

                            info!(
                                "Step 3: Processing found database files in {}",
                                location_label
                            );
                            for file_path in String::from_utf8_lossy(&find_result.stdout).lines() {
                                let file_path = file_path.trim();
                                if file_path.is_empty()
                                    || !std::path::Path::new(file_path).exists()
                                    || !is_sqlite_database_file(file_path)
                                {
                                    continue;
                                }

                                info!("Found database file: {}", file_path);
                                let filename = std::path::Path::new(file_path)
                                    .file_name()
                                    .and_then(|n| n.to_str())
                                    .unwrap_or("unknown")
                                    .to_string();

                                let db_file = DatabaseFile {
                                    path: file_path.to_string(),
                                    package_name: package_name.clone(),
                                    filename,
                                    remote_path: Some(file_path.to_string()),
                                    location: location_label.to_string(),
                                    device_type: "simulator".to_string(),
                                };

                                info!("Database file object: {:?}", db_file);
                                database_files.push(db_file);
                            }
                        }
                        Err(e) => {
                            error!(
                                "❌ Failed to execute find command for {}: {}",
                                location_label, e
                            );
                        }
                    }
                }
            } else {
                let stderr = String::from_utf8_lossy(&container_result.stderr);
                error!("❌ get_app_container command failed: {}", stderr);
                return Ok(DeviceResponse {
                    success: false,
                    data: None,
                    error: Some(format!("Failed to get app container: {}", stderr)),
                });
            }
        }
        Err(e) => {
            error!("❌ Failed to execute get_app_container: {}", e);
            return Ok(DeviceResponse {
                success: false,
                data: None,
                error: Some(format!("Failed to get app container: {}", e)),
            });
        }
    }

    info!("=== GET iOS SIMULATOR DATABASE FILES COMPLETED ===");
    info!("Found {} database files", database_files.len());

    Ok(DeviceResponse {
        success: true,
        data: Some(database_files),
        error: None,
    })
}
