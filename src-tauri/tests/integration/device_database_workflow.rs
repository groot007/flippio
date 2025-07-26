use std::sync::Arc;
use tokio::sync::RwLock;
use sqlx::sqlite::SqlitePool;
use serial_test::serial;

#[cfg(test)]
mod device_database_integration_tests {
    use super::*;
    use crate::fixtures::{test_databases::*, temp_files::*, mock_devices::*};
    
    #[tokio::test]
    #[serial]
    async fn test_full_device_database_discovery_workflow() {
        // Simulate the complete workflow from device discovery to database access
        
        // Step 1: Discover devices
        let ios_devices = create_mock_ios_devices();
        let adb_devices = create_mock_adb_devices();
        
        assert!(ios_devices.len() > 0, "Should have iOS devices");
        assert!(adb_devices.len() > 0, "Should have Android devices");
        
        // Step 2: For each device, discover apps
        let ios_apps = create_mock_ios_apps();
        let _android_apps = create_mock_android_apps();
        
        for device in &ios_devices {
            let device_apps: Vec<_> = ios_apps.iter()
                .filter(|app| app.device_udid == device.udid)
                .collect();
            
            if device.udid == "test-udid-1" {
                assert!(device_apps.len() > 0, "Device should have apps");
            }
        }
        
                // Step 3: Discover databases for these apps
        let ios_databases = create_mock_ios_databases();
        let _android_databases = create_mock_android_databases();
        
        for app in &ios_apps {
            let app_databases: Vec<_> = ios_databases.iter()
                .filter(|db| db.app_bundle_id == app.bundle_id)
                .collect();
                
            if app.bundle_id == "com.example.app1" {
                assert!(app_databases.len() > 0, "App should have databases");
            }
        }
        
        // Step 4: Transfer and open databases
        let temp_manager = TempFileManager::new();
        
        for _database in ios_databases.iter().take(1) { // Test one database
            let temp_file = temp_manager.create_temp_file("transferred_db", ".db").unwrap();
            
            // Simulate file transfer by creating a test database
            let (_temp_dir, source_db) = create_test_db().await;
            std::fs::copy(&source_db, &temp_file).unwrap();
            
            // Step 5: Connect to transferred database
            let pool = SqlitePool::connect(&format!("sqlite:{}", temp_file.display()))
                .await
                .unwrap();
                
            // Verify we can query the database
            let result = sqlx::query("SELECT COUNT(*) as count FROM test_table")
                .fetch_one(&pool)
                .await;
                
            assert!(result.is_ok(), "Should be able to query transferred database");
        }
    }
    
