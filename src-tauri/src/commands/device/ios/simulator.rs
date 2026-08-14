//! iOS Simulator Operations
//!
//! This module handles iOS simulator-specific operations including
//! database file management and app data access.

use super::super::helpers::force_clean_temp_dir;
use super::super::types::{DatabaseFile, DeviceResponse};
use log::{error, info};
use std::collections::{HashSet, VecDeque};
use std::path::{Path, PathBuf};
use tauri::State;
use tauri_plugin_shell::ShellExt;

const IOS_SIM_SCAN_MAX_DEPTH: usize = 6;
const IOS_SIM_SCAN_MAX_DIRECTORIES: usize = 256;

fn is_database_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| matches!(ext, "db" | "sqlite" | "sqlite3"))
        .unwrap_or(false)
}

fn location_from_container_path(container_path: &Path, file_path: &Path) -> String {
    if let Ok(relative_path) = file_path.strip_prefix(container_path) {
        relative_path
            .components()
            .next()
            .map(|component| component.as_os_str().to_string_lossy().to_string())
            .unwrap_or_else(|| "Container".to_string())
    } else {
        "Container".to_string()
    }
}

fn scan_simulator_root(root_path: &Path) -> (Vec<PathBuf>, Vec<String>) {
    let mut found_files = Vec::new();
    let mut scan_warnings = Vec::new();

    if !root_path.exists() {
        return (found_files, scan_warnings);
    }

    let mut visited_dirs = HashSet::new();
    let mut queue = VecDeque::from([(root_path.to_path_buf(), 0usize)]);

    while let Some((dir_path, depth)) = queue.pop_front() {
        let normalized_dir = dir_path.to_string_lossy().to_string();
        if !visited_dirs.insert(normalized_dir.clone()) {
            continue;
        }

        if visited_dirs.len() > IOS_SIM_SCAN_MAX_DIRECTORIES {
            scan_warnings.push(format!(
                "Stopped scanning after {} directories to avoid runaway recursion",
                IOS_SIM_SCAN_MAX_DIRECTORIES
            ));
            break;
        }

        let entries = match std::fs::read_dir(&dir_path) {
            Ok(entries) => entries,
            Err(err) => {
                scan_warnings.push(format!("Skipping {}: {}", normalized_dir, err));
                continue;
            }
        };

        for entry_result in entries {
            let entry = match entry_result {
                Ok(entry) => entry,
                Err(err) => {
                    scan_warnings.push(format!("Skipping entry in {}: {}", normalized_dir, err));
                    continue;
                }
            };

            let entry_path = entry.path();
            let file_type = match entry.file_type() {
                Ok(file_type) => file_type,
                Err(err) => {
                    scan_warnings.push(format!(
                        "Skipping {}: {}",
                        entry_path.to_string_lossy(),
                        err
                    ));
                    continue;
                }
            };

            if file_type.is_dir() {
                if depth >= IOS_SIM_SCAN_MAX_DEPTH {
                    scan_warnings.push(format!(
                        "Stopped descending into {} after reaching max depth {}",
                        entry_path.to_string_lossy(),
                        IOS_SIM_SCAN_MAX_DEPTH
                    ));
                    continue;
                }

                queue.push_back((entry_path, depth + 1));
                continue;
            }

            if file_type.is_file() && is_database_file(&entry_path) {
                found_files.push(entry_path);
            }
        }
    }

    (found_files, scan_warnings)
}

