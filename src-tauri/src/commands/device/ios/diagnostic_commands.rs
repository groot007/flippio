//! Windows dependency diagnostic commands
//! 
//! This module provides Tauri commands for diagnosing Windows dependency issues

use crate::commands::device::ios::tool_validation::find_ios_tool;
use crate::commands::device::ios::windows_dependencies::check_windows_dependencies;
use log::{info, warn, error};
use serde_json::Value;

/// Diagnostic command to check Windows dependencies for iOS tools
#[tauri::command]
pub async fn diagnostic_check_windows_dependencies() -> Result<Value, String> {
    info!("🔍 Running Windows dependency diagnostic...");
    
    // Find the ideviceinstaller tool
    let tool_path = find_ios_tool("ideviceinstaller")
        .map_err(|e| format!("Failed to find ideviceinstaller: {}", e))?;
    
    info!("📱 Found ideviceinstaller at: {}", tool_path.display());
    
    // Run dependency check
    let result = check_windows_dependencies(&tool_path);
    
    // Log the results
    if result.has_issues() {
        error!("❌ Dependencies have issues:");
        error!("   Tool exists: {}", result.tool_exists);
        error!("   VC++ Redistributable: {}", result.vcredist_installed);
        error!("   Missing DLLs: {:?}", result.missing_dlls);
        error!("   Exit code: {:?}", result.exit_code);
    } else {
        info!("✅ All dependencies appear to be satisfied");
    }
    
    // Convert to JSON for frontend
    Ok(serde_json::json!({
        "tool_exists": result.tool_exists,
        "tool_path": result.tool_path.as_ref().map(|p| p.to_string_lossy().to_string()),
        "missing_dlls": result.missing_dlls,
        "vcredist_installed": result.vcredist_installed,
        "recommendations": result.recommendations,
        "exit_code": result.exit_code,
        "has_issues": result.has_issues(),
        "user_message": result.get_user_friendly_message(),
        "summary": if result.has_issues() {
            "Issues detected with Windows dependencies"
        } else {
            "All dependencies appear to be satisfied"
        }
    }))
}

/// Get a simple diagnostic message for ideviceinstaller issues
#[tauri::command]
pub async fn diagnostic_get_ideviceinstaller_help() -> Result<String, String> {
    info!("🔍 Getting ideviceinstaller diagnostic help...");
    
    match find_ios_tool("ideviceinstaller") {
        Ok(tool_path) => {
            let result = check_windows_dependencies(&tool_path);
            Ok(result.get_user_friendly_message())
        },
        Err(e) => {
            error!("❌ Failed to find ideviceinstaller: {}", e);
            Ok(format!("Failed to find ideviceinstaller tool: {}\n\nThis usually means Flippio was not installed correctly or the bundled iOS tools are missing.", e))
        }
    }
}

/// Test execution of ideviceinstaller to check for dependency issues
#[tauri::command]
pub async fn diagnostic_test_ideviceinstaller_execution() -> Result<Value, String> {
    info!("🧪 Testing ideviceinstaller execution...");
    
    let tool_path = find_ios_tool("ideviceinstaller")
        .map_err(|e| format!("Failed to find ideviceinstaller: {}", e))?;
    
    // Try to execute the tool with --help flag
    let output = std::process::Command::new(&tool_path)
        .arg("--help")
        .output();
    
    match output {
        Ok(result) => {
            let exit_code = result.status.code();
            let stdout = String::from_utf8_lossy(&result.stdout);
            let stderr = String::from_utf8_lossy(&result.stderr);
            
            info!("📋 Test execution results:");
            info!("   Exit code: {:?}", exit_code);
            info!("   stdout length: {} chars", stdout.len());
            info!("   stderr length: {} chars", stderr.len());
            
            let has_dll_issue = exit_code == Some(-1073741701);
            
            if has_dll_issue {
                error!("❌ Detected DLL dependency issue (exit code -1073741701)");
            } else if exit_code == Some(0) {
                info!("✅ Tool executed successfully");
            } else {
                warn!("⚠️ Tool executed with non-zero exit code: {:?}", exit_code);
            }
            
            Ok(serde_json::json!({
                "success": !has_dll_issue,
                "exit_code": exit_code,
                "stdout": stdout.chars().take(1000).collect::<String>(), // Limit output size
                "stderr": stderr.chars().take(1000).collect::<String>(),
                "has_dll_issue": has_dll_issue,
                "tool_path": tool_path.to_string_lossy(),
                "message": if has_dll_issue {
                    "Tool execution failed due to DLL dependency issues"
                } else if exit_code == Some(0) {
                    "Tool executed successfully"
                } else {
                    "Tool executed with warnings or errors"
                }
            }))
        },
        Err(e) => {
            error!("❌ Failed to execute tool: {}", e);
            
            // Check if this is a Windows DLL error
            let is_dll_error = e.raw_os_error() == Some(-1073741701);
            
            Ok(serde_json::json!({
                "success": false,
                "error": e.to_string(),
                "has_dll_issue": is_dll_error,
                "tool_path": tool_path.to_string_lossy(),
                "message": if is_dll_error {
                    "Tool execution failed due to DLL dependency issues".to_string()
                } else {
                    format!("Tool execution failed: {}", e)
                }
            }))
        }
    }
}
