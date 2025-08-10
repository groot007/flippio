//! Embedded binary utilities for cross-platform tool management
//! 
//! This module handles embedding external tools directly into the executable
//! and extracting them to temporary directories at runtime.

use std::path::PathBuf;
use std::fs;
use log::{info, warn, error};

// Embed Windows iOS tools (mixed architecture - afcclient is 64-bit only, others are 32-bit)
#[cfg(target_os = "windows")]
const AFCCLIENT_BYTES: &[u8] = include_bytes!("../../../../resources/libimobiledevice-windows/afcclient.exe");
#[cfg(target_os = "windows")]
const IDEVICE_ID_BYTES: &[u8] = include_bytes!("../../../../resources/libimobiledevice-windows/idevice_id.exe");
#[cfg(target_os = "windows")]
const IDEVICEINFO_BYTES: &[u8] = include_bytes!("../../../../resources/libimobiledevice-windows/ideviceinfo.exe");
#[cfg(target_os = "windows")]
const IDEVICEINSTALLER_BYTES: &[u8] = include_bytes!("../../../../resources/libimobiledevice-windows/ideviceinstaller.exe");

// Embed Windows ADB tool
#[cfg(target_os = "windows")]
const ADB_BYTES: &[u8] = include_bytes!("../../../../resources/adb-platform-tools/adb.exe");

// Embed ADB Windows API DLLs
#[cfg(target_os = "windows")]
const ADBWINAPI_DLL: &[u8] = include_bytes!("../../../../resources/adb-platform-tools/AdbWinApi.dll");
#[cfg(target_os = "windows")]
const ADBWINUSBAPI_DLL: &[u8] = include_bytes!("../../../../resources/adb-platform-tools/AdbWinUsbApi.dll");
#[cfg(target_os = "windows")]
const ADB_LIBWINPTHREAD_DLL: &[u8] = include_bytes!("../../../../resources/adb-platform-tools/libwinpthread-1.dll");

// Embed required Windows DLLs for libimobiledevice (complete set)
#[cfg(target_os = "windows")]
const LIBIMOBILEDEVICE_DLL: &[u8] = include_bytes!("../../../../resources/libimobiledevice-windows/libimobiledevice.dll");
#[cfg(target_os = "windows")]
const LIBPLIST_DLL: &[u8] = include_bytes!("../../../../resources/libimobiledevice-windows/libplist.dll");
#[cfg(target_os = "windows")]
const LIBUSBMUXD_DLL: &[u8] = include_bytes!("../../../../resources/libimobiledevice-windows/libusbmuxd.dll");
#[cfg(target_os = "windows")]
const LIBWINPTHREAD_DLL: &[u8] = include_bytes!("../../../../resources/libimobiledevice-windows/libwinpthread-1.dll");
#[cfg(target_os = "windows")]
const LIBGCC_DLL: &[u8] = include_bytes!("../../../../resources/libimobiledevice-windows/libgcc_s_dw2-1.dll");
#[cfg(target_os = "windows")]
const LIBZIP_DLL: &[u8] = include_bytes!("../../../../resources/libimobiledevice-windows/libzip.dll");
#[cfg(target_os = "windows")]
const LIBZIP4_DLL: &[u8] = include_bytes!("../../../../resources/libimobiledevice-windows/libzip-4.dll");
#[cfg(target_os = "windows")]
const LIBSSL_DLL: &[u8] = include_bytes!("../../../../resources/libimobiledevice-windows/libssl-1_1.dll");
#[cfg(target_os = "windows")]
const LIBCRYPTO_DLL: &[u8] = include_bytes!("../../../../resources/libimobiledevice-windows/libcrypto-1_1.dll");
#[cfg(target_os = "windows")]
const ZLIB1_DLL: &[u8] = include_bytes!("../../../../resources/libimobiledevice-windows/zlib1.dll");
#[cfg(target_os = "windows")]
const LIBICONV_DLL: &[u8] = include_bytes!("../../../../resources/libimobiledevice-windows/libiconv-2.dll");
#[cfg(target_os = "windows")]
const LIBXML2_DLL: &[u8] = include_bytes!("../../../../resources/libimobiledevice-windows/libxml2-2.dll");
#[cfg(target_os = "windows")]
const LIBLZMA_DLL: &[u8] = include_bytes!("../../../../resources/libimobiledevice-windows/liblzma-5.dll");
#[cfg(target_os = "windows")]
const LIBFFI_DLL: &[u8] = include_bytes!("../../../../resources/libimobiledevice-windows/libffi-6.dll");
#[cfg(target_os = "windows")]
const LIBINTL_DLL: &[u8] = include_bytes!("../../../../resources/libimobiledevice-windows/libintl-8.dll");
#[cfg(target_os = "windows")]
const LIBIDEVICEACTIVATION_DLL: &[u8] = include_bytes!("../../../../resources/libimobiledevice-windows/libideviceactivation.dll");
#[cfg(target_os = "windows")]
const LIBIRECOVERY_DLL: &[u8] = include_bytes!("../../../../resources/libimobiledevice-windows/libirecovery.dll");
#[cfg(target_os = "windows")]
const LIBBZ2_DLL: &[u8] = include_bytes!("../../../../resources/libimobiledevice-windows/libbz2-1.dll");
#[cfg(target_os = "windows")]
const LIBEAY32_DLL: &[u8] = include_bytes!("../../../../resources/libimobiledevice-windows/libeay32.dll");
#[cfg(target_os = "windows")]
const SSLEAY32_DLL: &[u8] = include_bytes!("../../../../resources/libimobiledevice-windows/ssleay32.dll");

