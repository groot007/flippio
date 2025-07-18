use std::fs;
use std::path::{Path, PathBuf};
use log::{info, error};

// Temp directory utilities
pub fn get_temp_dir_path() -> PathBuf {
    std::env::temp_dir().join("flippio-db-temp")
}

pub fn ensure_temp_dir() -> Result<PathBuf, Box<dyn std::error::Error + Send + Sync>> {
    let temp_dir = get_temp_dir_path();
    
    // Only create temp directory if it doesn't exist
    if !temp_dir.exists() {
        fs::create_dir_all(&temp_dir)?;
    }
    
    Ok(temp_dir)
}

pub fn clean_temp_dir() -> Result<PathBuf, Box<dyn std::error::Error + Send + Sync>> {
    let temp_dir = get_temp_dir_path();
    
    // Remove existing temp directory if it exists
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir)?;
    }
    
    // Create fresh temp directory
    fs::create_dir_all(&temp_dir)?;
    
    Ok(temp_dir)
}

// Helper function to get ADB executable path
pub fn get_adb_path() -> String {
    // Try to find ADB in common locations
    let possible_paths = vec![
        "adb",  // System PATH
        "/usr/local/bin/adb",  // Homebrew on macOS
        "/opt/homebrew/bin/adb",  // Homebrew on Apple Silicon
        "/usr/bin/adb",  // Linux
        "/Android/Sdk/platform-tools/adb",  // Android SDK
        "~/Library/Android/sdk/platform-tools/adb",  // macOS Android SDK
        "~/Android/Sdk/platform-tools/adb",  // User Android SDK
    ];
    
    for path in possible_paths {
        let expanded_path = if path.starts_with("~") {
            // Expand ~ to home directory
            if let Some(home) = std::env::var("HOME").ok() {
                path.replace("~", &home)
            } else {
                continue;
            }
        } else {
            path.to_string()
        };
        
        if Path::new(&expanded_path).exists() {
            return expanded_path;
        }
    }
    
    // Fallback to just "adb" and hope it's in PATH
    "adb".to_string()
}

// Execute ADB command with proper error handling
pub async fn execute_adb_command(args: &[&str]) -> Result<std::process::Output, Box<dyn std::error::Error + Send + Sync>> {
    let adb_path = get_adb_path();
    
    info!("Executing ADB command: {} {}", adb_path, args.join(" "));
    
    let output = tokio::process::Command::new(adb_path)
        .args(args)
        .output()
        .await?;
    
    info!("ADB command completed with exit code: {:?}", output.status);
    
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        if !error_msg.is_empty() {
            error!("ADB command failed: {}", error_msg);
        }
    }
    
    Ok(output)
}

pub fn find_android_emulator_path() -> String {
    let possible_paths = vec![
        "emulator",  // System PATH
        "/usr/local/bin/emulator",  // Homebrew on macOS
        "/opt/homebrew/bin/emulator",  // Homebrew on Apple Silicon
        "/usr/bin/emulator",  // Linux
        "/Android/Sdk/emulator/emulator",  // Android SDK
        "~/Library/Android/sdk/emulator/emulator",  // macOS Android SDK
        "~/Android/Sdk/emulator/emulator",  // User Android SDK
    ];
    
    for path in possible_paths {
        let expanded_path = if path.starts_with("~") {
            // Expand ~ to home directory
            if let Some(home) = std::env::var("HOME").ok() {
                path.replace("~", &home)
            } else {
                continue;
            }
        } else {
            path.to_string()
        };
        
        if Path::new(&expanded_path).exists() {
            return expanded_path;
        }
    }
    
    // Fallback to just "emulator" and hope it's in PATH
    "emulator".to_string()
}

// Helper function to get libimobiledevice tool path
pub fn get_libimobiledevice_tool_path(tool_name: &str) -> Option<std::path::PathBuf> {
    if let Ok(exe_path) = std::env::current_exe() {
        log::info!("[libimobiledevice] current_exe: {:?}", exe_path);

        if let Some(exe_dir) = exe_path.parent() {
            // ✅ 1. Production: Contents/MacOs/<tool>
            if let Some(resources_path) = exe_dir
                .parent() // Contents/
                .map(|p| p.join("MacOs").join(tool_name))
            {
                if resources_path.exists() {
                    log::info!(
                        "[libimobiledevice] Using bundled '{}' from Contents/MacOs/: {:?}",
                        tool_name,
                        resources_path
                    );
                    return Some(resources_path);
                }
            }

            let dev_path = exe_dir
                .parent()
                .and_then(|p| p.parent())  // target/debug/
                .and_then(|p| p.parent())  // target/
                .map(|p| p.join("resources/libimobiledevice/tools").join(tool_name));

            if let Some(ref dev_path) = dev_path {
                if dev_path.exists() {
                    log::info!(
                        "[libimobiledevice] Using dev '{}' from: {:?}",
                        tool_name,
                        dev_path
                    );
                    return Some(dev_path.clone());
                }
            }
        }
    }

    // ❗ Fallback: system PATH
    log::warn!(
        "[libimobiledevice] Falling back to system '{}' from PATH",
        tool_name
    );
    None
}
