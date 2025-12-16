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

/// Get detailed iOS device information
#[tauri::command]
pub async fn ios_get_device_info(app_handle: tauri::AppHandle, device_id: String) -> Result<DeviceResponse<std::collections::HashMap<String, String>>, String> {
    info!("Getting iOS device info for device: {}", device_id);
    
    match get_ios_device_detailed_info(&app_handle, &device_id).await {
        Ok(info) => {
            info!("Successfully retrieved iOS device info with {} properties", info.len());
            Ok(DeviceResponse {
                success: true,
                data: Some(info),
                error: None,
            })
        },
        Err(e) => {
            error!("Failed to get iOS device info: {}", e);
            
            // Return mock data for testing if real command fails
            let mut mock_info = std::collections::HashMap::new();
            mock_info.insert("Device ID".to_string(), device_id.clone());
            mock_info.insert("Status".to_string(), "Mock Data - Real command failed".to_string());
            mock_info.insert("Error".to_string(), format!("{}", e));
            
            Ok(DeviceResponse {
                success: true,
                data: Some(mock_info),
                error: Some(format!("Using mock data - real command failed: {}", e)),
            })
        }
    }
}

// Get detailed iOS device information using ideviceinfo for physical devices or xcrun simctl for simulators
async fn get_ios_device_detailed_info(app_handle: &tauri::AppHandle, device_id: &str) -> Result<std::collections::HashMap<String, String>, Box<dyn std::error::Error + Send + Sync>> {
    info!("Getting detailed iOS device info for device: {}", device_id);
    
    // Detect if this is a simulator based on device ID patterns
    // For simulators, we need to check if the device exists in the simulator list
    // rather than relying on ID format, since simulator UDIDs are standard UUIDs
    let is_simulator = device_id.contains("com.apple.CoreSimulator") || 
                      device_id.contains("SimRuntime") ||
                      device_id.contains("iPhone") || 
                      device_id.contains("iPad") ||
                      is_device_a_simulator(device_id).await;
    
    info!("Device type detection - is_simulator: {}, device_id length: {}", is_simulator, device_id.len());
    
    if is_simulator {
        get_simulator_device_info(app_handle, device_id).await
    } else {
        get_physical_device_info(app_handle, device_id).await
    }
}

// Get simulator device information using xcrun simctl
async fn get_simulator_device_info(app_handle: &tauri::AppHandle, device_id: &str) -> Result<std::collections::HashMap<String, String>, Box<dyn std::error::Error + Send + Sync>> {
    info!("Getting simulator device info using xcrun simctl for: {}", device_id);
    
    let shell = app_handle.shell();
    
    // First, get detailed info for this specific simulator
    let output = shell.command("xcrun")
        .args(["simctl", "list", "--json", "devices"])
        .output()
        .await
        .map_err(|e| format!("Failed to execute xcrun simctl: {}", e))?;
    
    info!("xcrun simctl exit status: {:?}", output.status);
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        error!("xcrun simctl command failed. Stderr: {}", stderr);
        return Err(format!("xcrun simctl command failed: {}", stderr).into());
    }
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    info!("xcrun simctl output length: {} characters", stdout.len());
    
    // Parse JSON output
    let json_data: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse JSON from xcrun simctl: {}", e))?;
    
    let mut device_info = std::collections::HashMap::new();
    
    // Find the simulator in the JSON data
    if let Some(devices) = json_data.get("devices").and_then(|d| d.as_object()) {
        let mut found = false;
        for (runtime_name, device_list) in devices {
            if let Some(device_array) = device_list.as_array() {
                for device in device_array {
                    // Check both udid and the full device identifier
                    let device_udid = device.get("udid").and_then(|u| u.as_str()).unwrap_or("");
                    let device_name = device.get("name").and_then(|n| n.as_str()).unwrap_or("");
                    
                    // Match by UDID or by device name pattern
                    if device_udid == device_id || device_id.contains(device_name) {
                        found = true;
                        info!("Found simulator in runtime: {}", runtime_name);
                        
                        // Extract device information
                        if let Some(name) = device.get("name").and_then(|n| n.as_str()) {
                            device_info.insert("Device Name".to_string(), name.to_string());
                        }
                        
                        if let Some(state) = device.get("state").and_then(|s| s.as_str()) {
                            device_info.insert("State".to_string(), state.to_string());
                        }
                        
                        if let Some(udid) = device.get("udid").and_then(|u| u.as_str()) {
                            device_info.insert("UDID".to_string(), udid.to_string());
                        }
                        
                        if let Some(availability) = device.get("availability").and_then(|a| a.as_str()) {
                            device_info.insert("Availability".to_string(), availability.to_string());
                        }
                        
                        // Extract iOS version from runtime name
                        // Runtime name format: "com.apple.CoreSimulator.SimRuntime.iOS-15-5" or similar
                        if let Some(ios_version) = extract_ios_version_from_runtime(runtime_name) {
                            info!("Extracted iOS version: {}", ios_version);
                            device_info.insert("iOS Version".to_string(), ios_version);
                        }
                        
                        device_info.insert("Device Type".to_string(), "iOS Simulator".to_string());
                        device_info.insert("Platform".to_string(), "iOS".to_string());
                        
                        break;
                    }
                }
                if found { break; }
            }
        }
        
        if !found {
            return Err(format!("Simulator with ID '{}' not found", device_id).into());
        }
    } else {
        return Err("Invalid JSON response from xcrun simctl".into());
    }
    
    // Add device ID
    device_info.insert("Device ID".to_string(), device_id.to_string());
    
    info!("Successfully retrieved {} simulator properties", device_info.len());
    
    Ok(device_info)
}