// macOS tools are handled differently (bundled in app package)
// For macOS, we'll still use the existing bundling approach

/// Extract an embedded tool to a temporary directory
fn extract_tool_to_temp(name: &str, bytes: &[u8]) -> Result<PathBuf, Box<dyn std::error::Error + Send + Sync>> {
    // Create a dedicated temp directory for Flippio tools
    let temp_dir = std::env::temp_dir().join("flippio-tools");
    if !temp_dir.exists() {
        fs::create_dir_all(&temp_dir)?;
    }
    
    let tool_path = temp_dir.join(name);
    
    // Only extract if the file doesn't exist or is different
    let should_extract = !tool_path.exists() || {
        if let Ok(existing_bytes) = fs::read(&tool_path) {
            existing_bytes != bytes
        } else {
            true
        }
    };
    
    if should_extract {
        fs::write(&tool_path, bytes)?;
        info!("📦 Extracted embedded tool '{}' to: {:?}", name, tool_path);
        
        // Set executable permissions on Unix-like systems
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&tool_path)?.permissions();
            perms.set_mode(0o755);
            fs::set_permissions(&tool_path, perms)?;
        }
    } else {
        info!("📦 Using existing embedded tool '{}' at: {:?}", name, tool_path);
    }
    
    Ok(tool_path)
}

/// Extract all required DLLs for Windows libimobiledevice tools (complete set)
#[cfg(target_os = "windows")]
fn extract_windows_dlls() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let dlls = [
        ("libimobiledevice.dll", LIBIMOBILEDEVICE_DLL),
        ("libplist.dll", LIBPLIST_DLL),
        ("libusbmuxd.dll", LIBUSBMUXD_DLL),
        ("libwinpthread-1.dll", LIBWINPTHREAD_DLL),
        ("libgcc_s_dw2-1.dll", LIBGCC_DLL),
        ("libzip.dll", LIBZIP_DLL),
        ("libzip-4.dll", LIBZIP4_DLL),
        ("libssl-1_1.dll", LIBSSL_DLL),
        ("libcrypto-1_1.dll", LIBCRYPTO_DLL),
        ("zlib1.dll", ZLIB1_DLL),
        ("libiconv-2.dll", LIBICONV_DLL),
        ("libxml2-2.dll", LIBXML2_DLL),
        ("liblzma-5.dll", LIBLZMA_DLL),
        ("libffi-6.dll", LIBFFI_DLL),
        ("libintl-8.dll", LIBINTL_DLL),
        ("libideviceactivation.dll", LIBIDEVICEACTIVATION_DLL),
        ("libirecovery.dll", LIBIRECOVERY_DLL),
        ("libbz2-1.dll", LIBBZ2_DLL),
        ("libeay32.dll", LIBEAY32_DLL),
        ("ssleay32.dll", SSLEAY32_DLL),
    ];
    
    for (name, bytes) in &dlls {
        extract_tool_to_temp(name, bytes)?;
    }
    
    // Create copies with alternative names that might be expected
    let temp_dir = std::env::temp_dir().join("flippio-tools");
    
    // Copy libimobiledevice.dll to the versioned name expected by tools
    let src_path = temp_dir.join("libimobiledevice.dll");
    let dst_path = temp_dir.join("libimobiledevice-1.0.dll");
    if src_path.exists() && !dst_path.exists() {
        fs::copy(&src_path, &dst_path)?;
        info!("📦 Created alias: libimobiledevice-1.0.dll");
    }
    
    // Copy libplist.dll to the versioned name expected by tools
    let src_path = temp_dir.join("libplist.dll");
    let dst_path = temp_dir.join("libplist-2.0.dll");
    if src_path.exists() && !dst_path.exists() {
        fs::copy(&src_path, &dst_path)?;
        info!("📦 Created alias: libplist-2.0.dll");
    }
    
    // Create libimobiledevice-glue-1.0.dll as a fallback (copy of libimobiledevice.dll)
    let src_path = temp_dir.join("libimobiledevice.dll");
    let dst_path = temp_dir.join("libimobiledevice-glue-1.0.dll");
    if src_path.exists() && !dst_path.exists() {
        fs::copy(&src_path, &dst_path)?;
        info!("📦 Created fallback alias: libimobiledevice-glue-1.0.dll");
    }
    
    // Note: If libimobiledevice-glue is actually a separate library,
    // we would need to find and include the correct DLL file
    
    info!("📦 Successfully extracted all required Windows DLLs with aliases");
    Ok(())
}

