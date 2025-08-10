//! Windows dependency checker for iOS tools
//! 
//! This module provides functionality to diagnose why ideviceinstaller.exe
//! fails with exit code -1073741701 (STATUS_INVALID_IMAGE_FORMAT)

use std::path::{Path, PathBuf};

#[derive(Debug)]
pub struct DependencyCheckResult {
    pub tool_exists: bool,
    pub tool_path: Option<PathBuf>,
    pub missing_dlls: Vec<String>,
    pub vcredist_installed: bool,
    pub recommendations: Vec<String>,
    pub exit_code: Option<i32>,
}

impl DependencyCheckResult {
    pub fn has_issues(&self) -> bool {
        !self.missing_dlls.is_empty() || !self.vcredist_installed || self.exit_code == Some(-1073741701)
    }
    
    pub fn get_user_friendly_message(&self) -> String {
        if !self.has_issues() {
            return "All dependencies appear to be available.".to_string();
        }
        
        let mut message = String::new();
        message.push_str("iOS app listing failed due to missing Windows dependencies.\n\n");
        
        if !self.vcredist_installed {
            message.push_str("❌ Microsoft Visual C++ Redistributable is not installed.\n");
            message.push_str("   This is required for iOS tools to work on Windows.\n\n");
        }
        
        if !self.missing_dlls.is_empty() {
            message.push_str("❌ Missing DLL files:\n");
            for dll in &self.missing_dlls {
                message.push_str(&format!("   • {}\n", dll));
            }
            message.push_str("\n");
        }
        
        message.push_str("To fix this issue:\n");
        for recommendation in &self.recommendations {
            message.push_str(&format!("• {}\n", recommendation));
        }
        
        message.push_str("\nNote: You can still access iOS device databases without app listing functionality.");
        message
    }
}

/// Check Windows dependencies for iOS tools
#[cfg(target_os = "windows")]
pub fn check_windows_dependencies(tool_path: &Path) -> DependencyCheckResult {
    info!("🔍 Checking Windows dependencies for: {}", tool_path.display());
    
    let mut result = DependencyCheckResult {
        tool_exists: tool_path.exists(),
        tool_path: if tool_path.exists() { Some(tool_path.to_path_buf()) } else { None },
        missing_dlls: Vec::new(),
        vcredist_installed: false,
        recommendations: Vec::new(),
        exit_code: None,
    };
    
    if !result.tool_exists {
        error!("❌ Tool not found: {}", tool_path.display());
        result.recommendations.push("Ensure Flippio is properly installed with all bundled files".to_string());
        return result;
    }
    
    // Test tool execution to get exit code
    info!("🧪 Testing tool execution...");
    match Command::new(tool_path).arg("--help").output() {
        Ok(output) => {
            result.exit_code = output.status.code();
            info!("Tool exit code: {:?}", result.exit_code);
            
            if result.exit_code == Some(-1073741701) {
                warn!("⚠️ Detected STATUS_INVALID_IMAGE_FORMAT error (-1073741701)");
            }
        }
        Err(e) => {
            error!("❌ Failed to execute tool: {}", e);
        }
    }
    
    // Check for Visual C++ Redistributable
    info!("🔍 Checking for Visual C++ Redistributable...");
    result.vcredist_installed = check_vcredist_installed();
    
    if !result.vcredist_installed {
        warn!("❌ Visual C++ Redistributable not detected");
        result.recommendations.push("Install Microsoft Visual C++ Redistributable (latest version)".to_string());
        result.recommendations.push("Download from: https://docs.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist".to_string());
    } else {
        info!("✅ Visual C++ Redistributable appears to be installed");
    }
    
    // Check for required DLLs in the same directory
    info!("🔍 Checking for required DLL files...");
    result.missing_dlls = check_required_dlls(tool_path);
    
    if !result.missing_dlls.is_empty() {
        warn!("❌ Missing {} DLL files", result.missing_dlls.len());
        result.recommendations.push("Ensure all libimobiledevice DLL files are in the same directory as the executable".to_string());
    } else {
        info!("✅ All required DLL files appear to be present");
    }
    
    // Additional recommendations based on the issues found
    if result.exit_code == Some(-1073741701) {
        result.recommendations.push("Try running Flippio as Administrator".to_string());
        result.recommendations.push("Check Windows Event Viewer for more detailed error information".to_string());
        result.recommendations.push("Temporarily disable antivirus software to test if it's blocking DLL loading".to_string());
    }
    
    if result.recommendations.is_empty() {
        result.recommendations.push("All dependencies appear to be satisfied. The issue may be elsewhere.".to_string());
    }
    
    info!("🔍 Dependency check completed. Issues found: {}", result.has_issues());
    result
}

