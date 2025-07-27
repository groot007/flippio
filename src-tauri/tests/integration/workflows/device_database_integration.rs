use std::collections::HashMap;
use serial_test::serial;
use serde_json::json;
use sqlx::{SqlitePool, Row, Column, ValueRef};

// Import the actual database connection manager from the flippio library crate
use flippio::DatabaseConnectionManager;

#[cfg(test)]
mod device_database_integration_tests {
    use super::*;
    use crate::fixtures::{temp_files::*, mock_devices::*};
    
    /// Test fixture for device database workflows with real connection management
    struct DeviceDatabaseTestFixture {
        pub connection_manager: DatabaseConnectionManager,
        temp_manager: TempFileManager,
    }

    impl DeviceDatabaseTestFixture {
        fn new() -> Self {
            let temp_manager = TempFileManager::new();
            let connection_manager = DatabaseConnectionManager::new();

            Self {
                connection_manager,
                temp_manager,
            }
        }

        async fn create_test_database_with_schema(&self, name: &str, schema_sql: &str) -> String {
            let db_path = self.temp_manager.create_temp_file(name, ".db").unwrap();
            let db_path_str = db_path.to_string_lossy().to_string();
            
            // Create the schema using raw SQLite (only for test setup)
            let pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", db_path_str))
                .await
                .unwrap();
            sqlx::query(schema_sql).execute(&pool).await.unwrap();
            pool.close().await;
            
            db_path_str
        }

        async fn get_connection(&self, db_path: &str) -> Result<SqlitePool, String> {
            self.connection_manager.get_connection(db_path).await
        }

        async fn verify_database_connectivity(&self, db_path: &str) -> Result<bool, String> {
            let connection_result = self.connection_manager.get_connection(db_path).await;
            match connection_result {
                Ok(pool) => {
                    let result = sqlx::query("SELECT COUNT(*) as count FROM sqlite_master")
                        .fetch_one(&pool)
                        .await;
                    match result {
                        Ok(_) => Ok(true),
                        Err(e) => Err(format!("Database query failed: {}", e)),
                    }
                }
                Err(e) => Err(format!("Connection failed: {}", e)),
            }
        }

        async fn get_table_count(&self, db_path: &str, table_name: &str) -> Result<i64, String> {
            let pool = self.get_connection(db_path).await?;
            
            let query = format!("SELECT COUNT(*) as count FROM {}", table_name);
            let row = sqlx::query(&query)
                .fetch_one(&pool)
                .await
                .map_err(|e| format!("Database query error: {}", e))?;

            let count: i64 = row.try_get("count")
                .map_err(|e| format!("Failed to get count: {}", e))?;
            
            Ok(count)
        }

        fn simulate_device_transfer(&self, source_db: &str, device_name: &str) -> String {
            // Simulate transferring a database from a device by copying it locally
            let transferred_path = self.temp_manager.create_temp_file(device_name, ".db").unwrap();
            std::fs::copy(source_db, &transferred_path).unwrap();
            transferred_path.to_string_lossy().to_string()
        }
    }
    
