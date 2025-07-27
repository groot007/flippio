//! Device Discovery and Detection
//! 
//! This module provides unified device detection for both Android and iOS devices,
//! abstracting the complexity of different tool implementations.

use crate::commands::device::types::{DeviceResponse, Device};
use crate::commands::common::shell_executor::{ShellExecutor, CommandResult};
use tauri::{AppHandle, Manager};
use log::{info, warn, error, debug};
use serde::{Serialize, Deserialize};
use regex::Regex;

/// Unified device scanner for all platforms
pub struct DeviceScanner {
    tool_executor: ShellExecutor,
}

/// Device detection configuration
#[derive(Debug, Clone)]
pub struct ScanConfig {
    pub include_android: bool,
    pub include_ios_devices: bool,
    pub include_ios_simulators: bool,
    pub include_offline: bool,
}

impl Default for ScanConfig {
    fn default() -> Self {
        Self {
            include_android: true,
            include_ios_devices: true,
            include_ios_simulators: true,
            include_offline: false,
        }
    }
}

impl DeviceScanner {
    /// Create a new device scanner
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        Self {
            tool_executor: ShellExecutor::new(app_handle),
        }
    }
    
    /// Scan for all available devices
    pub async fn scan_all_devices(&self, config: &ScanConfig) -> DeviceResponse<Vec<Device>> {
        info!("🔍 Starting comprehensive device scan");
        let mut all_devices = Vec::new();
        let mut errors = Vec::new();
        
        // Scan Android devices
        if config.include_android {
            debug!("📱 Scanning Android devices");
            match self.scan_android_devices().await {
                DeviceResponse { success: true, data: Some(devices), .. } => {
                    let count = devices.len();
                    all_devices.extend(devices);
                    info!("✅ Found {} Android devices", count);
                }
                DeviceResponse { success: false, error: Some(error), .. } => {
                    error!("❌ Android device scan failed: {}", error);
                    errors.push(format!("Android: {}", error));
                }
                _ => {}
            }
        }
        
        // Scan iOS physical devices
        if config.include_ios_devices {
            debug!("🍎 Scanning iOS devices");
            match self.scan_ios_devices().await {
                DeviceResponse { success: true, data: Some(devices), .. } => {
                    let count = devices.len();
                    all_devices.extend(devices);
                    info!("✅ Found {} iOS devices", count);
                }
                DeviceResponse { success: false, error: Some(error), .. } => {
                    error!("❌ iOS device scan failed: {}", error);
                    errors.push(format!("iOS: {}", error));
                }
                _ => {}
            }
        }
        
        // Scan iOS simulators
        if config.include_ios_simulators {
            debug!("📱 Scanning iOS simulators");
            match self.scan_ios_simulators().await {
                DeviceResponse { success: true, data: Some(devices), .. } => {
                    let count = devices.len();
                    all_devices.extend(devices);
                    info!("✅ Found {} iOS simulators", count);
                }
                DeviceResponse { success: false, error: Some(error), .. } => {
                    error!("❌ iOS simulator scan failed: {}", error);
                    errors.push(format!("iOS Simulator: {}", error));
                }
                _ => {}
            }
        }
        
        // Evaluate results
        if all_devices.is_empty() && !errors.is_empty() {
            let combined_error = format!("No devices found. Errors: {}", errors.join("; "));
            DeviceResponse::error(&combined_error)
        } else {
            info!("🎉 Device scan completed: {} devices found", all_devices.len());
            if !errors.is_empty() {
                info!("⚠️ Some scan operations failed: {}", errors.join("; "));
            }
            DeviceResponse::success(all_devices)
        }
    }
    
    /// Scan for Android devices using ADB
    pub async fn scan_android_devices(&self) -> DeviceResponse<Vec<Device>> {
        info!("🤖 Scanning Android devices with ADB");
        
        let result = self.tool_executor.execute_command("adb", &["devices", "-l"], "list devices").await;
        
        match result {
            Ok(command_result) => {
                let devices = self.parse_android_devices(&command_result.stdout);
                DeviceResponse::success(devices)
            }
            Err(error) => {
                DeviceResponse {
                    success: false,
                    data: None,
                    error: Some(error),
                }
            }
        }
    }
    
    /// Scan for iOS physical devices
    pub async fn scan_ios_devices(&self) -> DeviceResponse<Vec<Device>> {
        info!("🍎 Scanning iOS devices with idevice_id");
        
        let result = self.tool_executor.execute_command("idevice_id", &["-l"], "list devices").await;
        
        match result {
            Ok(command_result) if command_result.success => {
                info!("✅ iOS device scan successful");
                let devices = self.parse_android_devices(&command_result.stdout);
                DeviceResponse::success(devices)
            }
            Ok(command_result) => {
                warn!("⚠️ iOS device scan completed with warnings: {}", command_result.stderr);
                DeviceResponse::success(Vec::new())
            }
            Err(e) => {
                error!("❌ iOS device scan failed: {}", e);
                DeviceResponse::error(&format!("Failed to scan iOS devices: {}", e))
            }
        }
    }

    /// Scan iOS simulators using xcrun simctl
    pub async fn scan_ios_simulators(&self) -> DeviceResponse<Vec<Device>> {
        info!("📱 Scanning iOS simulators with simctl");
        
        let result = self.tool_executor.execute_command("xcrun", &["simctl", "list", "devices", "available"], "list simulators").await;
        
        match result {
            Ok(command_result) => {
                let devices = self.parse_ios_simulators(&command_result.stdout);
                DeviceResponse::success(devices)
            }
            Err(error) => {
                DeviceResponse {
                    success: false,
                    data: None,
                    error: Some(error),
                }
            }
        }
    }
    
    /// Parse Android device list output
    fn parse_android_devices(&self, output: &str) -> Vec<Device> {
        parse_android_devices_impl(output)
    }
    
    /// Parse iOS simulator output
    fn parse_ios_simulators(&self, output: &str) -> Vec<Device> {
        let mut devices = Vec::new();
        let mut current_runtime = String::new();
        
        for line in output.lines() {
            let line = line.trim();
            
            if line.starts_with("--") && line.contains("iOS") {
                current_runtime = line.replace("--", "").trim().to_string();
            } else if line.contains("(") && line.contains(")") && !current_runtime.is_empty() {
                if let Some(device) = parse_simulator_line_impl(line, &current_runtime) {
                    devices.push(device);
                }
            }
        }
        
        devices
    }
    
    /// Parse a single simulator line
    fn parse_simulator_line(&self, line: &str, runtime: &str) -> Option<Device> {
        parse_simulator_line_impl(line, runtime)
    }
}

