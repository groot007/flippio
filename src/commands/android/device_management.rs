//! Android Device Management
//! 
//! This module handles Android device detection, connection status,
//! and device information retrieval via ADB.

use crate::commands::device::discovery::DeviceScanner;
use crate::commands::device::types::{DeviceResponse, Device};
use log::info;

/// Get list of connected Android devices
#[tauri::command]
pub async fn adb_get_devices(app_handle: tauri::AppHandle) -> Result<DeviceResponse<Vec<Device>>, String> {
    info!("🤖 Getting Android devices using DeviceScanner");
    let scanner = DeviceScanner::new(app_handle);
    Ok(scanner.scan_android_devices().await)
}

/// Check if a specific Android device is connected
pub async fn is_android_device_connected(app_handle: tauri::AppHandle, device_id: &str) -> Result<bool, String> {
    let devices_response = adb_get_devices(app_handle).await?;
    
    if let Some(devices) = devices_response.data {
        Ok(devices.iter().any(|device| device.id == device_id))
    } else {
        Ok(false)
    }
}

/// Get Android device information
pub async fn get_android_device_info(app_handle: tauri::AppHandle, device_id: &str) -> Result<Option<Device>, String> {
    let devices_response = adb_get_devices(app_handle).await?;
    
    if let Some(devices) = devices_response.data {
        Ok(devices.into_iter().find(|device| device.id == device_id))
    } else {
        Ok(None)
    }
} 