/// Check if Visual C++ Redistributable is installed
#[cfg(target_os = "windows")]
fn check_vcredist_installed() -> bool {
    use winreg::enums::*;
    use winreg::RegKey;
    
    // Check multiple possible registry locations for VC++ Redistributable
    let registry_paths = [
        r"SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64",
        r"SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x86",
        r"SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64",
        r"SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x86",
    ];
    
    for registry_path in &registry_paths {
        match RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(registry_path) {
            Ok(key) => {
                if let Ok(version) = key.get_value::<String, _>("Version") {
                    info!("Found VC++ Redistributable at {}: version {}", registry_path, version);
                    return true;
                }
            }
            Err(_) => {
                // This registry key doesn't exist, try the next one
            }
        }
    }
    
    // Also check for the presence of common VC++ runtime DLLs in system directories
    let system_dirs = [
        std::env::var("SYSTEMROOT").unwrap_or_default() + r"\System32",
        std::env::var("SYSTEMROOT").unwrap_or_default() + r"\SysWOW64",
    ];
    
    let runtime_dlls = [
        "msvcp140.dll",
        "vcruntime140.dll",
        "vcruntime140_1.dll",
    ];
    
    for system_dir in &system_dirs {
        for dll in &runtime_dlls {
            let dll_path = Path::new(system_dir).join(dll);
            if dll_path.exists() {
                info!("Found VC++ runtime DLL: {}", dll_path.display());
                return true;
            }
        }
    }
    
    false
}

/// Check for required DLL files in the tool directory
#[cfg(target_os = "windows")]
fn check_required_dlls(tool_path: &Path) -> Vec<String> {
    let tool_dir = tool_path.parent().unwrap_or(tool_path);
    
    // List of DLLs that ideviceinstaller.exe typically requires
    let required_dlls = [
        "libimobiledevice-1.0.dll",
        "libplist-2.0.dll",
        "libusbmuxd-2.0.dll",
        "libzip.dll",
        "libxml2-2.dll",
        "libcrypto-3-x64.dll",
        "libssl-3-x64.dll",
        "zlib1.dll",
        "libintl-8.dll",
        "libiconv-2.dll",
        "libwinpthread-1.dll",
    ];
    
    let mut missing = Vec::new();
    
    for dll in &required_dlls {
        let dll_path = tool_dir.join(dll);
        if !dll_path.exists() {
            missing.push(dll.to_string());
            warn!("❌ Missing DLL: {}", dll);
        } else {
            info!("✅ Found DLL: {}", dll);
        }
    }
    
    missing
}

/// Non-Windows stub implementation
#[cfg(not(target_os = "windows"))]
pub fn check_windows_dependencies(_tool_path: &Path) -> DependencyCheckResult {
    DependencyCheckResult {
        tool_exists: true,
        tool_path: None,
        missing_dlls: Vec::new(),
        vcredist_installed: true,
        recommendations: vec!["Dependency checking is only available on Windows".to_string()],
        exit_code: None,
    }
}

/// Run a comprehensive dependency check and return user-friendly results
pub fn diagnose_ideviceinstaller_issue(tool_path: &Path) -> String {
    let result = check_windows_dependencies(tool_path);
    result.get_user_friendly_message()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    
    #[test]
    fn test_dependency_check_result() {
        let result = DependencyCheckResult {
            tool_exists: true,
            tool_path: Some(PathBuf::from("test.exe")),
            missing_dlls: vec!["test.dll".to_string()],
            vcredist_installed: false,
            recommendations: vec!["Install VC++ Redist".to_string()],
            exit_code: Some(-1073741701),
        };
        
        assert!(result.has_issues());
        assert!(result.get_user_friendly_message().contains("missing Windows dependencies"));
    }
}