// Check if a device ID corresponds to an iOS simulator by querying xcrun simctl
async fn is_device_a_simulator(device_id: &str) -> bool {
    // Quick check: if it's clearly not a UUID format, it's probably not a simulator
    if device_id.len() != 36 || !device_id.contains('-') {
        return false;
    }
    
    // Use xcrun simctl to check if this device exists in the simulator list
    match std::process::Command::new("xcrun")
        .args(["simctl", "list", "--json", "devices"])
        .output()
    {
        Ok(output) => {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                // Simple check: does the device ID appear in the simulator list?
                return stdout.contains(device_id);
            }
        }
        Err(_) => {
            // If xcrun is not available, fall back to assuming it's not a simulator
            return false;
        }
    }
    false
}

// Extract iOS version from runtime name
fn extract_ios_version_from_runtime(runtime_name: &str) -> Option<String> {
    // Examples:
    // "com.apple.CoreSimulator.SimRuntime.iOS-15-5" -> "15.5"
    // "com.apple.CoreSimulator.SimRuntime.iOS-16-4" -> "16.4"
    if runtime_name.contains("iOS-") {
        if let Some(start) = runtime_name.find("iOS-") {
            let version_part = &runtime_name[start + 4..];
            // Replace hyphens with dots for version format
            let version = version_part.replace('-', ".");
            return Some(version);
        }
    }
    None
}

// Get physical device information using ideviceinfo
async fn get_physical_device_info(app_handle: &tauri::AppHandle, device_id: &str) -> Result<std::collections::HashMap<String, String>, Box<dyn std::error::Error + Send + Sync>> {
    info!("Getting detailed iOS device info for device: {}", device_id);
    
    let shell = app_handle.shell();
    let ideviceinfo_cmd = get_tool_command_legacy("ideviceinfo");
    info!("Using ideviceinfo command: {}", ideviceinfo_cmd);
    
    let output = shell.command(&ideviceinfo_cmd)
        .args(["-u", device_id])
        .output()
        .await
        .map_err(|e| format!("Failed to execute ideviceinfo: {}", e))?;
    
    info!("ideviceinfo exit status: {:?}", output.status);
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        error!("ideviceinfo command failed. Stderr: {}", stderr);
        return Err(format!("ideviceinfo command failed: {}", stderr).into());
    }
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    info!("ideviceinfo output length: {} characters", stdout.len());
    
    let mut device_info = std::collections::HashMap::new();
    let mut processed_lines = 0;
    
    // Parse ideviceinfo output (key: value format)
    for line in stdout.lines() {
        if let Some(colon_pos) = line.find(':') {
            let key = line[..colon_pos].trim();
            let value = line[colon_pos + 1..].trim();
            
            // Only include relevant device info properties
            match key {
                "DeviceName" => { 
                    device_info.insert("Device Name".to_string(), value.to_string()); 
                    info!("Found device name: {}", value);
                },
                "ProductType" => { 
                    device_info.insert("Product Type".to_string(), value.to_string()); 
                    info!("Found product type: {}", value);
                },
                "ProductVersion" => { 
                    device_info.insert("iOS Version".to_string(), value.to_string()); 
                    info!("Found iOS version: {}", value);
                },
                "BuildVersion" => { device_info.insert("Build Version".to_string(), value.to_string()); },
                "ModelNumber" => { device_info.insert("Model Number".to_string(), value.to_string()); },
                "CPUArchitecture" => { device_info.insert("CPU Architecture".to_string(), value.to_string()); },
                "HardwarePlatform" => { device_info.insert("Hardware Platform".to_string(), value.to_string()); },
                "SerialNumber" => { device_info.insert("Serial Number".to_string(), value.to_string()); },
                "UniqueDeviceID" => { device_info.insert("UDID".to_string(), value.to_string()); },
                "TotalDiskCapacity" => { device_info.insert("Storage Capacity".to_string(), format_bytes(value.parse().unwrap_or(0))); },
                "TotalSystemAvailable" => { device_info.insert("Available Storage".to_string(), format_bytes(value.parse().unwrap_or(0))); },
                _ => {}
            }
            processed_lines += 1;
        }
    }
    
    info!("Processed {} lines from ideviceinfo output", processed_lines);
    
    // Add device ID
    device_info.insert("Device ID".to_string(), device_id.to_string());
    
    info!("Successfully retrieved {} iOS device properties", device_info.len());
    
    if device_info.len() <= 1 {
        // Only device ID was added, no properties found
        error!("No iOS device properties found in ideviceinfo output");
        return Err("No device properties could be retrieved from the iOS device".into());
    }
    
    Ok(device_info)
}

// Helper function to format bytes to human readable format
fn format_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_index = 0;
    
    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }
    
    if unit_index == 0 {
        format!("{} {}", bytes, UNITS[unit_index])
    } else {
        format!("{:.1} {}", size, UNITS[unit_index])
    }
}
