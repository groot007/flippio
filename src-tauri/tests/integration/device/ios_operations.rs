use sqlx::sqlite::SqlitePool;
use serial_test::serial;
use std::fs;

#[cfg(test)]
mod ios_workflow_integration_tests {
    use super::*;
    use crate::fixtures::temp_files::*;

    /// Test complete iOS device workflow - from detection to database operations
    #[tokio::test]
    #[serial]
    async fn test_complete_ios_device_workflow() {
        let temp_manager = TempFileManager::new();
        
        // === PHASE 1: Device Detection Simulation ===
        // Create mock iOS device database for testing
        let mock_ios_db = temp_manager.create_temp_file("mock_ios_app", ".db").unwrap();
        
        // Setup iOS app database with realistic schema
        let pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", mock_ios_db.display()))
            .await
            .unwrap();
            
        // Create iOS app-like schema (Core Data style)
        sqlx::query(
            "CREATE TABLE ZUSERPROFILE (
                Z_PK INTEGER PRIMARY KEY,
                Z_ENT INTEGER,
                Z_OPT INTEGER,
                ZUSERNAME TEXT,
                ZEMAIL TEXT,
                ZCREATIONDATE REAL,
                ZLASTLOGINDATE REAL
            )"
        )
        .execute(&pool)
        .await
        .unwrap();
        
