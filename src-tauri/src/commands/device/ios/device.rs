//! iOS Device Detection and Information
//! 
//! This module handles the detection and retrieval of information
//! from connected iOS devices.

use super::super::types::{DeviceResponse, Device};
use super::tools::get_tool_command_legacy;
use super::diagnostic::get_ios_error_help;
use tauri_plugin_shell::ShellExt;
use log::{info, error};
use std::time::Duration;

/// Get list of connected iOS devices
#[tauri::command]
pub async fn device_get_ios_devices(app_handle: tauri::AppHandle) -> Result<DeviceResponse<Vec<Device>>, String> {
    info!("=== GET iOS DEVICES STARTED ===");
    println!("🍎 [iOS] Starting iOS device detection...");
    
    let shell = app_handle.shell();
    let idevice_id_cmd = get_tool_command_legacy("idevice_id");
    
    println!("🍎 [iOS] Using idevice_id command: {}", idevice_id_cmd);

    // Get list of device IDs (local USB devices only)
    let output = shell.command(&idevice_id_cmd)
        .args(["-l"])
        .output()
        .await
        .map_err(|e| {
            let error_msg = format!("Failed to execute idevice_id -l: {}", e);
            println!("🍎 [iOS] ERROR: {}", error_msg);
            error_msg
        })?;

    println!("🍎 [iOS] idevice_id exit status: {:?}", output.status);
    info!("idevice_id exit status: {:?}", output);
    
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        println!("🍎 [iOS] ERROR: idevice_id failed: {}", error_msg);
        error!("❌ idevice_id command failed: {}", error_msg);
        return Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(error_msg.to_string()),
        });
    }
    
    let device_ids = String::from_utf8_lossy(&output.stdout);
    println!("🍎 [iOS] Device IDs found: {} characters", device_ids.len());
    info!("📱 Raw device IDs from idevice_id -l:");
    for (i, line) in device_ids.lines().enumerate() {
        println!("🍎 [iOS] Line {}: '{}'", i + 1, line);
        info!("  Line {}: '{}'", i + 1, line);
    }
    
    let mut devices = Vec::new();
    
    // Process each device ID
    for device_line in device_ids.lines() {
        let device_id = device_line.trim();
        if device_id.is_empty() {
            continue;
        }
        
        info!("🔍 Processing device ID: '{}'", device_id);
        println!("🍎 [iOS] Processing device ID: '{}'", device_id);
        
        // Get device name using ideviceinfo
        let ideviceinfo_cmd = get_tool_command_legacy("ideviceinfo");
        println!("🍎 [iOS] Using ideviceinfo: {}", ideviceinfo_cmd);
        let device_name = match shell.command(&ideviceinfo_cmd)
            .args(["-u", device_id])
            .output()
            .await 
        {
            Ok(info_result) if info_result.status.success() => {
                let device_info = String::from_utf8_lossy(&info_result.stdout);
                
                // Find DeviceName line and extract name
                device_info
                    .lines()
                    .find(|line| line.trim().starts_with("DeviceName: "))
                    .map(|line| line.replace("DeviceName: ", ""))
                    .unwrap_or_else(|| "iPhone Device".to_string())
            }
            _ => "iPhone Device".to_string()
        };
        
        let device = Device {
            id: device_id.to_string(),
            name: device_name,
            model: "iPhone".to_string(),
            device_type: "iphone-device".to_string(),
            description: "iPhone Device".to_string(),
        };
        
        devices.push(device);
    }
    
    info!("📊 Final device list:");
    println!("🍎 [iOS] Final device list:");
    for (i, device) in devices.iter().enumerate() {
        println!("🍎 [iOS] Device {}: ID='{}', Name='{}'", i + 1, device.id, device.name);
        info!("  Device {}: ID='{}', Name='{}'", i + 1, device.id, device.name);
    }
    println!("🍎 [iOS] Found {} iOS devices total", devices.len());
    info!("Found {} iOS devices total", devices.len());
    
    Ok(DeviceResponse {
        success: true,
        data: Some(devices),
        error: None,
    })
}

/// Check if an app exists on an iOS device
#[tauri::command]
pub async fn device_check_app_existence(
    app_handle: tauri::AppHandle,
    device_id: String,
    package_name: String,
) -> Result<DeviceResponse<bool>, String> {
    info!("=== CHECK iOS APP EXISTENCE STARTED ===");
    info!("Device ID: {}", device_id);
    info!("Package name: {}", package_name);
    
    info!("Step 1: Using ideviceinstaller to check app existence");
    let shell = app_handle.shell();
    let ideviceinstaller_cmd = get_tool_command_legacy("ideviceinstaller");
    info!("Using ideviceinstaller command: {}", ideviceinstaller_cmd);
    
    info!("🕐 Starting ideviceinstaller with 30s timeout...");
    let output = tokio::time::timeout(
        Duration::from_secs(30),
        shell.command(&ideviceinstaller_cmd)
            .args(["-u", &device_id, "-l"])
            .output()
    )
    .await
    .map_err(|_| "ideviceinstaller command timed out after 30 seconds".to_string())?
    .map_err(|e| format!("Failed to execute ideviceinstaller: {}", e))?;
    
    info!("ideviceinstaller exit status: {:?}", output.status);
    
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        error!("❌ ideviceinstaller command failed: {}", error_msg);
        
        // Provide user-friendly error message with specific diagnostics
        let user_friendly_error = get_ios_error_help(&error_msg);
        
        return Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(user_friendly_error),
        });
    }
    
    info!("Step 2: Parsing installed apps list");
    let apps_output = String::from_utf8_lossy(&output.stdout);
    
    // Debug: Log the raw output
    info!("📱 Raw ideviceinstaller output for app check:");
    info!("Output length: {} characters", apps_output.len());
    info!("First 500 characters: {}", 
          if apps_output.len() > 500 { &apps_output[..500] } else { &apps_output });
    
    // Debug: Log each line with line numbers
    info!("📝 Line by line breakdown:");
    for (i, line) in apps_output.lines().enumerate().take(5) {
        info!("  Line {}: '{}'", i + 1, line);
    }
    if apps_output.lines().count() > 5 {
        info!("  ... and {} more lines", apps_output.lines().count() - 5);
    }
    
    // Check if package exists in any line
    let app_exists = apps_output.lines()
        .enumerate()
        .any(|(i, line)| {
            let contains = line.contains(&package_name);
            if contains {
                info!("✅ Found package '{}' in line {}: '{}'", package_name, i + 1, line);
            }
            contains
        });
    
    if !app_exists {
        info!("❌ Package '{}' not found in any line", package_name);
    }
    
    info!("✅ App existence check completed");
    info!("App '{}' exists on device '{}': {}", package_name, device_id, app_exists);
    
    Ok(DeviceResponse {
        success: true,
        data: Some(app_exists),
        error: None,
    })
}
