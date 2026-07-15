// iOS Device Diagnostic Tools
// Helps diagnose common iOS device connection issues

use super::tools::get_tool_command_legacy;
use serde::{Deserialize, Serialize};
use tauri_plugin_shell::ShellExt;
use log::{info, warn, error};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IOSDiagnosticResult {
    pub device_connected: bool,
    pub device_name: Option<String>,
    pub installation_proxy_working: bool,
    pub issues: Vec<String>,
    pub recommendations: Vec<String>,
}

/// Comprehensive iOS device diagnostic
#[tauri::command]
pub async fn diagnose_ios_device(
    app_handle: tauri::AppHandle,
    device_id: String,
) -> Result<IOSDiagnosticResult, String> {
    info!("🔍 Starting iOS device diagnostic for: {}", device_id);
    
    let shell = app_handle.shell();
    let mut result = IOSDiagnosticResult {
        device_connected: false,
        device_name: None,
        installation_proxy_working: false,
        issues: Vec::new(),
        recommendations: Vec::new(),
    };
    
    // Test 1: Basic device connectivity
    info!("📱 Testing basic device connectivity...");
    let ideviceinfo_cmd = get_tool_command_legacy("ideviceinfo");
    
    match shell.command(&ideviceinfo_cmd)
        .args(["-u", &device_id, "-k", "DeviceName"])
        .output()
        .await
    {
        Ok(output) if output.status.success() => {
            let device_name = String::from_utf8_lossy(&output.stdout).trim().to_string();
            result.device_connected = true;
            result.device_name = Some(device_name.clone());
            info!("✅ Device connected: {}", device_name);
        }
        Ok(output) => {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            result.issues.push(format!("Device not responding: {}", error_msg));
            result.recommendations.push("Ensure device is unlocked and trusted".to_string());
            error!("❌ Device connectivity failed: {}", error_msg);
        }
        Err(e) => {
            result.issues.push(format!("ideviceinfo tool error: {}", e));
            result.recommendations.push("Check libimobiledevice installation".to_string());
            error!("❌ Tool execution failed: {}", e);
        }
    }
    
    // Test 2: Installation proxy service
    if result.device_connected {
        info!("🔧 Testing installation proxy service...");
        let ideviceinstaller_cmd = get_tool_command_legacy("ideviceinstaller");
        
        match shell.command(&ideviceinstaller_cmd)
            .args(["-u", &device_id, "-l"])
            .output()
            .await
        {
            Ok(output) if output.status.success() => {
                result.installation_proxy_working = true;
                info!("✅ Installation proxy working");
            }
            Ok(output) => {
                let error_msg = String::from_utf8_lossy(&output.stderr);
                result.installation_proxy_working = false;
                
                if error_msg.contains("Could not start com.apple.mobile.installation_proxy") {
                    result.issues.push("Installation proxy service not available".to_string());
                    result.recommendations.extend(vec![
                        "Ensure device is unlocked".to_string(),
                        "Trust this computer on the device".to_string(),
                        "Enable Developer Mode if using iOS 16+".to_string(),
                        "Try disconnecting and reconnecting the device".to_string(),
                    ]);
                } else if error_msg.contains("No device found") {
                    result.issues.push("Device not properly paired".to_string());
                    result.recommendations.push("Re-pair the device with this computer".to_string());
                } else {
                    result.issues.push(format!("Installation proxy error: {}", error_msg));
                }
                
                error!("❌ Installation proxy failed: {}", error_msg);
            }
            Err(e) => {
                result.issues.push(format!("ideviceinstaller tool error: {}", e));
                error!("❌ ideviceinstaller execution failed: {}", e);
            }
        }
    }
    
    // Test 3: Additional connectivity checks
    if result.device_connected {
        info!("🔍 Running additional diagnostics...");
        
        // Check device lock status
        match shell.command(&ideviceinfo_cmd)
            .args(["-u", &device_id, "-k", "PasswordProtected"])
            .output()
            .await
        {
            Ok(output) if output.status.success() => {
                let protected = String::from_utf8_lossy(&output.stdout).trim().to_lowercase();
                if protected == "true" {
                    result.recommendations.push("Device may be locked - unlock and try again".to_string());
                }
            }
            _ => {}
        }
        
        // Check iOS version for Developer Mode requirement
        match shell.command(&ideviceinfo_cmd)
            .args(["-u", &device_id, "-k", "ProductVersion"])
            .output()
            .await
        {
            Ok(output) if output.status.success() => {
                let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if let Ok(major_version) = version.split('.').next().unwrap_or("0").parse::<i32>() {
                    if major_version >= 16 {
                        result.recommendations.push(
                            "iOS 16+ detected: Enable Developer Mode in Settings > Privacy & Security".to_string()
                        );
                    }
                }
                info!("📋 iOS Version: {}", version);
            }
            _ => {}
        }
    }
    
    // Generate summary
    if result.device_connected && result.installation_proxy_working {
        info!("🎉 All iOS diagnostics passed!");
    } else {
        warn!("⚠️ iOS diagnostic issues found: {} issues, {} recommendations", 
              result.issues.len(), result.recommendations.len());
    }
    
    Ok(result)
}

/// Quick iOS device status check
#[tauri::command]
pub async fn check_ios_device_status(
    app_handle: tauri::AppHandle,
    device_id: String,
) -> Result<serde_json::Value, String> {
    let diagnostic = diagnose_ios_device(app_handle, device_id).await?;
    
    Ok(serde_json::json!({
        "connected": diagnostic.device_connected,
        "name": diagnostic.device_name,
        "installation_proxy_ok": diagnostic.installation_proxy_working,
        "ready_for_apps": diagnostic.device_connected && diagnostic.installation_proxy_working,
        "issue_count": diagnostic.issues.len(),
        "recommendation_count": diagnostic.recommendations.len()
    }))
}

/// Get user-friendly error message for common iOS issues
pub fn get_ios_error_help(error_message: &str) -> String {
    if error_message.contains("Could not start com.apple.mobile.installation_proxy") {
        "iOS Installation Proxy Error:\n\
        \n\
        This usually happens when:\n\
        • Device is locked - unlock your iPhone/iPad\n\
        • Computer not trusted - tap 'Trust' on your device\n\
        • Developer Mode disabled (iOS 16+) - enable in Settings > Privacy & Security\n\
        • Device needs reconnection - try unplugging and reconnecting".to_string()
    } else if error_message.contains("No device found") {
        "Device Not Found:\n\
        \n\
        • Check USB cable connection\n\
        • Try a different USB cable\n\
        • Restart both device and computer\n\
        • Re-pair the device".to_string()
    } else if error_message.contains("usbmuxd") {
        "USB Communication Error:\n\
        \n\
        • Restart the device\n\
        • Try a different USB port\n\
        • On macOS, try: sudo pkill usbmuxd".to_string()
    } else {
        format!("iOS Error: {}\n\nTry basic troubleshooting:\n• Unlock device\n• Trust computer\n• Reconnect cable", error_message)
    }
} 