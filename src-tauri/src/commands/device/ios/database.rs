//! iOS Database File Operations
//! 
//! This module handles database file operations for iOS devices including
//! detection, pulling, and pushing of database files.

use super::super::types::{DeviceResponse, DatabaseFile};
use super::super::helpers::clean_temp_dir;
use crate::commands::database::helpers::prepare_sqlite_file_for_sync;
use super::file_utils::{pull_ios_db_file, IosAppAccessType};
use super::tools::get_tool_command_legacy;
use serde::Serialize;
use tauri::Emitter;
use tauri_plugin_shell::ShellExt;
use log::{info, error};
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::{LazyLock, Mutex};

const IOS_SCAN_MAX_DEPTH: usize = 6;
const IOS_SCAN_MAX_DIRECTORIES: usize = 256;
const IOS_SCAN_PROGRESS_EVENT: &str = "ios-db-scan-progress";
const IOS_LIBRARY_BACKGROUND_PATHS: [&str; 3] = [
    "/Library/Application Support",
    "/Library/LocalDatabase",
    "/Library/{bundle_id}",
];
static IOS_SCAN_GENERATIONS: LazyLock<Mutex<HashMap<String, u64>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn is_database_file(path: &str) -> bool {
    path.ends_with(".db") || path.ends_with(".sqlite") || path.ends_with(".sqlite3")
}

fn normalize_ios_dir_path(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.is_empty() || trimmed == "/" {
        "/".to_string()
    } else {
        format!("/{}", trimmed.trim_matches('/'))
    }
}

fn append_ios_path(parent: &str, child: &str) -> String {
    let parent = parent.trim_end_matches('/');
    if parent.is_empty() || parent == "/" {
        format!("/{}", child.trim_start_matches('/'))
    } else {
        format!("{}/{}", parent, child.trim_matches('/'))
    }
}

fn location_from_remote_path(remote_path: &str) -> String {
    if remote_path == "/Library" || remote_path.starts_with("/Library/") {
        "Library".to_string()
    } else if remote_path == "/Documents" || remote_path.starts_with("/Documents/") {
        "Documents".to_string()
    } else {
        remote_path.trim_matches('/').split('/').next().unwrap_or("Container").to_string()
    }
}

fn access_type_for_remote_path(remote_path: &str) -> IosAppAccessType {
    let _ = remote_path;
    IosAppAccessType::Container
}

fn basename(path: &str) -> &str {
    path.trim_end_matches('/').rsplit('/').next().unwrap_or(path)
}

fn matches_bundle_folder_name(path: &str, package_name: &str) -> bool {
    basename(path).eq_ignore_ascii_case(package_name)
}

fn begin_ios_scan(scan_key: &str) -> u64 {
    let mut scans = IOS_SCAN_GENERATIONS.lock().expect("iOS scan registry poisoned");
    let next_generation = scans.get(scan_key).copied().unwrap_or(0) + 1;
    scans.insert(scan_key.to_string(), next_generation);
    next_generation
}

fn cancel_ios_scan(scan_key: &str) {
    let mut scans = IOS_SCAN_GENERATIONS.lock().expect("iOS scan registry poisoned");
    let next_generation = scans.get(scan_key).copied().unwrap_or(0) + 1;
    scans.insert(scan_key.to_string(), next_generation);
}

fn is_ios_scan_active(scan_key: &str, generation: u64) -> bool {
    IOS_SCAN_GENERATIONS
        .lock()
        .expect("iOS scan registry poisoned")
        .get(scan_key)
        .copied()
        == Some(generation)
}

