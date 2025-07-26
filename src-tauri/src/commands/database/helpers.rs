// Database helpers - exact copy from original database.rs
// Database helpers with safe default value generation

use sqlx::sqlite::SqliteTypeInfo;
use std::fs;
use std::path::Path;

// Helper to get default values for column types
pub fn get_default_value_for_type(type_name: &str) -> serde_json::Value {
    match type_name.to_uppercase().as_str() {
        "INTEGER" => serde_json::Value::Number(serde_json::Number::from(0)),
        "REAL" | "NUMERIC" => serde_json::Value::Number(
            serde_json::Number::from_f64(0.0).unwrap_or(serde_json::Number::from(0))
        ),
        "TEXT" | "VARCHAR" => serde_json::Value::String("".to_string()),
        "BLOB" => serde_json::Value::String("".to_string()),
        "BOOLEAN" => serde_json::Value::Bool(false),
        _ => serde_json::Value::Null,
    }
}

// Safe binding helpers moved inline to database commands for better type compatibility

/// Ensure database file has proper read-write permissions
/// This fixes issues with database files copied from devices that might be read-only
pub fn ensure_database_file_permissions(db_path: &str) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        
        let path = Path::new(db_path);
        
        // Check if file exists
        if !path.exists() {
            return Err(format!("Database file does not exist: {}", db_path));
        }
        
        // Get current permissions
        let metadata = match fs::metadata(path) {
            Ok(metadata) => metadata,
            Err(e) => return Err(format!("Failed to read file metadata: {}", e)),
        };
        
        let current_mode = metadata.permissions().mode();
        log::info!("📋 Current file permissions for {}: {:o}", db_path, current_mode);
        
        // Check if file is writable by owner (0o200 = owner write permission)
        if (current_mode & 0o200) == 0 {
            log::warn!("⚠️ Database file is read-only, fixing permissions: {}", db_path);
            
            // Set read-write permissions for owner (0o644 = rw-r--r--)
            let mut permissions = metadata.permissions();
            permissions.set_mode(0o644);
            
            match fs::set_permissions(path, permissions) {
                Ok(()) => {
                    log::info!("✅ Fixed database file permissions: {}", db_path);
                    Ok(())
                }
                Err(e) => {
                    let error_msg = format!("Failed to set database file permissions: {}", e);
                    log::error!("❌ {}", error_msg);
                    Err(error_msg)
                }
            }
        } else {
            log::info!("✅ Database file permissions are OK: {}", db_path);
            Ok(())
        }
    }
    
    #[cfg(windows)]
    {
        // On Windows, try to remove read-only attribute
        let path = Path::new(db_path);
        
        if !path.exists() {
            return Err(format!("Database file does not exist: {}", db_path));
        }
        
        let metadata = match fs::metadata(path) {
            Ok(metadata) => metadata,
            Err(e) => return Err(format!("Failed to read file metadata: {}", e)),
        };
        
        if metadata.permissions().readonly() {
            log::warn!("⚠️ Database file is read-only, fixing permissions: {}", db_path);
            
            let mut permissions = metadata.permissions();
            permissions.set_readonly(false);
            
            match fs::set_permissions(path, permissions) {
                Ok(()) => {
                    log::info!("✅ Fixed database file permissions: {}", db_path);
                    Ok(())
                }
                Err(e) => {
                    let error_msg = format!("Failed to set database file permissions: {}", e);
                    log::error!("❌ {}", error_msg);
                    Err(error_msg)
                }
            }
        } else {
            log::info!("✅ Database file permissions are OK: {}", db_path);
            Ok(())
        }
    }
}
