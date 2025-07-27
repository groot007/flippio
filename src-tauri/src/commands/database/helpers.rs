// Database helpers - exact copy from original database.rs
// Database helpers with safe default value generation

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

/// Clear SQLite WAL files and reset database to normal mode
pub fn reset_sqlite_wal_mode(db_path: &str) -> Result<(), String> {
    let path = Path::new(db_path);
    if !path.exists() {
        return Err(format!("Database file does not exist: {}", db_path));
    }
    
    let db_dir = path.parent().unwrap_or(Path::new("."));
    let db_stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("database");
    
    // Remove WAL and SHM files that might be causing locks
    for suffix in ["db-wal", "db-shm"].iter() {
        let aux_path = db_dir.join(format!("{}.{}", db_stem, suffix));
        if aux_path.exists() {
            log::info!("🗑️ Removing SQLite {} file: {}", suffix, aux_path.display());
            if let Err(e) = fs::remove_file(&aux_path) {
                log::warn!("⚠️ Failed to remove {} file: {}", suffix, e);
            } else {
                log::info!("✅ Removed {} file successfully", suffix);
            }
        }
    }
    
    Ok(())
}

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
        
        // Always ensure write permissions (even if they appear to be set)
        // This is needed for files pulled from iOS devices
        log::info!("🔧 Ensuring write permissions for database file: {}", db_path);
        
        // Set read-write permissions for owner (0o644 = rw-r--r--)
        let mut permissions = metadata.permissions();
        permissions.set_mode(0o644);
        
        match fs::set_permissions(path, permissions) {
            Ok(()) => {
                log::info!("✅ Set database file permissions to 644: {}", db_path);
            }
            Err(e) => {
                let error_msg = format!("Failed to set database file permissions: {}", e);
                log::error!("❌ {}", error_msg);
                return Err(error_msg);
            }
        }
        
        // Also fix permissions for SQLite WAL and SHM files if they exist
        let db_dir = path.parent().unwrap_or(Path::new("."));
        let db_stem = path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("database");
        
        // Check for WAL file (Write-Ahead Log)
        let wal_path = db_dir.join(format!("{}.db-wal", db_stem));
        if wal_path.exists() {
            log::info!("🔧 Found WAL file, fixing permissions: {}", wal_path.display());
            if let Ok(wal_metadata) = fs::metadata(&wal_path) {
                let mut wal_permissions = wal_metadata.permissions();
                wal_permissions.set_mode(0o644);
                if let Err(e) = fs::set_permissions(&wal_path, wal_permissions) {
                    log::warn!("⚠️ Failed to set WAL file permissions: {}", e);
                } else {
                    log::info!("✅ Set WAL file permissions to 644");
                }
            }
        }
        
        // Check for SHM file (Shared Memory)
        let shm_path = db_dir.join(format!("{}.db-shm", db_stem));
        if shm_path.exists() {
            log::info!("🔧 Found SHM file, fixing permissions: {}", shm_path.display());
            if let Ok(shm_metadata) = fs::metadata(&shm_path) {
                let mut shm_permissions = shm_metadata.permissions();
                shm_permissions.set_mode(0o644);
                if let Err(e) = fs::set_permissions(&shm_path, shm_permissions) {
                    log::warn!("⚠️ Failed to set SHM file permissions: {}", e);
                } else {
                    log::info!("✅ Set SHM file permissions to 644");
                }
            }
        }
        
        // Also ensure the parent directory is writable
        if let Some(parent_dir) = path.parent() {
            if let Ok(dir_metadata) = fs::metadata(parent_dir) {
                let dir_mode = dir_metadata.permissions().mode();
                if (dir_mode & 0o200) == 0 {
                    log::info!("🔧 Parent directory is read-only, fixing: {}", parent_dir.display());
                    let mut dir_permissions = dir_metadata.permissions();
                    dir_permissions.set_mode(0o755);
                    if let Err(e) = fs::set_permissions(parent_dir, dir_permissions) {
                        log::warn!("⚠️ Failed to set directory permissions: {}", e);
                    } else {
                        log::info!("✅ Set directory permissions to 755");
                    }
                }
            }
        }
        
        Ok(())
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
        
        // Always ensure write permissions (even if they appear to be set)
        log::info!("🔧 Ensuring write permissions for database file: {}", db_path);
        
        let mut permissions = metadata.permissions();
        permissions.set_readonly(false);
        
        match fs::set_permissions(path, permissions) {
            Ok(()) => {
                log::info!("✅ Removed read-only attribute from database file: {}", db_path);
            }
            Err(e) => {
                let error_msg = format!("Failed to set database file permissions: {}", e);
                log::error!("❌ {}", error_msg);
                return Err(error_msg);
            }
        }
        
        // Also fix permissions for SQLite WAL and SHM files if they exist
        let db_dir = path.parent().unwrap_or(Path::new("."));
        let db_stem = path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("database");
        
        // Check for WAL file
        let wal_path = db_dir.join(format!("{}.db-wal", db_stem));
        if wal_path.exists() {
            log::info!("🔧 Found WAL file, removing read-only: {}", wal_path.display());
            if let Ok(wal_metadata) = fs::metadata(&wal_path) {
                let mut wal_permissions = wal_metadata.permissions();
                wal_permissions.set_readonly(false);
                if let Err(e) = fs::set_permissions(&wal_path, wal_permissions) {
                    log::warn!("⚠️ Failed to set WAL file permissions: {}", e);
                }
            }
        }
        
        // Check for SHM file
        let shm_path = db_dir.join(format!("{}.db-shm", db_stem));
        if shm_path.exists() {
            log::info!("🔧 Found SHM file, removing read-only: {}", shm_path.display());
            if let Ok(shm_metadata) = fs::metadata(&shm_path) {
                let mut shm_permissions = shm_metadata.permissions();
                shm_permissions.set_readonly(false);
                if let Err(e) = fs::set_permissions(&shm_path, shm_permissions) {
                    log::warn!("⚠️ Failed to set SHM file permissions: {}", e);
                }
            }
        }
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use std::fs::File;

    #[test]
    fn test_get_default_value_for_type_integer() {
        let result = get_default_value_for_type("INTEGER");
        assert_eq!(result, serde_json::Value::Number(serde_json::Number::from(0)));
    }

    #[test]
    fn test_get_default_value_for_type_text() {
        let result = get_default_value_for_type("TEXT");
        assert_eq!(result, serde_json::Value::String("".to_string()));
    }

    #[test]
    fn test_get_default_value_for_type_varchar() {
        let result = get_default_value_for_type("VARCHAR");
        assert_eq!(result, serde_json::Value::String("".to_string()));
    }

    #[test]
    fn test_get_default_value_for_type_real() {
        let result = get_default_value_for_type("REAL");
        assert_eq!(result, serde_json::Value::Number(serde_json::Number::from_f64(0.0).unwrap()));
    }

    #[test]
    fn test_get_default_value_for_type_numeric() {
        let result = get_default_value_for_type("NUMERIC");
        assert_eq!(result, serde_json::Value::Number(serde_json::Number::from_f64(0.0).unwrap()));
    }

    #[test]
    fn test_get_default_value_for_type_blob() {
        let result = get_default_value_for_type("BLOB");
        assert_eq!(result, serde_json::Value::String("".to_string()));
    }

    #[test]
    fn test_get_default_value_for_type_boolean() {
        let result = get_default_value_for_type("BOOLEAN");
        assert_eq!(result, serde_json::Value::Bool(false));
    }

    #[test]
    fn test_get_default_value_for_type_unknown() {
        let result = get_default_value_for_type("UNKNOWN_TYPE");
        assert_eq!(result, serde_json::Value::Null);
    }

    #[test]
    fn test_get_default_value_for_type_case_insensitive() {
        let result = get_default_value_for_type("integer");
        assert_eq!(result, serde_json::Value::Number(serde_json::Number::from(0)));
        
        let result = get_default_value_for_type("Text");
        assert_eq!(result, serde_json::Value::String("".to_string()));
    }

    #[test]
    fn test_reset_sqlite_wal_mode_nonexistent_file() {
        let result = reset_sqlite_wal_mode("/nonexistent/path/database.db");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Database file does not exist"));
    }

    #[test]
    fn test_reset_sqlite_wal_mode_existing_file() -> Result<(), Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        let db_path = temp_dir.path().join("test.db");
        let wal_path = temp_dir.path().join("test.db-wal");
        let shm_path = temp_dir.path().join("test.db-shm");

        // Create test database file
        File::create(&db_path)?;
        
        // Create WAL and SHM files
        File::create(&wal_path)?;
        File::create(&shm_path)?;

        // Verify files exist before
        assert!(db_path.exists());
        assert!(wal_path.exists());
        assert!(shm_path.exists());

        // Run the function
        let result = reset_sqlite_wal_mode(db_path.to_str().unwrap());
        assert!(result.is_ok());

        // WAL and SHM files should be removed
        assert!(db_path.exists()); // Original DB should remain
        assert!(!wal_path.exists()); // WAL should be removed
        assert!(!shm_path.exists()); // SHM should be removed

        Ok(())
    }

    #[test]
    fn test_reset_sqlite_wal_mode_no_wal_files() -> Result<(), Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        let db_path = temp_dir.path().join("test.db");

        // Create only the database file (no WAL/SHM files)
        File::create(&db_path)?;

        // Run the function
        let result = reset_sqlite_wal_mode(db_path.to_str().unwrap());
        assert!(result.is_ok());

        // Database should still exist
        assert!(db_path.exists());

        Ok(())
    }
}