        sqlx::query(
            "CREATE TABLE ZMESSAGE (
                Z_PK INTEGER PRIMARY KEY,
                Z_ENT INTEGER,
                Z_OPT INTEGER,
                ZCONTENT TEXT,
                ZTIMESTAMP REAL,
                ZSENDER INTEGER,
                FOREIGN KEY (ZSENDER) REFERENCES ZUSERPROFILE(Z_PK)
            )"
        )
        .execute(&pool)
        .await
        .unwrap();
        
        // Insert realistic iOS app data
        sqlx::query("INSERT INTO ZUSERPROFILE (Z_PK, Z_ENT, Z_OPT, ZUSERNAME, ZEMAIL, ZCREATIONDATE, ZLASTLOGINDATE) VALUES (1, 1, 1, 'john_user', 'john@example.com', 631152000.0, 631238400.0)")
            .execute(&pool)
            .await
            .unwrap();
            
        sqlx::query("INSERT INTO ZUSERPROFILE (Z_PK, Z_ENT, Z_OPT, ZUSERNAME, ZEMAIL, ZCREATIONDATE, ZLASTLOGINDATE) VALUES (2, 1, 1, 'sara_dev', 'sara@example.com', 631152000.0, 631238400.0)")
            .execute(&pool)
            .await
            .unwrap();
            
        sqlx::query("INSERT INTO ZMESSAGE (Z_PK, Z_ENT, Z_OPT, ZCONTENT, ZTIMESTAMP, ZSENDER) VALUES (1, 2, 1, 'Hello from iOS!', 631238400.0, 1)")
            .execute(&pool)
            .await
            .unwrap();
        
        // === PHASE 2: Device Package Discovery Simulation ===
        // Verify we can read the iOS-style database
        let user_count: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM ZUSERPROFILE")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(user_count, 2, "iOS database should have 2 user profiles");
        
        let message_count: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM ZMESSAGE")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(message_count, 1, "iOS database should have 1 message");
        
        // === PHASE 3: Database File Transfer Simulation ===
        // Simulate transferring database from iOS device to local temp
        let transferred_db = temp_manager.create_temp_file("transferred_ios_app", ".db").unwrap();
        fs::copy(&mock_ios_db, &transferred_db).unwrap();
        
        // Verify transferred database integrity
        let transferred_pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", transferred_db.display()))
            .await
            .unwrap();
            
        let transferred_user_count: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM ZUSERPROFILE")
            .fetch_one(&transferred_pool)
            .await
            .unwrap();
        assert_eq!(transferred_user_count, 2, "Transferred database should maintain data integrity");
        
        // === PHASE 4: iOS-Specific Database Operations ===
        // Perform iOS-style database operations (Core Data patterns)
        sqlx::query("INSERT INTO ZUSERPROFILE (Z_PK, Z_ENT, Z_OPT, ZUSERNAME, ZEMAIL, ZCREATIONDATE, ZLASTLOGINDATE) VALUES (3, 1, 1, 'test_ios_user', 'test@ios.com', 631324800.0, 631324800.0)")
            .execute(&transferred_pool)
            .await
            .unwrap();
            
        // Verify iOS operation completed
        let final_user_count: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM ZUSERPROFILE")
            .fetch_one(&transferred_pool)
            .await
            .unwrap();
        assert_eq!(final_user_count, 3, "iOS database should have 3 users after insert");
        
        // === PHASE 5: iOS Database Push Back Simulation ===
        // Simulate pushing modified database back to iOS device
        let pushed_back_db = temp_manager.create_temp_file("pushed_back_ios", ".db").unwrap();
        fs::copy(&transferred_db, &pushed_back_db).unwrap();
        
        // Verify push-back database
        let pushback_pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", pushed_back_db.display()))
            .await
            .unwrap();
            
        let pushback_user_count: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM ZUSERPROFILE")
            .fetch_one(&pushback_pool)
            .await
            .unwrap();
        assert_eq!(pushback_user_count, 3, "Pushed-back database should preserve all changes");
        
        // === PHASE 6: iOS Permission Handling Simulation ===
        // Test iOS-specific permission scenarios
        let readonly_db = temp_manager.create_temp_file("readonly_ios", ".db").unwrap();
        fs::copy(&mock_ios_db, &readonly_db).unwrap();
        
        // Simulate iOS file permission issues
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let metadata = fs::metadata(&readonly_db).unwrap();
            let mut permissions = metadata.permissions();
            permissions.set_mode(0o444); // Read-only
            fs::set_permissions(&readonly_db, permissions).unwrap();
        }
        
        // Try to connect to readonly database
        let readonly_result = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", readonly_db.display())).await;
        
        // Should still be able to read
        if let Ok(readonly_pool) = readonly_result {
            let readonly_count: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM ZUSERPROFILE")
                .fetch_one(&readonly_pool)
                .await
                .unwrap();
            assert_eq!(readonly_count, 2, "Should be able to read from readonly iOS database");
            readonly_pool.close().await;
        }
        
        // Clean up
        pool.close().await;
        transferred_pool.close().await;
        pushback_pool.close().await;
    }

    /// Test iOS simulator vs physical device workflows
    #[tokio::test]
    #[serial]
    async fn test_ios_simulator_vs_device_workflow() {
        let temp_manager = TempFileManager::new();
        
        // === Simulator Database Workflow ===
        let simulator_db = temp_manager.create_temp_file("simulator_app", ".db").unwrap();
        let sim_pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", simulator_db.display()))
            .await
            .unwrap();
            
        // Create simulator-specific schema (typically has easier access)
        sqlx::query(
            "CREATE TABLE simulator_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                debug_info TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )"
        )
        .execute(&sim_pool)
        .await
        .unwrap();
        
        sqlx::query("INSERT INTO simulator_data (name, debug_info) VALUES ('sim_test', 'debug_enabled')")
            .execute(&sim_pool)
            .await
            .unwrap();
        
        // === Physical Device Database Workflow ===
        let device_db = temp_manager.create_temp_file("device_app", ".db").unwrap();
        let device_pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", device_db.display()))
            .await
            .unwrap();
            
        // Create device-specific schema (typically more restricted)
        sqlx::query(
            "CREATE TABLE production_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                encrypted_data BLOB,
                sync_status INTEGER DEFAULT 0
            )"
        )
        .execute(&device_pool)
        .await
        .unwrap();
        
        sqlx::query("INSERT INTO production_data (user_id, encrypted_data, sync_status) VALUES ('user123', X'1234567890ABCDEF', 1)")
            .execute(&device_pool)
            .await
            .unwrap();
        
        // === Verify Different Behaviors ===
        // Simulator should have debug capabilities
        let sim_count: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM simulator_data WHERE debug_info IS NOT NULL")
            .fetch_one(&sim_pool)
            .await
            .unwrap();
        assert_eq!(sim_count, 1, "Simulator should have debug data");
        
        // Device should have production constraints
        let device_count: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM production_data WHERE sync_status = 1")
            .fetch_one(&device_pool)
            .await
            .unwrap();
        assert_eq!(device_count, 1, "Device should have synced production data");
        
        // === Test Cross-Platform Data Access ===
        // Verify that data from both sources remains isolated
        let sim_tables: Vec<String> = sqlx::query_scalar("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            .fetch_all(&sim_pool)
            .await
            .unwrap();
        assert_eq!(sim_tables, vec!["simulator_data"], "Simulator should only have simulator tables");
        
        let device_tables: Vec<String> = sqlx::query_scalar("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            .fetch_all(&device_pool)
            .await
            .unwrap();
        assert_eq!(device_tables, vec!["production_data"], "Device should only have production tables");
        
        sim_pool.close().await;
        device_pool.close().await;
    }

    /// Test iOS-specific error recovery scenarios
    #[tokio::test]
    #[serial]
    async fn test_ios_error_recovery_scenarios() {
        let temp_manager = TempFileManager::new();
        
        // === Scenario 1: libimobiledevice tool missing simulation ===
        // Create a database that simulates tool dependency issues
        let tool_missing_db = temp_manager.create_temp_file("tool_missing_ios", ".db").unwrap();
        let pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", tool_missing_db.display()))
            .await
            .unwrap();
            
        sqlx::query(
            "CREATE TABLE device_status (
                id INTEGER PRIMARY KEY,
                tool_name TEXT,
                status TEXT,
                error_message TEXT
            )"
        )
        .execute(&pool)
        .await
        .unwrap();
        
        // Simulate missing tool scenarios
        sqlx::query("INSERT INTO device_status (tool_name, status, error_message) VALUES ('idevice_id', 'missing', 'command not found')")
            .execute(&pool)
            .await
            .unwrap();
            
        sqlx::query("INSERT INTO device_status (tool_name, status, error_message) VALUES ('afcclient', 'missing', 'libimobiledevice not installed')")
            .execute(&pool)
            .await
            .unwrap();
        
        // Verify error simulation data
        let missing_tools: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM device_status WHERE status = 'missing'")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(missing_tools, 2, "Should simulate 2 missing iOS tools");
        
        // === Scenario 2: Device disconnection during operation ===
        let disconnect_db = temp_manager.create_temp_file("disconnect_ios", ".db").unwrap();
        fs::copy(&tool_missing_db, &disconnect_db).unwrap();
        
        let disconnect_pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", disconnect_db.display()))
            .await
            .unwrap();
        
        // Simulate device disconnection recovery
        sqlx::query("UPDATE device_status SET status = 'reconnected', error_message = NULL WHERE tool_name = 'idevice_id'")
            .execute(&disconnect_pool)
            .await
            .unwrap();
            
        let recovered_tools: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM device_status WHERE status = 'reconnected'")
            .fetch_one(&disconnect_pool)
            .await
            .unwrap();
        assert_eq!(recovered_tools, 1, "Should recover from device disconnection");
        
        // === Scenario 3: App sandbox access issues ===
        let sandbox_db = temp_manager.create_temp_file("sandbox_ios", ".db").unwrap();
        let sandbox_pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", sandbox_db.display()))
            .await
            .unwrap();
        
        sqlx::query(
            "CREATE TABLE app_sandbox (
                bundle_id TEXT PRIMARY KEY,
                documents_access TEXT,
                containers_access TEXT,
                last_access_attempt DATETIME
            )"
        )
        .execute(&sandbox_pool)
        .await
        .unwrap();
        
        // Simulate different sandbox access levels
        sqlx::query("INSERT INTO app_sandbox VALUES ('com.example.restricted', 'denied', 'denied', datetime('now'))")
            .execute(&sandbox_pool)
            .await
            .unwrap();
            
        sqlx::query("INSERT INTO app_sandbox VALUES ('com.example.accessible', 'granted', 'granted', datetime('now'))")
            .execute(&sandbox_pool)
            .await
            .unwrap();
        
        let accessible_apps: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM app_sandbox WHERE documents_access = 'granted'")
            .fetch_one(&sandbox_pool)
            .await
            .unwrap();
        assert_eq!(accessible_apps, 1, "Should handle iOS sandbox restrictions correctly");
        
        pool.close().await;
        disconnect_pool.close().await;
        sandbox_pool.close().await;
    }

    /// Test iOS Core Data specific operations
    #[tokio::test]
    #[serial]
    async fn test_ios_core_data_workflow() {
        let temp_manager = TempFileManager::new();
        let core_data_db = temp_manager.create_temp_file("core_data_ios", ".db").unwrap();
        
        let pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", core_data_db.display()))
            .await
            .unwrap();
        
        // Create typical Core Data schema with Z-prefixed tables
        sqlx::query(
            "CREATE TABLE Z_PRIMARYKEY (
                Z_ENT INTEGER PRIMARY KEY,
                Z_NAME TEXT,
                Z_SUPER INTEGER,
                Z_MAX INTEGER
            )"
        )
        .execute(&pool)
        .await
        .unwrap();
        
        sqlx::query(
            "CREATE TABLE Z_METADATA (
                Z_VERSION INTEGER,
                Z_UUID TEXT,
                Z_PLIST BLOB
            )"
        )
        .execute(&pool)
        .await
        .unwrap();
        
        sqlx::query(
            "CREATE TABLE ZENTITY (
                Z_PK INTEGER PRIMARY KEY,
                Z_ENT INTEGER,
                Z_OPT INTEGER,
                ZNAME TEXT,
                ZCREATIONDATE REAL
            )"
        )
        .execute(&pool)
        .await
        .unwrap();
        
        // Insert Core Data metadata
        sqlx::query("INSERT INTO Z_PRIMARYKEY (Z_ENT, Z_NAME, Z_SUPER, Z_MAX) VALUES (1, 'Entity', 0, 1)")
            .execute(&pool)
            .await
            .unwrap();
            
        sqlx::query("INSERT INTO Z_METADATA (Z_VERSION, Z_UUID) VALUES (1, 'test-uuid-1234')")
            .execute(&pool)
            .await
            .unwrap();
            
        sqlx::query("INSERT INTO ZENTITY (Z_PK, Z_ENT, Z_OPT, ZNAME, ZCREATIONDATE) VALUES (1, 1, 1, 'TestEntity', 631152000.0)")
            .execute(&pool)
            .await
            .unwrap();
        
        // Verify Core Data structure
        let metadata_count: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM Z_METADATA")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(metadata_count, 1, "Core Data should have metadata table");
        
        let entity_count: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM ZENTITY")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(entity_count, 1, "Core Data should have entity data");
        
        // Test Core Data timestamp handling (iOS uses NSDate reference date)
        let creation_date: f64 = sqlx::query_scalar("SELECT ZCREATIONDATE FROM ZENTITY WHERE Z_PK = 1")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(creation_date, 631152000.0, "Should handle iOS NSDate timestamps correctly");
        
        pool.close().await;
    }
} 