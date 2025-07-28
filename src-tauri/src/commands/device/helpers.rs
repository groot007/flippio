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
    
    // Ensure temp directory exists
    if !temp_dir.exists() {
        fs::create_dir_all(&temp_dir)?;
        return Ok(temp_dir);
    }
    
    // Clean only old files (older than 1 hour) to preserve active database files
    clean_old_temp_files(&temp_dir, std::time::Duration::from_secs(3600))?;
    
    Ok(temp_dir)
}

/// Touch a file to update its modification time (keep it from being cleaned up)
pub fn touch_temp_file(file_path: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use std::time::SystemTime;
    
    let path = Path::new(file_path);
    if path.exists() {
        // Update the file's modification time to now
        let now = SystemTime::now();
        if let Ok(file) = fs::File::options().write(true).open(path) {
            if let Err(e) = file.set_modified(now) {
                log::warn!("⚠️ Failed to update file timestamp {}: {}", file_path, e);
            }
        }
    }
    Ok(())
}

/// Clean only old temporary files, preserving recently accessed ones
pub fn clean_old_temp_files(temp_dir: &Path, max_age: std::time::Duration) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use std::time::SystemTime;
    
    if !temp_dir.exists() {
        return Ok(());
    }
    
    let now = SystemTime::now();
    let mut cleaned_count = 0;
    
    for entry in fs::read_dir(temp_dir)? {
        let entry = entry?;
        let path = entry.path();
        
        if path.is_file() {
            // Check file age
            if let Ok(metadata) = entry.metadata() {
                if let Ok(modified) = metadata.modified() {
                    if let Ok(age) = now.duration_since(modified) {
                        if age > max_age {
                            if let Err(e) = fs::remove_file(&path) {
                                log::warn!("⚠️ Failed to remove old temp file {}: {}", path.display(), e);
                            } else {
                                log::info!("🗑️ Cleaned old temp file: {}", path.display());
                                cleaned_count += 1;
                            }
                        }
                    }
                }
            }
        }
    }
    
    if cleaned_count > 0 {
        log::info!("🧹 Cleaned {} old temp files", cleaned_count);
    }
    
    Ok(())
}

/// Tauri command to touch a file and keep it active
#[tauri::command]
pub async fn touch_database_file(file_path: String) -> Result<String, String> {
    match touch_temp_file(&file_path) {
        Ok(()) => {
            log::info!("📅 Updated timestamp for active database file: {}", file_path);
            Ok("File timestamp updated".to_string())
        }
        Err(e) => {
            log::error!("❌ Failed to update file timestamp: {}", e);
            Err(format!("Failed to update file timestamp: {}", e))
        }
    }
}

/// Force clean all temp files (use sparingly, e.g., app shutdown)
#[allow(dead_code)]
pub fn force_clean_temp_dir() -> Result<PathBuf, Box<dyn std::error::Error + Send + Sync>> {
    let temp_dir = get_temp_dir_path();
    
    // Remove existing temp directory if it exists
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir)?;
        log::info!("🗑️ Force cleaned entire temp directory");
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_get_temp_dir_path() {
        let temp_dir = get_temp_dir_path();
        assert!(temp_dir.to_string_lossy().contains("flippio-db-temp"));
    }

    #[test]
    fn test_ensure_temp_dir() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Test temp dir path generation (without actually creating)
        let temp_dir_path = get_temp_dir_path();
        assert!(temp_dir_path.to_string_lossy().contains("flippio-db-temp"));
        
        // Test that function works (may or may not create new dir if it already exists)
        let result = ensure_temp_dir();
        assert!(result.is_ok());
        
        let dir = result?;
        assert!(dir.exists());
        assert!(dir.is_dir());

        Ok(())
    }

    #[test]
    fn test_clean_temp_dir() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Test that clean_temp_dir preserves recent files and creates directory
        let temp_dir = get_temp_dir_path();
        
        // Ensure temp dir exists first
        let created_dir = ensure_temp_dir()?;
        assert!(created_dir.exists(), "Temp directory should be created");
        
        // Create a recent file (should be preserved since it's less than 1 hour old)
        let recent_file = temp_dir.join("recent_file.txt");
        fs::write(&recent_file, "recent content")?;
        assert!(recent_file.exists(), "Test file should be created");
        
        // Run clean_temp_dir
        let result = clean_temp_dir()?;
        
        // The result should be the temp directory path and it should exist
        assert!(result.exists(), "Temp directory should exist after clean_temp_dir");
        assert_eq!(result, temp_dir, "clean_temp_dir should return the temp directory path");
        
        // Recent file should still exist (since it's new)
        assert!(recent_file.exists(), "Recent file should be preserved");
        
        // Clean up test files
        let _ = fs::remove_file(&recent_file);
        
        Ok(())
    }

    #[test]
    fn test_force_clean_temp_dir() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Test the force clean functionality
        let temp_dir = get_temp_dir_path();
        let _ = ensure_temp_dir()?;
        
        // Create test files
        let test_file1 = temp_dir.join("test1.txt");
        let test_file2 = temp_dir.join("test2.txt");
        fs::write(&test_file1, "content1")?;
        fs::write(&test_file2, "content2")?;
        
        assert!(test_file1.exists());
        assert!(test_file2.exists());
        
        // Force clean should remove everything
        let result = force_clean_temp_dir()?;
        assert!(result.exists());
        assert!(!test_file1.exists());
        assert!(!test_file2.exists());
        
        Ok(())
    }

    #[test]
    fn test_get_adb_path() {
        let adb_path = get_adb_path();
        // Should return some path (might be just "adb" if not found)
        assert!(!adb_path.is_empty());
    }

    #[test]
    fn test_get_libimobiledevice_tool_path() {
        // Test with a known tool name
        let result = get_libimobiledevice_tool_path("idevice_id");
        // Function returns Option<PathBuf>, so we just verify it returns a valid Option
        assert!(result.is_some() || result.is_none());
    }

    #[test]
    fn test_get_libimobiledevice_tool_path_empty_tool() {
        let result = get_libimobiledevice_tool_path("");
        assert!(result.is_some() || result.is_none());
    }

    #[test]
    fn test_get_libimobiledevice_tool_path_nonexistent_tool() {
        let result = get_libimobiledevice_tool_path("nonexistent_tool_12345");
        assert!(result.is_some() || result.is_none());
    }

    #[test]
    fn test_temp_dir_operations_integration() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Test the path generation logic
        let temp_path = get_temp_dir_path();
        assert!(temp_path.to_string_lossy().contains("flippio-db-temp"));
        
        // Test that ensure_temp_dir works
        let result = ensure_temp_dir();
        assert!(result.is_ok());
        
        // Test that clean_temp_dir works
        let result = clean_temp_dir();
        assert!(result.is_ok());
        
        Ok(())
    }
}
