//! iOS Package and Application Management
//! 
//! This module handles iOS package detection and management for both
//! simulators and physical devices.

use super::super::types::{DeviceResponse, Package};
use super::tools::get_tool_command;
use tauri_plugin_shell::ShellExt;
use log::{info, error};

/// Get list of iOS packages (for simulators)
#[tauri::command]
pub async fn device_get_ios_packages(app_handle: tauri::AppHandle, device_id: String) -> Result<DeviceResponse<Vec<Package>>, String> {
    info!("=== GET iOS PACKAGES STARTED (SIMULATOR) ===");
    info!("Device ID (Simulator): {}", device_id);
    
    info!("Step 1: Using xcrun simctl to get installed apps");
    let shell = app_handle.shell();
    
    let output = shell.command("xcrun")
        .args(["simctl", "listapps", &device_id])
        .output()
        .await
        .map_err(|e| format!("Failed to execute xcrun simctl listapps: {}", e))?;
    
    info!("xcrun simctl listapps exit status: {:?}", output.status);
    
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        error!("❌ xcrun simctl listapps command failed: {}", error_msg);
        return Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(error_msg.to_string()),
        });
    }
    
    info!("Step 2: Parsing simulator apps output");
    let apps_output = String::from_utf8_lossy(&output.stdout);
    let mut packages = Vec::new();
    
    // Log the raw output for debugging
    info!("Raw simctl output (first 200 chars): {}", 
          if apps_output.len() > 200 { &apps_output[..200] } else { &apps_output });
    
    // Parse plist-like output from simctl listapps
    // Format: "bundle.id" = { key = value; ... };
    let mut current_bundle_id: Option<String> = None;
    let mut current_display_name: Option<String> = None;
    let mut current_bundle_name: Option<String> = None;
    
    for line in apps_output.lines() {
        let line = line.trim();
        
        // Look for bundle ID line: "com.example.app" = {
        if line.contains(" = ") && line.ends_with(" {") {
            // Save previous app if we have complete info
            if let Some(bundle_id) = current_bundle_id.take() {
                let app_name = current_display_name.clone()
                    .or(current_bundle_name.clone())
                    .unwrap_or_else(|| bundle_id.clone());
                
                // Clean the bundle ID and app name in case they have trailing commas or whitespace
                let clean_bundle_id = bundle_id.trim().trim_end_matches(',').to_string();
                let clean_app_name = app_name.trim().trim_end_matches(',').to_string();
                
                if clean_bundle_id != bundle_id || clean_app_name != app_name {
                    info!("🧹 Cleaned simulator package: '{}' -> '{}', name: '{}' -> '{}'", 
                          bundle_id, clean_bundle_id, app_name, clean_app_name);
                }
                
                let package = Package {
                    name: clean_app_name.clone(),
                    bundle_id: clean_bundle_id.clone(),
                };
                
                info!("Found app: {} ({})", package.name, package.bundle_id);
                packages.push(package);
            }
            
            // Extract new bundle ID
            if let Some(equals_pos) = line.find(" = ") {
                let bundle_part = &line[..equals_pos];
                // Remove quotes if present
                let bundle_id = bundle_part.trim_matches('"').trim_matches('\'');
                current_bundle_id = Some(bundle_id.to_string());
                current_display_name = None;
                current_bundle_name = None;
            }
        }
        // Look for CFBundleDisplayName
        else if line.contains("CFBundleDisplayName = ") {
            if let Some(equals_pos) = line.find(" = ") {
                let value_part = &line[equals_pos + 3..];
                let value = value_part.trim_end_matches(';').trim_matches('"').trim_matches('\'');
                current_display_name = Some(value.to_string());
            }
        }
        // Look for CFBundleName as fallback
        else if line.contains("CFBundleName = ") && current_display_name.is_none() {
            if let Some(equals_pos) = line.find(" = ") {
                let value_part = &line[equals_pos + 3..];
                let value = value_part.trim_end_matches(';').trim_matches('"').trim_matches('\'');
                current_bundle_name = Some(value.to_string());
            }
        }
    }
    
    // Don't forget the last app
    if let Some(bundle_id) = current_bundle_id {
        let app_name = current_display_name
            .or(current_bundle_name)
            .unwrap_or_else(|| bundle_id.clone());
        
        // Clean the bundle ID and app name in case they have trailing commas or whitespace
        let clean_bundle_id = bundle_id.trim().trim_end_matches(',').to_string();
        let clean_app_name = app_name.trim().trim_end_matches(',').to_string();
        
        if clean_bundle_id != bundle_id || clean_app_name != app_name {
            info!("🧹 Cleaned last simulator package: '{}' -> '{}', name: '{}' -> '{}'", 
                  bundle_id, clean_bundle_id, app_name, clean_app_name);
        }
        
        let package = Package {
            name: clean_app_name.clone(),
            bundle_id: clean_bundle_id.clone(),
        };
        
        info!("Found app: {} ({})", package.name, package.bundle_id);
        packages.push(package);
    }
    
    info!("=== GET iOS PACKAGES COMPLETED ===");
    info!("Found {} packages on simulator", packages.len());
    
    Ok(DeviceResponse {
        success: true,
        data: Some(packages),
        error: None,
    })
}

