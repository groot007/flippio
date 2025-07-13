//! libimobiledevice Tools Management
//! 
//! This module handles the detection and management of libimobiledevice tools
//! used for iOS device communication.

use super::super::helpers::get_libimobiledevice_tool_path;
use log::info;

/// Get the path to a specific libimobiledevice tool
#[tauri::command]
pub async fn get_libimobiledevice_tool_path_cmd(tool_name: String) -> Option<String> {
    get_libimobiledevice_tool_path(&tool_name).map(|p| p.to_string_lossy().to_string())
}

/// Get the path to a libimobiledevice tool with logging
pub fn get_tool_path_with_logging(tool_name: &str) -> Option<std::path::PathBuf> {
    let path = get_libimobiledevice_tool_path(tool_name);
    info!("🔧 {} tool detection:", tool_name);
    info!("  Tool path result: {:?}", path);
    
    if let Some(ref tool_path) = path {
        // Check if the tool is executable
        match std::fs::metadata(tool_path) {
            Ok(metadata) => {
                info!("  Tool file exists: {} bytes", metadata.len());
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let mode = metadata.permissions().mode();
                    info!("  Tool permissions: {:o}", mode);
                    if mode & 0o111 != 0 {
                        info!("  ✅ Tool is executable");
                    } else {
                        log::error!("  ❌ Tool is not executable!");
                    }
                }
            }
            Err(e) => {
                log::error!("  ❌ Cannot access tool file: {}", e);
            }
        }
    }
    
    path
}

/// Get command string for a libimobiledevice tool
pub fn get_tool_command(tool_name: &str) -> String {
    get_tool_path_with_logging(tool_name)
        .map(|p| {
            let cmd = p.to_string_lossy().to_string();
            info!("  Using resolved path: {}", cmd);
            cmd
        })
        .unwrap_or_else(|| {
            info!("  Falling back to system {}", tool_name);
            tool_name.to_string()
        })
}