/// Extract all required DLLs for Windows ADB tool
#[cfg(target_os = "windows")]
fn extract_adb_dlls() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let dlls = [
        ("AdbWinApi.dll", ADBWINAPI_DLL),
        ("AdbWinUsbApi.dll", ADBWINUSBAPI_DLL),
        ("libwinpthread-1.dll", ADB_LIBWINPTHREAD_DLL),
    ];
    
    for (name, bytes) in &dlls {
        extract_tool_to_temp(name, bytes)?;
    }
    
    info!("📦 Successfully extracted all required ADB DLLs");
    Ok(())
}

/// Get the path to an embedded iOS tool (Windows only)
#[cfg(target_os = "windows")]
pub fn get_embedded_ios_tool_path(tool_name: &str) -> Option<PathBuf> {
    // First extract all required DLLs
    if let Err(e) = extract_windows_dlls() {
        error!("📦 Failed to extract Windows DLLs: {}", e);
        return None;
    }
    
    let (filename, bytes) = match tool_name {
        "afcclient" => ("afcclient.exe", AFCCLIENT_BYTES),
        "idevice_id" => ("idevice_id.exe", IDEVICE_ID_BYTES),
        "ideviceinfo" => ("ideviceinfo.exe", IDEVICEINFO_BYTES),
        "ideviceinstaller" => ("ideviceinstaller.exe", IDEVICEINSTALLER_BYTES),
        _ => {
            warn!("📦 Unknown iOS tool requested: {}", tool_name);
            return None;
        }
    };
    
    match extract_tool_to_temp(filename, bytes) {
        Ok(path) => {
            info!("📦 Successfully extracted iOS tool '{}': {:?}", tool_name, path);
            Some(path)
        }
        Err(e) => {
            error!("📦 Failed to extract iOS tool '{}': {}", tool_name, e);
            None
        }
    }
}

/// Get the path to the embedded ADB tool (Windows only)
#[cfg(target_os = "windows")]
pub fn get_embedded_adb_tool_path() -> Option<PathBuf> {
    // First extract all required ADB DLLs
    if let Err(e) = extract_adb_dlls() {
        error!("📦 Failed to extract ADB DLLs: {}", e);
        return None;
    }
    
    match extract_tool_to_temp("adb.exe", ADB_BYTES) {
        Ok(path) => {
            info!("📦 Successfully extracted ADB tool: {:?}", path);
            Some(path)
        }
        Err(e) => {
            error!("📦 Failed to extract ADB tool: {}", e);
            None
        }
    }
}

/// Stub functions for non-Windows platforms
#[cfg(not(target_os = "windows"))]
pub fn get_embedded_ios_tool_path(_tool_name: &str) -> Option<PathBuf> {
    None // Use existing bundling approach on macOS/Linux
}

#[cfg(not(target_os = "windows"))]
pub fn get_embedded_adb_tool_path() -> Option<PathBuf> {
    None // Use existing bundling approach on macOS/Linux
}

/// Clean up old extracted tools (optional maintenance function)
pub fn cleanup_old_tools() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let temp_dir = std::env::temp_dir().join("flippio-tools");
    if temp_dir.exists() {
        // Remove tools older than 7 days
        let seven_days_ago = std::time::SystemTime::now() - std::time::Duration::from_secs(7 * 24 * 60 * 60);
        
        for entry in fs::read_dir(&temp_dir)? {
            let entry = entry?;
            let metadata = entry.metadata()?;
            if let Ok(modified) = metadata.modified() {
                if modified < seven_days_ago {
                    if let Err(e) = fs::remove_file(entry.path()) {
                        warn!("📦 Failed to clean up old tool {}: {}", entry.path().display(), e);
                    } else {
                        info!("📦 Cleaned up old tool: {}", entry.path().display());
                    }
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_cleanup_old_tools() {
        // This should not fail even if no tools exist
        assert!(cleanup_old_tools().is_ok());
    }
    
    #[cfg(target_os = "windows")]
    #[test]
    fn test_extract_tool_to_temp() {
        let test_data = b"test binary data";
        let result = extract_tool_to_temp("test_tool.exe", test_data);
        assert!(result.is_ok());
        
        let path = result.unwrap();
        assert!(path.exists());
        
        // Verify content
        let extracted_data = fs::read(&path).unwrap();
        assert_eq!(extracted_data, test_data);
        
        // Clean up
        let _ = fs::remove_file(&path);
    }
}
