//! Android Package Management
//! 
//! This module handles Android app package operations including
//! listing installed packages, getting package information, and package validation.

use crate::commands::device::execution::DeviceToolExecutor;
use crate::commands::device::types::{DeviceResponse, Package};
use log::info;

/// Additional response helpers for Android operations
trait DeviceResponseExt<T> {
    fn success(data: T) -> DeviceResponse<T>;
    fn error(message: &str) -> DeviceResponse<T>;
    fn map_data<U, F>(self, f: F) -> DeviceResponse<U>
    where
        F: FnOnce(T) -> U;
}

impl<T> DeviceResponseExt<T> for DeviceResponse<T> {
    fn success(data: T) -> DeviceResponse<T> {
        DeviceResponse {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    fn error(message: &str) -> DeviceResponse<T> {
        DeviceResponse {
            success: false,
            data: None,
            error: Some(message.to_string()),
        }
    }

    fn map_data<U, F>(self, f: F) -> DeviceResponse<U>
    where
        F: FnOnce(T) -> U,
    {
        DeviceResponse {
            success: self.success,
            data: self.data.map(f),
            error: self.error,
        }
    }
}

/// Get list of Android packages (apps) on a device
#[tauri::command]
pub async fn adb_get_packages(app_handle: tauri::AppHandle, device_id: String) -> Result<DeviceResponse<Vec<Package>>, String> {
    info!("📦 Getting packages for Android device: {}", device_id);
    
    let executor = DeviceToolExecutor::new(app_handle);
    let result = executor.execute_adb(&["-s", &device_id, "shell", "pm", "list", "packages", "-3"], 
                                    &format!("list packages for {}", device_id)).await;
    
    match result {
        DeviceResponse { success: true, data: Some(command_result), .. } => {
            let packages = parse_android_packages(&command_result.stdout);
            info!("✅ Found {} packages on Android device {}", packages.len(), device_id);
            Ok(<DeviceResponse<Vec<Package>> as DeviceResponseExt<Vec<Package>>>::success(packages))
        }
        error_response => {
            info!("❌ Failed to get packages for Android device {}: {:?}", device_id, error_response.error);
            Ok(error_response.map_data(|_| Vec::new()))
        }
    }
}

/// Parse Android package list output into Package structs
fn parse_android_packages(output: &str) -> Vec<Package> {
    output.lines()
        .filter_map(|line| {
            if line.starts_with("package:") {
                let package_name = line.replace("package:", "").trim().to_string();
                Some(Package {
                    name: package_name.clone(), // Use package name as display name for now
                    bundle_id: package_name,
                })
            } else {
                None
            }
        })
        .collect()
}

/// Get detailed information about a specific Android package
pub async fn get_android_package_info(app_handle: tauri::AppHandle, device_id: &str, package_name: &str) -> Result<Option<Package>, String> {
    let packages_response = adb_get_packages(app_handle, device_id.to_string()).await?;
    
    if let Some(packages) = packages_response.data {
        Ok(packages.into_iter().find(|package| package.bundle_id == package_name))
    } else {
        Ok(None)
    }
}

/// Check if a specific package is installed on the Android device
pub async fn is_android_package_installed(app_handle: tauri::AppHandle, device_id: &str, package_name: &str) -> Result<bool, String> {
    let package_info = get_android_package_info(app_handle, device_id, package_name).await?;
    Ok(package_info.is_some())
} 