/// Get list of iOS packages from physical device
#[tauri::command]
pub async fn device_get_ios_device_packages(app_handle: tauri::AppHandle, device_id: String) -> Result<DeviceResponse<Vec<Package>>, String> {
    info!("=== GET iOS DEVICE PACKAGES STARTED ===");
    info!("Device ID: {}", device_id);
    
    info!("Step 1: Using ideviceinstaller to get installed apps");
    let shell = app_handle.shell();
    let ideviceinstaller_cmd = get_tool_command("ideviceinstaller");
    info!("Using ideviceinstaller command: {}", ideviceinstaller_cmd);
    
    let output = shell.command(&ideviceinstaller_cmd)
        .args(["-u", &device_id, "-l"])
        .output()
        .await
        .map_err(|e| format!("Failed to execute ideviceinstaller: {}", e))?;
    
    info!("ideviceinstaller exit status: {:?}", output.status);
    
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        error!("❌ ideviceinstaller command failed: {}", error_msg);
        return Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(error_msg.to_string()),
        });
    }
    
    info!("Step 2: Parsing installed apps list");
    let apps_output = String::from_utf8_lossy(&output.stdout);
    
    // Debug: Log the raw output
    info!("📱 Raw ideviceinstaller output:");
    info!("Output length: {} characters", apps_output.len());
    info!("First 500 characters: {}", 
          if apps_output.len() > 500 { &apps_output[..500] } else { &apps_output });
    
    // Debug: Log each line with line numbers
    info!("📝 Line by line breakdown:");
    for (i, line) in apps_output.lines().enumerate().take(10) {
        info!("  Line {}: '{}'", i + 1, line);
    }
    if apps_output.lines().count() > 10 {
        info!("  ... and {} more lines", apps_output.lines().count() - 10);
    }
    
    let mut packages = Vec::new();
    
    // Parse the output from ideviceinstaller -l
    for (line_num, line) in apps_output.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        
        info!("🔍 Processing line {}: '{}'", line_num + 1, line);
        
        // Try different parsing approaches
        let (bundle_id, app_name) = if let Some(dash_pos) = line.find(" - ") {
            // Format: "BundleID - AppName"
            let bundle_id = line[..dash_pos].trim();
            let app_name = line[dash_pos + 3..].trim();
            info!("  ✅ Parsed with dash format: '{}' - '{}'", bundle_id, app_name);
            (bundle_id, app_name)
        } else if line.contains('\t') {
            // Tab-separated format
            let parts: Vec<&str> = line.split('\t').collect();
            if parts.len() >= 2 {
                info!("  ✅ Parsed with tab format: '{}' - '{}'", parts[0].trim(), parts[1].trim());
                (parts[0].trim(), parts[1].trim())
            } else {
                info!("  ❌ Tab format but insufficient parts");
                continue;
            }
        } else if line.contains(' ') {
            // Space-separated, assume first word is bundle ID, rest is name
            let parts: Vec<&str> = line.splitn(2, ' ').collect();
            if parts.len() >= 2 {
                info!("  ✅ Parsed with space format: '{}' - '{}'", parts[0].trim(), parts[1].trim());
                (parts[0].trim(), parts[1].trim())
            } else {
                info!("  ❌ Space format but insufficient parts");
                continue;
            }
        } else {
            // Single word, use as both bundle ID and name
            info!("  ✅ Using as bundle ID only: '{}'", line);
            (line, line)
        };
        
        if !bundle_id.is_empty() {
            // Clean the bundle ID in case it has trailing commas or whitespace
            let clean_bundle_id = bundle_id.trim().trim_end_matches(',').to_string();
            let mut clean_app_name = app_name.trim().trim_end_matches(',').to_string();
            
            // Handle the format: "version", "AppName" -> AppName (version)
            if clean_app_name.contains(", ") && clean_app_name.starts_with('"') {
                let parts: Vec<&str> = clean_app_name.split(", ").collect();
                if parts.len() >= 2 {
                    // Extract version (first part) and app name (last part)
                    let version = parts[0].trim_matches('"').trim();
                    let app_name_part = parts[parts.len() - 1].trim_matches('"').trim();
                    
                    if !version.is_empty() && !app_name_part.is_empty() {
                        clean_app_name = format!("{} ({})", app_name_part, version);
                        info!("🔄 Reformatted app name: '{}' -> '{}'", app_name, clean_app_name);
                    }
                }
            } else {
                // Just clean quotes and whitespace for other formats
                clean_app_name = clean_app_name.trim_matches('"').trim().to_string();
            }
            
            if clean_bundle_id != bundle_id || clean_app_name != app_name {
                info!("🧹 Cleaned package: '{}' -> '{}', name: '{}' -> '{}'", 
                      bundle_id, clean_bundle_id, app_name, clean_app_name);
            }
            
            let package = Package {
                name: clean_app_name,
                bundle_id: clean_bundle_id,
            };
            
            info!("✅ Found app: {} ({})", package.name, package.bundle_id);
            packages.push(package);
        } else {
            info!("  ❌ Empty bundle ID, skipping");
        }
    }
    
    info!("=== GET iOS DEVICE PACKAGES COMPLETED ===");
    info!("Found {} packages on device", packages.len());
    
    Ok(DeviceResponse {
        success: true,
        data: Some(packages),
        error: None,
    })
}
