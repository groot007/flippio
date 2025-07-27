//! iOS Device Management
//! 
//! This module handles the detection and retrieval of information
//! from connected iOS physical devices via libimobiledevice tools.

use crate::commands::device::types::{DeviceResponse, Device};
use crate::commands::device::ios::tools::get_tool_command_legacy;
use crate::commands::device::ios::diagnostic::get_ios_error_help;
use tauri_plugin_shell::ShellExt;
use log::{info, error};
use std::time::Duration;

/// Get list of connected iOS devices
#[tauri::command]
pub async fn device_get_ios_devices(app_handle: tauri::AppHandle) -> Result<DeviceResponse<Vec<Device>>, String> {
    info!("=== GET iOS DEVICES STARTED ===");
    
    let shell = app_handle.shell();
    let idevice_id_cmd = get_tool_command_legacy("idevice_id");
    
    // Get list of device IDs (local USB devices only)
    let output = shell.command(&idevice_id_cmd)
        .args(["-l"])
        .output()
        .await
        .map_err(|e| format!("Failed to execute idevice_id -l: {}", e))?;

    info!("idevice_id exit status: {:?}", output);
    
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        error!("❌ idevice_id command failed: {}", error_msg);
        return Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(error_msg.to_string()),
        });
    }
    
    let device_ids = String::from_utf8_lossy(&output.stdout);
    info!("📱 Raw device IDs from idevice_id -l:");
    for (i, line) in device_ids.lines().enumerate() {
        info!("  Line {}: '{}'", i + 1, line);
    }
    
    let mut devices = Vec::new();
    
    // Process each device ID
    for device_line in device_ids.lines() {
        let device_id = device_line.trim();
        
        if device_id.is_empty() {
            continue;
        }
        
        info!("Processing device ID: '{}'", device_id);
        
        // Get device name using ideviceinfo
        let ideviceinfo_cmd = get_tool_command_legacy("ideviceinfo");
        
        info!("🕐 Starting ideviceinfo with 15s timeout...");
        let info_output = tokio::time::timeout(
            Duration::from_secs(15),
            shell.command(&ideviceinfo_cmd)
                .args(["-u", device_id, "-k", "DeviceName"])
                .output()
        )
        .await
        .map_err(|_| "ideviceinfo command timed out after 15 seconds".to_string())?
        .map_err(|e| format!("Failed to execute ideviceinfo: {}", e))?;
        
        info!("ideviceinfo exit status: {:?}", info_output.status);
        
        let device_name = if info_output.status.success() {
            let name = String::from_utf8_lossy(&info_output.stdout).trim().to_string();
            info!("📱 Device name from ideviceinfo: '{}'", name);
            if name.is_empty() {
                format!("iOS Device {}", device_id)
            } else {
                name
            }
        } else {
            error!("❌ Failed to get device name for {}", device_id);
            format!("iOS Device {}", device_id)
        };
        
        let device = Device {
            id: device_id.to_string(),
            name: device_name,
            description: "iOS Device".to_string(),
        };
        
        info!("✅ Added device: {} ({})", device.name, device.id);
        devices.push(device);
    }
    
    info!("=== GET iOS DEVICES COMPLETED ===");
    info!("Total devices found: {}", devices.len());
    
    Ok(DeviceResponse {
        success: true,
        data: Some(devices),
        error: None,
    })
}

/// Check if a specific app exists on an iOS device
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
    for (i, line) in apps_output.lines().enumerate().take(10) {
        info!("  Line {}: '{}'", i + 1, line);
    }
    
    // Look for the package name in the output
    let app_exists = apps_output.lines().any(|line| {
        let line = line.trim();
        line.contains(&package_name) || 
        line.starts_with(&format!("{} -", package_name)) ||
        line.starts_with(&format!("{},", package_name))
    });
    
    info!("Step 3: App existence check result");
    info!("Package '{}' exists on device '{}': {}", package_name, device_id, app_exists);
    
    Ok(DeviceResponse {
        success: true,
        data: Some(app_exists),
        error: None,
    })
}

/// Check if a specific iOS device is connected
pub async fn is_ios_device_connected(app_handle: tauri::AppHandle, device_id: &str) -> Result<bool, String> {
    let devices_response = device_get_ios_devices(app_handle).await?;
    
    if let Some(devices) = devices_response.data {
        Ok(devices.iter().any(|device| device.id == device_id))
    } else {
        Ok(false)
    }
}

/// Get iOS device information
pub async fn get_ios_device_info(app_handle: tauri::AppHandle, device_id: &str) -> Result<Option<Device>, String> {
    let devices_response = device_get_ios_devices(app_handle).await?;
    
    if let Some(devices) = devices_response.data {
        Ok(devices.into_iter().find(|device| device.id == device_id))
    } else {
        Ok(None)
    }
} 