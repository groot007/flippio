//! File Transfer and Utility Functions
//! 
//! This module provides file transfer utilities and helper functions
//! for iOS device file operations.

use super::super::helpers::{ensure_temp_dir};
use super::super::types::{DatabaseFileMetadata};
use super::tools::get_tool_command;
use tauri_plugin_shell::ShellExt;
use log::{info, error};
use std::path::Path;
use std::fs;
use chrono;
use serde_json;

/// Pull iOS database file to local temp directory
pub async fn pull_ios_db_file(
    app_handle: &tauri::AppHandle,
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
    info!("✅ Extracted filename: {}", filename);
    
    info!("Step 3: Creating local file path");
    let local_path = temp_dir.join(&*filename);
    info!("✅ Local path: {}", local_path.display());
    
    if is_device {
        info!("Step 4: Pulling from physical iOS device using afcclient");
        let afcclient_cmd = get_tool_command("afcclient");
        info!("Using afcclient command: {}", afcclient_cmd);
        
        // Use afcclient to pull file from device
        let args = [
            "--documents", package_name,
            "-u", device_id,
            "get", remote_path, local_path.to_str().unwrap()
        ];
        info!("Pull command: {} {}", afcclient_cmd, args.join(" "));
        
        let shell = app_handle.shell();
        
        let output = shell.command(&afcclient_cmd)
            .args(args)
            .output()
            .await
            .map_err(|e| format!("Failed to execute afcclient: {}", e))?;
        
        info!("afcclient exit status: {:?}", output.status);
        if !output.stdout.is_empty() {
            info!("afcclient stdout: {}", String::from_utf8_lossy(&output.stdout));
        }
        if !output.stderr.is_empty() {
            info!("afcclient stderr: {}", String::from_utf8_lossy(&output.stderr));
        }
        
        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            error!("❌ afcclient command failed: {}", error_msg);
            return Err(format!("iOS pull failed: {}", error_msg).into());
        }
    } else {
        error!("❌ Simulator file pulling should use different method");
        return Err("Invalid device type for this function".into());
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
    info!("Metadata file path: {}", metadata_path);
    
    match serde_json::to_string_pretty(&metadata) {
        Ok(metadata_json) => {
            if let Err(e) = fs::write(&metadata_path, metadata_json) {
                error!("⚠️  Failed to write metadata file: {}", e);
                // Don't fail the entire operation for metadata write failure
            } else {
                info!("✅ Metadata file written successfully");
            }
        }
        Err(e) => {
            error!("⚠️  Failed to serialize metadata: {}", e);
            // Don't fail the entire operation for metadata serialization failure
        }
    }
    
    let final_path = local_path.to_string_lossy().to_string();
    info!("✅ File pull completed successfully: {}", final_path);
    
    Ok(final_path)
}

/// Manual file copy function as a fallback when std::fs::copy fails
pub fn manual_file_copy(source: &str, destination: &str) -> Result<u64, std::io::Error> {
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