    #[tokio::test]
    #[serial]
    async fn test_concurrent_device_database_access() {
        // Test accessing databases from multiple devices concurrently
        let db_pool: Arc<RwLock<Option<SqlitePool>>> = Arc::new(RwLock::new(None));
        let temp_manager = TempFileManager::new();
        
        // Create multiple test databases
        let mut database_paths = Vec::new();
        for i in 0..3 {
            let (_temp_dir, db_path) = create_test_db().await;
            let temp_file = temp_manager.create_temp_file(&format!("device_db_{}", i), ".db").unwrap();
            std::fs::copy(&db_path, &temp_file).unwrap();
            database_paths.push(temp_file);
        }
        
        // Simulate concurrent access to different databases
        let handles: Vec<_> = database_paths.into_iter().enumerate().map(|(i, db_path)| {
            let db_pool_clone = Arc::clone(&db_pool);
            tokio::spawn(async move {
                // Each task connects to its own database
                let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.display()))
                    .await
                    .unwrap();
                    
                // Set the pool (simulating switching between device databases)
                {
                    let mut write_guard = db_pool_clone.write().await;
                    *write_guard = Some(pool);
                }
                
                // Query the database
                {
                    let read_guard = db_pool_clone.read().await;
                    if let Some(pool) = read_guard.as_ref() {
                        let result = sqlx::query("SELECT COUNT(*) as count FROM test_table")
                            .fetch_one(pool)
                            .await;
                        assert!(result.is_ok(), "Task {} should succeed", i);
                    }
                }
            })
        }).collect();
        
        // Wait for all tasks
        for handle in handles {
            assert!(handle.await.is_ok());
        }
    }
    
    #[tokio::test]
    #[serial]
    async fn test_device_disconnection_handling() {
        // Test handling of device disconnection during database operations
        let _ios_devices = create_mock_ios_devices();
        let db_pool: Arc<RwLock<Option<SqlitePool>>> = Arc::new(RwLock::new(None));
        
        // Simulate connected device with active database
        let (_temp_dir, db_path) = create_test_db().await;
        let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.display()))
            .await
            .unwrap();
            
        {
            let mut write_guard = db_pool.write().await;
            *write_guard = Some(pool);
        }
        
        // Verify database is accessible
        {
            let read_guard = db_pool.read().await;
            assert!(read_guard.is_some(), "Database should be connected");
        }
        
        // Simulate device disconnection by clearing the pool
        {
            let mut write_guard = db_pool.write().await;
            *write_guard = None;
        }
        
        // Verify database is no longer accessible
        {
            let read_guard = db_pool.read().await;
            assert!(read_guard.is_none(), "Database should be disconnected");
        }
    }
    
    #[tokio::test]
    #[serial]
    async fn test_database_switching_between_devices() {
        // Test switching between databases from different devices
        let db_pool: Arc<RwLock<Option<SqlitePool>>> = Arc::new(RwLock::new(None));
        
        // Create databases for different "devices"
        let (_temp_dir1, db_path1) = create_test_db().await;
        let (_temp_dir2, db_path2) = create_complex_test_db().await;
        
        // Connect to first device's database
        let pool1 = SqlitePool::connect(&format!("sqlite:{}", db_path1.display()))
            .await
            .unwrap();
            
        {
            let mut write_guard = db_pool.write().await;
            *write_guard = Some(pool1);
        }
        
        // Query first database
        {
            let read_guard = db_pool.read().await;
            if let Some(pool) = read_guard.as_ref() {
                let result = sqlx::query("SELECT COUNT(*) as count FROM test_table")
                    .fetch_one(pool)
                    .await;
                assert!(result.is_ok(), "Should query first database");
            }
        }
        
        // Switch to second device's database
        let pool2 = SqlitePool::connect(&format!("sqlite:{}", db_path2.display()))
            .await
            .unwrap();
            
        {
            let mut write_guard = db_pool.write().await;
            *write_guard = Some(pool2);
        }
        
        // Query second database (has different schema)
        {
            let read_guard = db_pool.read().await;
            if let Some(pool) = read_guard.as_ref() {
                let result = sqlx::query("SELECT COUNT(*) as count FROM users")
                    .fetch_one(pool)
                    .await;
                assert!(result.is_ok(), "Should query second database");
            }
        }
    }
    
    #[tokio::test]
    #[serial]
    async fn test_database_error_recovery() {
        // Test recovery from database errors
        let db_pool: Arc<RwLock<Option<SqlitePool>>> = Arc::new(RwLock::new(None));
        
        // Try to connect to non-existent database
        let bad_pool_result = SqlitePool::connect("sqlite:/nonexistent/database.db").await;
        assert!(bad_pool_result.is_err(), "Should fail to connect to bad database");
        
        // Pool should remain None
        {
            let read_guard = db_pool.read().await;
            assert!(read_guard.is_none(), "Pool should remain empty after failed connection");
        }
        
        // Now connect to a valid database
        let (_temp_dir, db_path) = create_test_db().await;
        let good_pool = SqlitePool::connect(&format!("sqlite:{}", db_path.display()))
            .await
            .unwrap();
            
        {
            let mut write_guard = db_pool.write().await;
            *write_guard = Some(good_pool);
        }
        
        // Verify recovery
        {
            let read_guard = db_pool.read().await;
            if let Some(pool) = read_guard.as_ref() {
                let result = sqlx::query("SELECT COUNT(*) as count FROM test_table")
                    .fetch_one(pool)
                    .await;
                assert!(result.is_ok(), "Should work after recovery");
            }
        }
    }
}