fn finish_ios_scan(scan_key: &str, generation: u64) {
    let mut scans = IOS_SCAN_GENERATIONS.lock().expect("iOS scan registry poisoned");
    if scans.get(scan_key).copied() == Some(generation) {
        scans.remove(scan_key);
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct IosDbScanProgressPayload {
    scan_key: String,
    scan_request_id: String,
    mode: String,
    phase: String,
    files: Vec<DatabaseFile>,
}

async fn list_ios_directory(
    shell: &tauri_plugin_shell::Shell<tauri::Wry>,
    afcclient_cmd: &str,
    package_name: &str,
    device_id: &str,
    path: &str,
    access_type: IosAppAccessType,
) -> Result<Vec<String>, String> {
    let access_args = access_type.afcclient_args(package_name);
    let cmd_args = [access_args[0], access_args[1], "-u", device_id, "ls", path];

    let output = shell.command(afcclient_cmd)
        .args(cmd_args)
        .output()
        .await
        .map_err(|e| format!("Failed to execute afcclient: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            format!("Failed to list {}", path)
        } else {
            stderr
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let entries = stdout
        .lines()
        .map(str::trim)
        .filter(|entry| !entry.is_empty() && *entry != "." && *entry != "..")
        .map(|entry| append_ios_path(path, entry))
        .collect();

    Ok(entries)
}

async fn ios_path_is_directory(
    shell: &tauri_plugin_shell::Shell<tauri::Wry>,
    afcclient_cmd: &str,
    package_name: &str,
    device_id: &str,
    path: &str,
    access_type: IosAppAccessType,
) -> Result<bool, String> {
    let access_args = access_type.afcclient_args(package_name);
    let cmd_args = [access_args[0], access_args[1], "-u", device_id, "info", path];

    let output = shell.command(afcclient_cmd)
        .args(cmd_args)
        .output()
        .await
        .map_err(|e| format!("Failed to execute afcclient: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            format!("Failed to inspect {}", path)
        } else {
            stderr
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        let trimmed = line.trim();
        if let Some(value) = trimmed.strip_prefix("st_ifmt:") {
            return Ok(value.trim() == "S_IFDIR");
        }
    }

    Err(format!("Missing file type metadata for {}", path))
}

async fn scan_ios_directory_recursive(
    shell: &tauri_plugin_shell::Shell<tauri::Wry>,
    afcclient_cmd: &str,
    package_name: &str,
    device_id: &str,
    root: &str,
    scan_key: &str,
    scan_generation: u64,
) -> (Vec<String>, Vec<String>) {
    let mut found_files = Vec::new();
    let mut scan_warnings = Vec::new();
    let mut visited_dirs = HashSet::new();
    let mut queue = VecDeque::new();

    queue.push_back((normalize_ios_dir_path(root), 0usize));

    while let Some((path, depth)) = queue.pop_front() {
        if !is_ios_scan_active(scan_key, scan_generation) {
            scan_warnings.push(format!("Stopped scanning {} because the scan was canceled", root));
            break;
        }

        if !visited_dirs.insert(path.clone()) {
            continue;
        }

        if visited_dirs.len() > IOS_SCAN_MAX_DIRECTORIES {
            scan_warnings.push(format!(
                "Stopped scanning after {} directories to avoid runaway recursion",
                IOS_SCAN_MAX_DIRECTORIES
            ));
            break;
        }

        let access_type = access_type_for_remote_path(&path);
        match list_ios_directory(shell, afcclient_cmd, package_name, device_id, &path, access_type).await {
            Ok(entries) => {
                let mut directories = Vec::new();

                for entry_path in entries {
                    if !is_ios_scan_active(scan_key, scan_generation) {
                        scan_warnings.push(format!("Stopped scanning {} because the scan was canceled", path));
                        break;
                    }

                    match ios_path_is_directory(
                        shell,
                        afcclient_cmd,
                        package_name,
                        device_id,
                        &entry_path,
                        access_type_for_remote_path(&entry_path),
                    ).await {
                        Ok(true) => directories.push(entry_path),
                        Ok(false) => {
                            if is_database_file(&entry_path) {
                                found_files.push(entry_path);
                            }
                        }
                        Err(err) => {
                            scan_warnings.push(format!("Skipping {}: {}", entry_path, err));
                        }
                    }
                }

                if depth >= IOS_SCAN_MAX_DEPTH {
                    if !directories.is_empty() {
                        scan_warnings.push(format!(
                            "Stopped descending into {} after reaching max depth {}",
                            path, IOS_SCAN_MAX_DEPTH
                        ));
                    }
                    continue;
                }

                for directory in directories {
                    if !visited_dirs.contains(&directory) {
                        queue.push_back((directory, depth + 1));
                    }
                }
            }
            Err(err) => {
                scan_warnings.push(format!("Skipping {}: {}", path, err));
            }
        }
    }

    (found_files, scan_warnings)
}

async fn scan_ios_directory_shallow(
    shell: &tauri_plugin_shell::Shell<tauri::Wry>,
    afcclient_cmd: &str,
    package_name: &str,
    device_id: &str,
    root: &str,
    scan_key: &str,
    scan_generation: u64,
) -> (Vec<String>, Vec<String>, Vec<String>) {
    let mut found_files = Vec::new();
    let mut subdirectories = Vec::new();
    let mut scan_warnings = Vec::new();
    let access_type = access_type_for_remote_path(root);

    if !is_ios_scan_active(scan_key, scan_generation) {
        scan_warnings.push(format!("Stopped scanning {} because the scan was canceled", root));
        return (found_files, subdirectories, scan_warnings);
    }

    match list_ios_directory(shell, afcclient_cmd, package_name, device_id, root, access_type).await {
        Ok(entries) => {
            for entry_path in entries {
                if !is_ios_scan_active(scan_key, scan_generation) {
                    scan_warnings.push(format!("Stopped scanning {} because the scan was canceled", root));
                    break;
                }

                match ios_path_is_directory(
                    shell,
                    afcclient_cmd,
                    package_name,
                    device_id,
                    &entry_path,
                    access_type_for_remote_path(&entry_path),
                ).await {
                    Ok(true) => subdirectories.push(entry_path),
                    Ok(false) if is_database_file(&entry_path) => found_files.push(entry_path),
                    Ok(false) => {}
                    Err(err) => scan_warnings.push(format!("Skipping {}: {}", entry_path, err)),
                }
            }
        }
        Err(err) => scan_warnings.push(format!("Skipping {}: {}", root, err)),
    }

    (found_files, subdirectories, scan_warnings)
}

async fn scan_ios_library_root_direct_files(
    shell: &tauri_plugin_shell::Shell<tauri::Wry>,
    afcclient_cmd: &str,
    package_name: &str,
    device_id: &str,
    scan_key: &str,
    scan_generation: u64,
) -> (Vec<String>, Vec<String>) {
    let mut found_files = Vec::new();
    let mut scan_warnings = Vec::new();
    let (mut direct_files, _, mut warnings) = scan_ios_directory_shallow(
        shell,
        afcclient_cmd,
        package_name,
        device_id,
        "/Library",
        scan_key,
        scan_generation,
    ).await;
    found_files.append(&mut direct_files);
    scan_warnings.append(&mut warnings);

    (found_files, scan_warnings)
}

async fn collect_ios_database_files(
    app_handle: &tauri::AppHandle,
    device_id: &str,
    package_name: &str,
    remote_paths: Vec<String>,
    scan_key: &str,
    scan_generation: u64,
) -> Vec<DatabaseFile> {
    let mut database_files = Vec::new();

    for remote_path in remote_paths {
        if !is_ios_scan_active(scan_key, scan_generation) {
            info!("Stopping database file collection because scan {} was canceled", scan_key);
            break;
        }

        info!("🎯 Found database file: {}", remote_path);
        let filename = std::path::Path::new(&remote_path)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("unknown")
            .to_string();
        let location = location_from_remote_path(&remote_path);
        let access_type = access_type_for_remote_path(&remote_path);

        match pull_ios_db_file(
            app_handle,
            device_id,
            package_name,
            &remote_path,
            true,
            access_type,
        ).await {
            Ok(local_path) => {
                info!("✅ Successfully pulled file to: {}", local_path);
                let db_file = DatabaseFile {
                    path: local_path,
                    package_name: package_name.to_string(),
                    filename,
                    remote_path: Some(remote_path.clone()),
                    location,
                    device_type: "iphone-device".to_string(),
                };

                info!("Database file object created: {:?}", db_file);
                database_files.push(db_file);
            }
            Err(e) => {
                error!("❌ Failed to pull database file {}: {}", remote_path, e);
                let fallback_db_file = DatabaseFile {
                    path: remote_path.clone(),
                    package_name: package_name.to_string(),
                    filename,
                    remote_path: Some(remote_path.clone()),
                    location,
                    device_type: "iphone-device".to_string(),
                };

                info!("Fallback database file object created: {:?}", fallback_db_file);
                database_files.push(fallback_db_file);
            }
        }
    }

    database_files
}

fn emit_ios_scan_progress(
    app_handle: &tauri::AppHandle,
    scan_key: &str,
    scan_request_id: &str,
    scan_generation: u64,
    mode: &str,
    phase: &str,
    files: Vec<DatabaseFile>,
) {
    if !is_ios_scan_active(scan_key, scan_generation) {
        return;
    }

    let payload = IosDbScanProgressPayload {
        scan_key: scan_key.to_string(),
        scan_request_id: scan_request_id.to_string(),
        mode: mode.to_string(),
        phase: phase.to_string(),
        files,
    };

    if let Err(err) = app_handle.emit(IOS_SCAN_PROGRESS_EVENT, payload) {
        error!("❌ Failed to emit iOS DB scan progress event: {}", err);
    }
}

async fn scan_ios_library_path_recursive_if_exists(
    shell: &tauri_plugin_shell::Shell<tauri::Wry>,
    afcclient_cmd: &str,
    package_name: &str,
    device_id: &str,
    path: &str,
    scan_key: &str,
    scan_generation: u64,
) -> (Vec<String>, Vec<String>) {
    if !is_ios_scan_active(scan_key, scan_generation) {
        return (Vec::new(), vec![format!("Stopped scanning {} because the scan was canceled", path)]);
    }

    match ios_path_is_directory(
        shell,
        afcclient_cmd,
        package_name,
        device_id,
        path,
        access_type_for_remote_path(path),
    ).await {
        Ok(true) => scan_ios_directory_recursive(
            shell,
            afcclient_cmd,
            package_name,
            device_id,
            path,
            scan_key,
            scan_generation,
        ).await,
        Ok(false) => (Vec::new(), vec![format!("Skipping {} because it is not a directory", path)]),
        Err(err) => (Vec::new(), vec![format!("Skipping {}: {}", path, err)]),
    }
}

fn interpolate_library_path(template: &str, package_name: &str) -> String {
    template.replace("{bundle_id}", package_name)
}

/// Get database files from iOS physical device
#[tauri::command]
pub async fn get_ios_device_database_files(
    app_handle: tauri::AppHandle,
    device_id: String,
    package_name: String,
    scan_request_id: Option<String>,
) -> Result<DeviceResponse<Vec<DatabaseFile>>, String> {
    info!("=== GET iOS DEVICE DATABASE FILES STARTED ===");
    info!("Device ID: {}", device_id);
    info!("Package name: {}", package_name);
    
    info!("Step 1: Preparing temporary directory for pulled database files");
    // Preserve active temp database files so in-flight table reads do not lose
    // their local copy while a background rescan is still running.
    if let Err(e) = clean_temp_dir() {
        log::warn!("❌ Failed to prepare temp directory: {}", e);
    } else {
        info!("✅ Temp directory ready for pulled database files");
    }
    
    let shell = app_handle.shell();
    let mut database_files = Vec::new();
    let scan_key = format!("{}:{}", device_id, package_name);
    let scan_generation = begin_ios_scan(&scan_key);
    let scan_request_id = scan_request_id.unwrap_or_else(|| format!("{}:{}", scan_key, scan_generation));

    info!("Step 2: Scanning selected app container for database files");
    let afcclient_cmd = get_tool_command_legacy("afcclient");
    info!("Using afcclient command: {}", afcclient_cmd);

    let (document_remote_files, document_subdirectories, mut scan_warnings) = scan_ios_directory_shallow(
        &shell,
        &afcclient_cmd,
        &package_name,
        &device_id,
        "/Documents",
        &scan_key,
        scan_generation,
    ).await;

    let document_files = collect_ios_database_files(
        &app_handle,
        &device_id,
        &package_name,
        document_remote_files,
        &scan_key,
        scan_generation,
    ).await;

    if !document_files.is_empty() {
        emit_ios_scan_progress(
            &app_handle,
            &scan_key,
            &scan_request_id,
            scan_generation,
            "replace",
            "documents-root",
            document_files.clone(),
        );
        database_files.extend(document_files);
    }
    else {
        emit_ios_scan_progress(
            &app_handle,
            &scan_key,
            &scan_request_id,
            scan_generation,
            "replace",
            "documents-root",
            Vec::new(),
        );
    }

    for documents_directory in document_subdirectories {
        if !is_ios_scan_active(&scan_key, scan_generation) {
            info!("Stopping iOS scan after Documents root because scan {} was canceled", scan_key);
            break;
        }

        let (remote_files, mut warnings) = scan_ios_directory_recursive(
            &shell,
            &afcclient_cmd,
            &package_name,
            &device_id,
            &documents_directory,
            &scan_key,
            scan_generation,
        ).await;
        scan_warnings.append(&mut warnings);

        let documents_nested_files = collect_ios_database_files(
            &app_handle,
            &device_id,
            &package_name,
            remote_files,
            &scan_key,
            scan_generation,
        ).await;
        if !documents_nested_files.is_empty() {
            emit_ios_scan_progress(
                &app_handle,
                &scan_key,
                &scan_request_id,
                scan_generation,
                "append",
                "documents-nested",
                documents_nested_files.clone(),
            );
            database_files.extend(documents_nested_files);
        }
    }

    let (library_root_files, mut library_root_warnings) = scan_ios_library_root_direct_files(
        &shell,
        &afcclient_cmd,
        &package_name,
        &device_id,
        &scan_key,
        scan_generation,
    ).await;
    scan_warnings.append(&mut library_root_warnings);

    let library_root_files = collect_ios_database_files(
        &app_handle,
        &device_id,
        &package_name,
        library_root_files,
        &scan_key,
        scan_generation,
    ).await;
    if !library_root_files.is_empty() {
        emit_ios_scan_progress(
            &app_handle,
            &scan_key,
            &scan_request_id,
            scan_generation,
            "append",
            "library-root",
            library_root_files.clone(),
        );
        database_files.extend(library_root_files);
    }

    for (phase, path_template) in [
        ("library-application-support", IOS_LIBRARY_BACKGROUND_PATHS[0]),
        ("library-local-database", IOS_LIBRARY_BACKGROUND_PATHS[1]),
        ("library-bundle-folder", IOS_LIBRARY_BACKGROUND_PATHS[2]),
    ] {
        if !is_ios_scan_active(&scan_key, scan_generation) {
            info!("Stopping iOS scan before {} because scan {} was canceled", phase, scan_key);
            break;
        }

        let interpolated_path = interpolate_library_path(path_template, &package_name);
        let (remote_files, mut warnings) = scan_ios_library_path_recursive_if_exists(
            &shell,
            &afcclient_cmd,
            &package_name,
            &device_id,
            &interpolated_path,
            &scan_key,
            scan_generation,
        ).await;
        scan_warnings.append(&mut warnings);

        let phase_files = collect_ios_database_files(
            &app_handle,
            &device_id,
            &package_name,
            remote_files,
            &scan_key,
            scan_generation,
        ).await;

        if !phase_files.is_empty() {
            emit_ios_scan_progress(
                &app_handle,
                &scan_key,
                &scan_request_id,
                scan_generation,
                "append",
                phase,
                phase_files.clone(),
            );
            database_files.extend(phase_files);
        }
    }

    for warning in &scan_warnings {
        log::warn!("iOS scan warning: {}", warning);
    }
    
    info!("=== GET iOS DEVICE DATABASE FILES COMPLETED ===");
    info!("📊 Final Results Summary:");
    info!("  Total database files found: {}", database_files.len());
    info!("  Device ID: {}", device_id);
    info!("  Package name: {}", package_name);
    
    if database_files.is_empty() {
        info!("⚠️  No database files found in selected app container roots");
        info!("This could mean:");
        info!("   1. The app doesn't store database files in Library or Documents");
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

    finish_ios_scan(&scan_key, scan_generation);
    
    Ok(DeviceResponse {
        success: true,
        data: Some(database_files),
        error: None,
    })
}

#[tauri::command]
pub async fn refresh_ios_device_database_file(
    app_handle: tauri::AppHandle,
    device_id: String,
    package_name: String,
    remote_path: String,
) -> Result<DeviceResponse<DatabaseFile>, String> {
    info!("=== REFRESH iOS DEVICE DATABASE FILE STARTED ===");
    info!("Device ID: {}", device_id);
    info!("Package name: {}", package_name);
    info!("Remote path: {}", remote_path);

    let filename = std::path::Path::new(&remote_path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("unknown")
        .to_string();
    let location = location_from_remote_path(&remote_path);
    let access_type = access_type_for_remote_path(&remote_path);

    match pull_ios_db_file(
        &app_handle,
        &device_id,
        &package_name,
        &remote_path,
        true,
        access_type,
    ).await {
        Ok(local_path) => {
            let db_file = DatabaseFile {
                path: local_path,
                package_name,
                filename,
                remote_path: Some(remote_path),
                location,
                device_type: "iphone-device".to_string(),
            };

            Ok(DeviceResponse {
                success: true,
                data: Some(db_file),
                error: None,
            })
        }
        Err(error) => Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(error.to_string()),
        }),
    }
}

#[tauri::command]
pub async fn cancel_ios_device_database_scan(
    scan_key: String,
) -> Result<DeviceResponse<bool>, String> {
    cancel_ios_scan(&scan_key);

    Ok(DeviceResponse {
        success: true,
        data: Some(true),
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

    if let Err(e) = prepare_sqlite_file_for_sync(&local_path) {
        error!("❌ Failed to prepare SQLite file for sync: {}", e);
        return Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(format!("Failed to prepare SQLite file for sync: {}", e)),
        });
    }
    
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
    let access_type = access_type_for_remote_path(&remote_path);
    let access_args = access_type.afcclient_args(&package_name);
    
    // Check if file exists on device first
    let check_args = [
        access_args[0], access_args[1],
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
            access_args[0], access_args[1],
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
        access_args[0], access_args[1],
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
        access_args[0], access_args[1],
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_and_append_ios_paths() {
        assert_eq!(normalize_ios_dir_path("Library"), "/Library");
        assert_eq!(normalize_ios_dir_path("/Documents/"), "/Documents");
        assert_eq!(append_ios_path("/Library", "Application Support"), "/Library/Application Support");
    }

    #[test]
    fn test_location_and_access_type_follow_remote_root() {
        assert_eq!(location_from_remote_path("/Library/main.sqlite"), "Library");
        assert_eq!(location_from_remote_path("/Documents/user.db"), "Documents");
        assert!(matches!(
            access_type_for_remote_path("/Library/main.sqlite"),
            IosAppAccessType::Container
        ));
        assert!(matches!(
            access_type_for_remote_path("/Documents/user.db"),
            IosAppAccessType::Container
        ));
    }

    #[test]
    fn test_matches_bundle_folder_name_is_exact() {
        assert!(matches_bundle_folder_name("/Library/com.example.app", "com.example.app"));
        assert!(!matches_bundle_folder_name("/Library/Application Support", "com.example.app"));
        assert!(!matches_bundle_folder_name("/Library/app", "com.example.app"));
    }
}
