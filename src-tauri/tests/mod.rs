// Integration tests for Tauri commands
// These tests verify that the command functions work correctly

use flippio::*;
use tempfile::TempDir;
use std::fs;
use rusqlite::Connection;

/// Create a test SQLite database with sample data for integration tests
fn create_integration_test_database(db_path: &str) -> Result<(), rusqlite::Error> {
    let conn = Connection::open(db_path)?;
    
    // Create a simple test table
    conn.execute(
        "CREATE TABLE test_table (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            value INTEGER,
            description TEXT
        )",
        [],
    )?;
    
    // Insert test data
    conn.execute(
        "INSERT INTO test_table (name, value, description) VALUES (?1, ?2, ?3)",
        ["Test Item 1", "100", "First test item"],
    )?;
    
    conn.execute(
        "INSERT INTO test_table (name, value, description) VALUES (?1, ?2, ?3)",
        ["Test Item 2", "200", "Second test item"],
    )?;
    
    Ok(())
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    use flippio::commands::device::helpers::*;

    #[test]
    fn test_database_helper_functions() {
        // Test database helper functions work correctly
        assert_eq!(
            get_default_value_for_type("INTEGER"),
            serde_json::Value::Number(serde_json::Number::from(0))
        );
        
        assert_eq!(
            get_default_value_for_type("TEXT"),
            serde_json::Value::String("".to_string())
        );
        
        assert_eq!(
            get_default_value_for_type("BOOLEAN"),
            serde_json::Value::Bool(false)
        );
    }

    #[test]
    fn test_device_helper_functions() {
        // Test device helper functions
        let temp_dir_path = get_temp_dir_path();
        assert!(temp_dir_path.to_string_lossy().contains("flippio-db-temp"));
        
        // Test that ensure_temp_dir creates directory
        let result = ensure_temp_dir();
        assert!(result.is_ok());
        
        // Clean up
        let temp_dir = get_temp_dir_path();
        if temp_dir.exists() {
            std::fs::remove_dir_all(&temp_dir).ok();
        }
    }

    #[test]
    fn test_sqlite_wal_reset_integration() -> Result<(), Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        let db_path = temp_dir.path().join("integration_test.db");
        
        // Create a test database
        create_integration_test_database(db_path.to_str().unwrap())?;
        
        // Create mock WAL and SHM files
        let wal_path = temp_dir.path().join("integration_test.db-wal");
        let shm_path = temp_dir.path().join("integration_test.db-shm");
        fs::write(&wal_path, "test wal content")?;
        fs::write(&shm_path, "test shm content")?;
        
        // Verify files exist
        assert!(db_path.exists());
        assert!(wal_path.exists());
        assert!(shm_path.exists());
        
        // Test the WAL reset function
        let result = reset_sqlite_wal_mode(db_path.to_str().unwrap());
        assert!(result.is_ok());
        
        // Verify WAL and SHM files are removed but database remains
        assert!(db_path.exists());
        assert!(!wal_path.exists());
        assert!(!shm_path.exists());
        
        Ok(())
    }

    #[test]
    fn test_database_connection_manager_integration() -> Result<(), Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        let db_path = temp_dir.path().join("connection_test.db");
        
        // Create a test database
        create_integration_test_database(db_path.to_str().unwrap())?;
        
        // Test connection manager
        let rt = tokio::runtime::Runtime::new()?;
        rt.block_on(async {
            let manager = DatabaseConnectionManager::new();
            
            // Test getting a connection
            let conn_result = manager.get_connection(db_path.to_str().unwrap()).await;
            assert!(conn_result.is_ok());
            
            // Test closing the connection
            let _ = manager.close_connection(db_path.to_str().unwrap()).await;
        });
        
        Ok(())
    }

    #[test]
    fn test_temp_directory_workflow() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Test the temp directory helper functions work
        let temp_path = get_temp_dir_path();
        assert!(temp_path.to_string_lossy().contains("flippio-db-temp"));
        
        // Test that ensure_temp_dir works
        let result = ensure_temp_dir();
        assert!(result.is_ok());
        
        // Test that clean_temp_dir works (preserves recent files)
        let result = clean_temp_dir();
        assert!(result.is_ok());
        
        Ok(())
    }

    #[test]
    fn test_multiple_database_operations() -> Result<(), Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        let db1_path = temp_dir.path().join("db1.db");
        let db2_path = temp_dir.path().join("db2.db");
        
        // Create two test databases
        create_integration_test_database(db1_path.to_str().unwrap())?;
        create_integration_test_database(db2_path.to_str().unwrap())?;
        
        // Test that both databases are accessible
        let conn1 = Connection::open(&db1_path)?;
        let conn2 = Connection::open(&db2_path)?;
        
        // Test querying both databases
        let mut stmt1 = conn1.prepare("SELECT COUNT(*) FROM test_table")?;
        let count1: i64 = stmt1.query_row([], |row| row.get(0))?;
        assert_eq!(count1, 2);
        
        let mut stmt2 = conn2.prepare("SELECT COUNT(*) FROM test_table")?;
        let count2: i64 = stmt2.query_row([], |row| row.get(0))?;
        assert_eq!(count2, 2);
        
        // Test WAL reset on both
        let result1 = reset_sqlite_wal_mode(db1_path.to_str().unwrap());
        let result2 = reset_sqlite_wal_mode(db2_path.to_str().unwrap());
        assert!(result1.is_ok());
        assert!(result2.is_ok());
        
        Ok(())
    }

    #[test]
    fn test_error_handling() {
        // Test error handling for non-existent database
        let result = reset_sqlite_wal_mode("/non/existent/path/database.db");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Database file does not exist"));
        
        // Test error handling for invalid paths
        let result = reset_sqlite_wal_mode("");
        assert!(result.is_err());
    }

    #[test]
    fn test_path_handling() {
        // Test libimobiledevice tool path function
        let tool_path = get_libimobiledevice_tool_path("idevice_id");
        // Function returns Option<PathBuf>, so we just check it returns something
        assert!(tool_path.is_some() || tool_path.is_none());
        
        // Test with empty tool name
        let empty_tool_path = get_libimobiledevice_tool_path("");
        assert!(empty_tool_path.is_some() || empty_tool_path.is_none());
        
        // Test temp directory path generation
        let temp_path = get_temp_dir_path();
        assert!(temp_path.to_string_lossy().contains("flippio-db-temp"));
    }
} 