fn scan_simulator_library_targets(
    container_path: &Path,
    package_name: &str,
) -> (Vec<PathBuf>, Vec<String>) {
    let library_path = container_path.join("Library");
    let mut found_files = Vec::new();
    let mut scan_warnings = Vec::new();
    let entries = match std::fs::read_dir(&library_path) {
        Ok(entries) => entries,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            return (found_files, scan_warnings);
        }
        Err(err) => {
            scan_warnings.push(format!(
                "Skipping {}: {}",
                library_path.to_string_lossy(),
                err
            ));
            return (found_files, scan_warnings);
        }
    };
    let recursive_targets = [
        "SQLite",
        "Application Support",
        "LocalDatabase",
        package_name,
    ];

    for entry_result in entries {
        let entry = match entry_result {
            Ok(entry) => entry,
            Err(err) => {
                scan_warnings.push(format!(
                    "Skipping entry in {}: {}",
                    library_path.to_string_lossy(),
                    err
                ));
                continue;
            }
        };
        let entry_path = entry.path();
        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(err) => {
                scan_warnings.push(format!(
                    "Skipping {}: {}",
                    entry_path.to_string_lossy(),
                    err
                ));
                continue;
            }
        };

        if file_type.is_file() && is_database_file(&entry_path) {
            found_files.push(entry_path);
        } else if file_type.is_dir()
            && entry_path
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| {
                    recursive_targets
                        .iter()
                        .any(|target| name.eq_ignore_ascii_case(target))
                })
        {
            let (mut nested_files, mut nested_warnings) = scan_simulator_root(&entry_path);
            found_files.append(&mut nested_files);
            scan_warnings.append(&mut nested_warnings);
        }
    }

    (found_files, scan_warnings)
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

                info!("Step 2: Searching selected app container roots for database files");
                let container_path = PathBuf::from(&container_path);
                let mut found_files = Vec::new();
                let mut scan_warnings = Vec::new();

                let (mut document_files, mut document_warnings) =
                    scan_simulator_root(&container_path.join("Documents"));
                found_files.append(&mut document_files);
                scan_warnings.append(&mut document_warnings);

                let (mut library_files, mut library_warnings) =
                    scan_simulator_library_targets(&container_path, &package_name);
                found_files.append(&mut library_files);
                scan_warnings.append(&mut library_warnings);

                for warning in &scan_warnings {
                    log::warn!("iOS simulator scan warning: {}", warning);
                }

                info!("Step 3: Creating database file objects");
                for file_path in found_files {
                    let filename = file_path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown")
                        .to_string();
                    let file_path_str = file_path.to_string_lossy().to_string();

                    let db_file = DatabaseFile {
                        path: file_path_str.clone(),
                        package_name: package_name.clone(),
                        filename,
                        remote_path: Some(file_path_str.clone()),
                        location: location_from_container_path(&container_path, &file_path),
                        device_type: "simulator".to_string(),
                    };

                    info!("Database file object: {:?}", db_file);
                    database_files.push(db_file);
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn scans_database_files_across_the_library_tree() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after Unix epoch")
            .as_nanos();
        let container = std::env::temp_dir().join(format!(
            "flippio-simulator-library-scan-{}-{unique}",
            std::process::id()
        ));
        let package_name = "com.example.flippio";
        let relative_paths = [
            "Library/root.db",
            "Library/SQLite/sqlcipher_items_sample.db",
            "Library/Application Support/application-support-fixture.sqlite",
            "Library/LocalDatabase/local-database-fixture.sqlite3",
            "Library/com.example.flippio/bundle-folder-fixture.db",
            "Library/Caches/internal-cache.db",
        ];

        for relative_path in relative_paths {
            let path = container.join(relative_path);
            fs::create_dir_all(path.parent().expect("fixture should have a parent"))
                .expect("fixture directory should be created");
            fs::write(path, []).expect("fixture file should be created");
        }

        let (files, warnings) = scan_simulator_library_targets(&container, package_name);
        let mut relative_files = files
            .iter()
            .map(|path| {
                path.strip_prefix(&container)
                    .expect("result should be inside fixture container")
                    .to_string_lossy()
                    .to_string()
            })
            .collect::<Vec<_>>();
        relative_files.sort();

        fs::remove_dir_all(&container).expect("fixture container should be removed");

        assert!(warnings.is_empty(), "unexpected warnings: {warnings:?}");
        assert_eq!(
            relative_files,
            vec![
                "Library/Application Support/application-support-fixture.sqlite",
                "Library/LocalDatabase/local-database-fixture.sqlite3",
                "Library/SQLite/sqlcipher_items_sample.db",
                "Library/com.example.flippio/bundle-folder-fixture.db",
                "Library/root.db",
            ]
        );
    }
}