/// Standalone parsing functions for testability
fn parse_android_devices_impl(output: &str) -> Vec<Device> {
    let mut devices = Vec::new();
    
    for line in output.lines().skip(1) { // Skip header line
        let line = line.trim();
        if line.is_empty() || !line.contains("device") {
            continue;
        }
        
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            let device_id = parts[0].to_string();
            let mut model = "Unknown".to_string();
            let mut device_name = device_id.clone();
            
            // Determine device type
            let is_physical_device = line.contains("usb:");
            let description = if is_physical_device {
                "Android device".to_string()
            } else {
                "Android emulator".to_string()
            };
            
            // Parse device properties
            for part in &parts[2..] {
                if part.starts_with("model:") {
                    model = part.replace("model:", "");
                } else if part.starts_with("device:") {
                    device_name = part.replace("device:", "");
                }
            }
            
            devices.push(Device {
                id: device_id,
                name: device_name,
                model,
                device_type: "android".to_string(),
                description,
            });
        }
    }
    
    devices
}

fn parse_simulator_line_impl(line: &str, runtime: &str) -> Option<Device> {
    let re = regex::Regex::new(r"(.+) \(([A-F0-9-]+)\) \((.+)\)").ok()?;
    
    if let Some(captures) = re.captures(line) {
        let name = captures.get(1)?.as_str().trim().to_string();
        let uuid = captures.get(2)?.as_str().to_string();
        let state = captures.get(3)?.as_str().to_string();
        
        Some(Device {
            id: uuid,
            name,
            model: runtime.to_string(),
            device_type: "ios_simulator".to_string(),
            description: format!("iOS Simulator ({})", state),
        })
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_scan_config_default() {
        let config = ScanConfig::default();
        assert!(config.include_android);
        assert!(config.include_ios_devices);
        assert!(config.include_ios_simulators);
        assert!(!config.include_offline);
    }
    
    #[test]
    fn test_parse_android_devices() {
        let output = "List of devices attached\n\
                      emulator-5554\tdevice\n\
                      1234567890ABCDEF\tdevice usb:1-1 product:device model:TestDevice\n";
        
        let devices = parse_android_devices_impl(output);
        assert_eq!(devices.len(), 2);
        assert_eq!(devices[0].id, "emulator-5554");
        assert_eq!(devices[1].model, "TestDevice");
    }
    
    #[test]
    fn test_parse_simulator_line() {
        let line = "iPhone 12 (12345678-1234-1234-1234-123456789ABC) (Booted)";
        let runtime = "iOS 15.0";
        
        let device = parse_simulator_line_impl(line, runtime).unwrap();
        assert_eq!(device.name, "iPhone 12");
        assert_eq!(device.id, "12345678-1234-1234-1234-123456789ABC");
        assert_eq!(device.device_type, "ios_simulator");
    }
} 