    #[tokio::test]
    #[serial]
    async fn test_full_device_database_discovery_workflow() {
        let fixture = DeviceDatabaseTestFixture::new();
        
        // === Step 1: Discover devices (simulated) ===
        let ios_devices = create_mock_ios_devices();
        let adb_devices = create_mock_adb_devices();
        
        assert!(ios_devices.len() > 0, "Should have iOS devices");
        assert!(adb_devices.len() > 0, "Should have Android devices");
        
        // === Step 2: For each device, discover apps ===
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
        
        // === Step 3: Discover databases for these apps ===
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
        
        // === Step 4: Transfer and open databases using real connection manager ===
        for _database in ios_databases.iter().take(1) { // Test one database
            // Create a mock database to simulate device database
            let device_db = fixture.create_test_database_with_schema("device_source",
                "CREATE TABLE test_table (
                    id INTEGER PRIMARY KEY,
                    data TEXT
                );
                INSERT INTO test_table (data) VALUES ('device_data');"
            ).await;
            
            // Simulate file transfer
            let transferred_db = fixture.simulate_device_transfer(&device_db, "transferred_db");
            
            // === Step 5: Connect to transferred database using real connection manager ===
            let connection_result = fixture.verify_database_connectivity(&transferred_db).await;
            assert!(connection_result.is_ok(), "Should connect to transferred database: {:?}", connection_result);
            
            // Verify we can query the database using real connection manager
            let record_count = fixture.get_table_count(&transferred_db, "test_table").await;
            assert!(record_count.is_ok(), "Should be able to query transferred database");
            assert_eq!(record_count.unwrap(), 1, "Should have 1 record in transferred database");
        }
    }
    
    #[tokio::test]
    #[serial]
    async fn test_concurrent_device_database_access() {
        let fixture = DeviceDatabaseTestFixture::new();
        
        // === Create multiple test databases (simulating different devices) ===
        let mut database_paths = Vec::new();
        for i in 0..3 {
            let device_db = fixture.create_test_database_with_schema(
                &format!("device_db_{}", i),
                &format!("CREATE TABLE test_table (
                    id INTEGER PRIMARY KEY,
                    data TEXT
                );
                INSERT INTO test_table (data) VALUES ('device_{}_data');", i)
            ).await;
            
            // Simulate device transfer
            let transferred_db = fixture.simulate_device_transfer(&device_db, &format!("device_{}_transferred", i));
            database_paths.push(transferred_db);
        }
        
        // === Simulate concurrent access to different device databases ===
        let handles: Vec<_> = database_paths.into_iter().enumerate().map(|(i, db_path)| {
            let connection_manager = DatabaseConnectionManager::new();
            tokio::spawn(async move {
                // Each task connects to its own device database using real connection manager
                let connection_result = connection_manager.get_connection(&db_path).await;
                assert!(connection_result.is_ok(), "Task {} should connect to device database", i);
                
                let pool = connection_result.unwrap();
                
                // Query the database
                let result = sqlx::query("SELECT COUNT(*) as count FROM test_table")
                    .fetch_one(&pool)
                    .await;
                assert!(result.is_ok(), "Task {} should succeed", i);
                
                let count: i64 = result.unwrap().try_get("count").unwrap();
                assert_eq!(count, 1, "Device {} should have 1 record", i);
            })
        }).collect();
        
        // Wait for all tasks
        for handle in handles {
            assert!(handle.await.is_ok(), "All device database access tasks should complete");
        }
    }
    
    #[tokio::test]
    #[serial]
    async fn test_device_disconnection_handling() {
        let fixture = DeviceDatabaseTestFixture::new();
        
        // === Simulate connected device with active database ===
        let _ios_devices = create_mock_ios_devices();
        
        let device_db = fixture.create_test_database_with_schema("connected_device",
            "CREATE TABLE test_table (
                id INTEGER PRIMARY KEY,
                data TEXT
            );
            INSERT INTO test_table (data) VALUES ('connected_data');"
        ).await;
        
        let transferred_db = fixture.simulate_device_transfer(&device_db, "connected_transferred");
        
        // === Verify database is accessible using real connection manager ===
        let connectivity_result = fixture.verify_database_connectivity(&transferred_db).await;
        assert!(connectivity_result.is_ok(), "Database should be accessible initially");
        
        let initial_count = fixture.get_table_count(&transferred_db, "test_table").await;
        assert!(initial_count.is_ok(), "Should query database when connected");
        assert_eq!(initial_count.unwrap(), 1, "Should have initial data");
        
        // === Simulate device disconnection by removing the database file ===
        std::fs::remove_file(&transferred_db).unwrap();
        
        // === Verify database is no longer accessible ===
        let disconnected_result = fixture.verify_database_connectivity(&transferred_db).await;
        assert!(disconnected_result.is_err(), "Database should not be accessible after disconnection");
        
        let query_result = fixture.get_table_count(&transferred_db, "test_table").await;
        assert!(query_result.is_err(), "Should fail to query after disconnection");
    }
    
    #[tokio::test]
    #[serial]
    async fn test_database_switching_between_devices() {
        let fixture = DeviceDatabaseTestFixture::new();
        
        // === Create databases for different "devices" ===
        let device1_db = fixture.create_test_database_with_schema("device1_original",
            "CREATE TABLE test_table (
                id INTEGER PRIMARY KEY,
                data TEXT
            );
            INSERT INTO test_table (data) VALUES ('device1_data');"
        ).await;
        
        let device2_db = fixture.create_test_database_with_schema("device2_original",
            "CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL
            );
            INSERT INTO users (name, email) VALUES ('Device2User', 'device2@example.com');"
        ).await;
        
        let transferred_db1 = fixture.simulate_device_transfer(&device1_db, "device1_transferred");
        let transferred_db2 = fixture.simulate_device_transfer(&device2_db, "device2_transferred");
        
        // === Connect to first device's database using real connection manager ===
        let connectivity1 = fixture.verify_database_connectivity(&transferred_db1).await;
        assert!(connectivity1.is_ok(), "Should connect to first device database");
        
        // Query first database
        let device1_count = fixture.get_table_count(&transferred_db1, "test_table").await;
        assert!(device1_count.is_ok(), "Should query first database");
        assert_eq!(device1_count.unwrap(), 1, "First device should have 1 record");
        
        // === Switch to second device's database ===
        let connectivity2 = fixture.verify_database_connectivity(&transferred_db2).await;
        assert!(connectivity2.is_ok(), "Should connect to second device database");
        
        // Query second database (has different schema)
        let device2_count = fixture.get_table_count(&transferred_db2, "users").await;
        assert!(device2_count.is_ok(), "Should query second database");
        assert_eq!(device2_count.unwrap(), 1, "Second device should have 1 user");
        
        // === Verify rapid switching between devices works ===
        for round in 0..3 {
            // Switch back to device 1
            let d1_conn = fixture.get_connection(&transferred_db1).await;
            assert!(d1_conn.is_ok(), "Should reconnect to device 1 in round {}", round);
            
            // Switch to device 2
            let d2_conn = fixture.get_connection(&transferred_db2).await;
            assert!(d2_conn.is_ok(), "Should reconnect to device 2 in round {}", round);
        }
    }
    
    #[tokio::test]
    #[serial]
    async fn test_database_error_recovery() {
        let fixture = DeviceDatabaseTestFixture::new();
        
        // === Try to connect to non-existent database ===
        let bad_connection_result = fixture.verify_database_connectivity("/nonexistent/database.db").await;
        assert!(bad_connection_result.is_err(), "Should fail to connect to bad database");
        
        let bad_query_result = fixture.get_table_count("/nonexistent/database.db", "test_table").await;
        assert!(bad_query_result.is_err(), "Should fail to query non-existent database");
        
        // === Now connect to a valid database ===
        let good_db = fixture.create_test_database_with_schema("recovery_test",
            "CREATE TABLE test_table (
                id INTEGER PRIMARY KEY,
                data TEXT
            );
            INSERT INTO test_table (data) VALUES ('recovery_data');"
        ).await;
        
        let transferred_good_db = fixture.simulate_device_transfer(&good_db, "recovery_transferred");
        
        // === Verify recovery ===
        let recovery_result = fixture.verify_database_connectivity(&transferred_good_db).await;
        assert!(recovery_result.is_ok(), "Should connect after recovery");
        
        let recovery_count = fixture.get_table_count(&transferred_good_db, "test_table").await;
        assert!(recovery_count.is_ok(), "Should work after recovery");
        assert_eq!(recovery_count.unwrap(), 1, "Should have correct data after recovery");
        
        // === Test error recovery with corrupted database ===
        let corrupted_db = fixture.temp_manager.create_temp_file("corrupted", ".db").unwrap();
        std::fs::write(&corrupted_db, b"not a valid database").unwrap();
        
        let corrupted_path = corrupted_db.to_string_lossy().to_string();
        let corrupted_result = fixture.verify_database_connectivity(&corrupted_path).await;
        assert!(corrupted_result.is_err(), "Should detect corrupted database");
        
        // === Verify we can still use good databases after encountering corruption ===
        let final_verification = fixture.verify_database_connectivity(&transferred_good_db).await;
        assert!(final_verification.is_ok(), "Good database should still work after corruption encounter");
    }
    
    #[tokio::test]
    #[serial]
    async fn test_multi_device_workflow_simulation() {
        let fixture = DeviceDatabaseTestFixture::new();
        
        // === Simulate complete workflow: multiple devices with multiple databases each ===
        let mut all_transferred_databases = Vec::new();
        
        // Device 1: iOS device with multiple apps
        for app_id in 1..=2 {
            let ios_db = fixture.create_test_database_with_schema(
                &format!("ios_device_app_{}", app_id),
                &format!("CREATE TABLE app_{}_data (
                    id INTEGER PRIMARY KEY,
                    info TEXT
                );
                INSERT INTO app_{}_data (info) VALUES ('iOS app {} data');", app_id, app_id, app_id)
            ).await;
            
            let transferred = fixture.simulate_device_transfer(&ios_db, &format!("ios_app_{}_transferred", app_id));
            all_transferred_databases.push((format!("ios_app_{}", app_id), transferred, format!("app_{}_data", app_id)));
        }
        
        // Device 2: Android device with multiple apps  
        for app_id in 1..=2 {
            let android_db = fixture.create_test_database_with_schema(
                &format!("android_device_app_{}", app_id),
                &format!("CREATE TABLE android_app_{} (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT
                );
                INSERT INTO android_app_{} (name) VALUES ('Android app {} entry');", app_id, app_id, app_id)
            ).await;
            
            let transferred = fixture.simulate_device_transfer(&android_db, &format!("android_app_{}_transferred", app_id));
            all_transferred_databases.push((format!("android_app_{}", app_id), transferred, format!("android_app_{}", app_id)));
        }
        
        // === Test accessing all databases using real connection manager ===
        for (app_name, db_path, table_name) in &all_transferred_databases {
            let connectivity = fixture.verify_database_connectivity(db_path).await;
            assert!(connectivity.is_ok(), "Should connect to {} database", app_name);
            
            let record_count = fixture.get_table_count(db_path, table_name).await;
            assert!(record_count.is_ok(), "Should query {} database", app_name);
            assert_eq!(record_count.unwrap(), 1, "{} should have 1 record", app_name);
        }
        
        // === Test concurrent access to all databases ===
        let handles: Vec<_> = all_transferred_databases.into_iter().enumerate().map(|(i, (app_name, db_path, table_name))| {
            let connection_manager = DatabaseConnectionManager::new();
            tokio::spawn(async move {
                let pool = connection_manager.get_connection(&db_path).await.unwrap();
                let result = sqlx::query(&format!("SELECT COUNT(*) as count FROM {}", table_name))
                    .fetch_one(&pool)
                    .await;
                assert!(result.is_ok(), "Concurrent access to {} should work", app_name);
                
                let count: i64 = result.unwrap().try_get("count").unwrap();
                assert_eq!(count, 1, "{} should have 1 record in concurrent test", app_name);
                
                (i, app_name)
            })
        }).collect();
        
        // Wait for all concurrent operations
        for handle in handles {
            let result = handle.await.unwrap();
            println!("Completed concurrent access test for {}", result.1);
        }
    }
}
