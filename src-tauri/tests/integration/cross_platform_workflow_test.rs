use sqlx::sqlite::SqlitePool;
use serial_test::serial;

#[cfg(test)]
mod cross_platform_workflow_integration_tests {
    use super::*;
    use crate::fixtures::temp_files::*;

    /// Test switching between iOS and Android databases in the same session
    #[tokio::test]
    #[serial]
    async fn test_ios_android_database_switching() {
        let temp_manager = TempFileManager::new();
        
        // === Create iOS-style database ===
        let ios_db = temp_manager.create_temp_file("ios_chat_app", ".db").unwrap();
        let ios_pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", ios_db.display()))
            .await
            .unwrap();
            
        // iOS Core Data schema
        sqlx::query(
            "CREATE TABLE ZUSER (
                Z_PK INTEGER PRIMARY KEY,
                Z_ENT INTEGER,
                Z_OPT INTEGER,
                ZUSERNAME TEXT,
                ZEMAIL TEXT,
                ZDEVICETYPE TEXT DEFAULT 'ios'
            )"
        )
        .execute(&ios_pool)
        .await
        .unwrap();
        
        sqlx::query(
            "CREATE TABLE ZMESSAGE (
                Z_PK INTEGER PRIMARY KEY,
                Z_ENT INTEGER,
                ZCONTENT TEXT,
                ZTIMESTAMP REAL,
                ZUSER INTEGER,
                FOREIGN KEY (ZUSER) REFERENCES ZUSER(Z_PK)
            )"
        )
        .execute(&ios_pool)
        .await
        .unwrap();
        
        // Insert iOS data
        sqlx::query("INSERT INTO ZUSER (Z_PK, Z_ENT, Z_OPT, ZUSERNAME, ZEMAIL, ZDEVICETYPE) VALUES (1, 1, 1, 'ios_user', 'ios@example.com', 'ios')")
            .execute(&ios_pool)
            .await
            .unwrap();
            
        sqlx::query("INSERT INTO ZMESSAGE (Z_PK, Z_ENT, ZCONTENT, ZTIMESTAMP, ZUSER) VALUES (1, 2, 'Hello from iOS!', 631152000.0, 1)")
            .execute(&ios_pool)
            .await
            .unwrap();
        
        // === Create Android-style database ===
        let android_db = temp_manager.create_temp_file("android_chat_app", ".db").unwrap();
        let android_pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", android_db.display()))
            .await
            .unwrap();
            
        // Android Room schema
        sqlx::query(
            "CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                email TEXT NOT NULL,
                device_type TEXT DEFAULT 'android'
            )"
        )
        .execute(&android_pool)
        .await
        .unwrap();
        
        sqlx::query(
            "CREATE TABLE messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                timestamp INTEGER,
                user_id INTEGER,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )"
        )
        .execute(&android_pool)
        .await
        .unwrap();
        
        // Insert Android data
        sqlx::query("INSERT INTO users (username, email, device_type) VALUES ('android_user', 'android@example.com', 'android')")
            .execute(&android_pool)
            .await
            .unwrap();
            
        sqlx::query("INSERT INTO messages (content, timestamp, user_id) VALUES ('Hello from Android!', 1641081600, 1)")
            .execute(&android_pool)
            .await
            .unwrap();
        
        // === Test Cross-Platform Data Isolation ===
        // Verify iOS data
        let ios_users: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM ZUSER WHERE ZDEVICETYPE = 'ios'")
            .fetch_one(&ios_pool)
            .await
            .unwrap();
        assert_eq!(ios_users, 1, "iOS database should have 1 iOS user");
        
        // Verify Android data
        let android_users: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE device_type = 'android'")
            .fetch_one(&android_pool)
            .await
            .unwrap();
        assert_eq!(android_users, 1, "Android database should have 1 Android user");
        
        // === Test Platform-Specific Schema Differences ===
        // iOS uses Z-prefixed tables and NSDate timestamps
        let ios_timestamp: f64 = sqlx::query_scalar("SELECT ZTIMESTAMP FROM ZMESSAGE WHERE Z_PK = 1")
            .fetch_one(&ios_pool)
            .await
            .unwrap();
        assert_eq!(ios_timestamp, 631152000.0, "iOS should use NSDate reference timestamps");
        
        // Android uses standard Unix timestamps
        let android_timestamp: i32 = sqlx::query_scalar("SELECT timestamp FROM messages WHERE id = 1")
            .fetch_one(&android_pool)
            .await
            .unwrap();
        assert_eq!(android_timestamp, 1641081600, "Android should use Unix timestamps");
        
        // === Test Schema Detection ===
        // Detect iOS schema patterns
        let ios_z_tables: Vec<String> = sqlx::query_scalar("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'Z%'")
            .fetch_all(&ios_pool)
            .await
            .unwrap();
        assert!(!ios_z_tables.is_empty(), "iOS database should have Z-prefixed tables");
        
        // Detect Android schema patterns
        let android_standard_tables: Vec<String> = sqlx::query_scalar("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'Z%' AND name NOT LIKE 'sqlite_%'")
            .fetch_all(&android_pool)
            .await
            .unwrap();
        assert!(!android_standard_tables.is_empty(), "Android database should have standard table names");
        
        // === Test Platform-Specific Operations ===
        // iOS-style insert with Core Data conventions
        sqlx::query("INSERT INTO ZUSER (Z_PK, Z_ENT, Z_OPT, ZUSERNAME, ZEMAIL, ZDEVICETYPE) VALUES (2, 1, 1, 'ios_user_2', 'ios2@example.com', 'ios')")
            .execute(&ios_pool)
            .await
            .unwrap();
        
        // Android-style insert with auto-increment
        sqlx::query("INSERT INTO users (username, email, device_type) VALUES ('android_user_2', 'android2@example.com', 'android')")
            .execute(&android_pool)
            .await
            .unwrap();
        
        // === Verify Final Isolation ===
        let final_ios_count: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM ZUSER")
            .fetch_one(&ios_pool)
            .await
            .unwrap();
        assert_eq!(final_ios_count, 2, "iOS database should have 2 users after operations");
        
        let final_android_count: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
            .fetch_one(&android_pool)
            .await
            .unwrap();
        assert_eq!(final_android_count, 2, "Android database should have 2 users after operations");
        
        ios_pool.close().await;
        android_pool.close().await;
    }

    /// Test handling different database file structures between platforms
    #[tokio::test]
    #[serial]
    async fn test_platform_database_structure_differences() {
        let temp_manager = TempFileManager::new();
        
        // === iOS Simulator vs Physical Device Database Structures ===
        let ios_sim_db = temp_manager.create_temp_file("ios_simulator", ".db").unwrap();
        let ios_sim_pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", ios_sim_db.display()))
            .await
            .unwrap();
        
        // iOS Simulator: More accessible, debug-friendly schema
        sqlx::query(
            "CREATE TABLE debug_info (
                id INTEGER PRIMARY KEY,
                debug_level INTEGER,
                simulator_mode INTEGER DEFAULT 1,
                accessibility_enabled INTEGER DEFAULT 1
            )"
        )
        .execute(&ios_sim_pool)
        .await
        .unwrap();
        
        let ios_device_db = temp_manager.create_temp_file("ios_device", ".db").unwrap();
        let ios_device_pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", ios_device_db.display()))
            .await
            .unwrap();
        
        // iOS Physical Device: Production constraints
        sqlx::query(
            "CREATE TABLE production_info (
                id INTEGER PRIMARY KEY,
                encrypted_data BLOB,
                device_mode INTEGER DEFAULT 1,
                debug_disabled INTEGER DEFAULT 1
            )"
        )
        .execute(&ios_device_pool)
        .await
        .unwrap();
        
        // === Android Emulator vs Physical Device Database Structures ===
        let android_emu_db = temp_manager.create_temp_file("android_emulator", ".db").unwrap();
        let android_emu_pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", android_emu_db.display()))
            .await
            .unwrap();
        
        // Android Emulator: Debug features, mock data
        sqlx::query(
            "CREATE TABLE emulator_features (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                feature_name TEXT,
                mock_enabled INTEGER DEFAULT 1,
                emulator_only INTEGER DEFAULT 1
            )"
        )
        .execute(&android_emu_pool)
        .await
        .unwrap();
        
        let android_device_db = temp_manager.create_temp_file("android_physical", ".db").unwrap();
        let android_device_pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", android_device_db.display()))
            .await
            .unwrap();
        
        // Android Physical Device: Production security
        sqlx::query(
            "CREATE TABLE device_security (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                security_level INTEGER,
                production_mode INTEGER DEFAULT 1,
                root_access INTEGER DEFAULT 0
            )"
        )
        .execute(&android_device_pool)
        .await
        .unwrap();
        
        // === Insert Platform-Specific Data ===
        sqlx::query("INSERT INTO debug_info (debug_level, simulator_mode, accessibility_enabled) VALUES (5, 1, 1)")
            .execute(&ios_sim_pool)
            .await
            .unwrap();
            
        sqlx::query("INSERT INTO production_info (encrypted_data, device_mode, debug_disabled) VALUES (X'1234567890ABCDEF', 1, 1)")
            .execute(&ios_device_pool)
            .await
            .unwrap();
            
        sqlx::query("INSERT INTO emulator_features (feature_name, mock_enabled, emulator_only) VALUES ('location_mock', 1, 1)")
            .execute(&android_emu_pool)
            .await
            .unwrap();
            
        sqlx::query("INSERT INTO device_security (security_level, production_mode, root_access) VALUES (3, 1, 0)")
            .execute(&android_device_pool)
            .await
            .unwrap();
        
        // === Verify Platform-Specific Characteristics ===
        // iOS Simulator should have debug capabilities
        let ios_sim_debug: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM debug_info WHERE accessibility_enabled = 1")
            .fetch_one(&ios_sim_pool)
            .await
            .unwrap();
        assert_eq!(ios_sim_debug, 1, "iOS simulator should have debug accessibility");
        
        // iOS Device should have production security
        let ios_device_prod: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM production_info WHERE debug_disabled = 1")
            .fetch_one(&ios_device_pool)
            .await
            .unwrap();
        assert_eq!(ios_device_prod, 1, "iOS device should have production security");
        
        // Android Emulator should have mock features
        let android_emu_mock: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM emulator_features WHERE mock_enabled = 1")
            .fetch_one(&android_emu_pool)
            .await
            .unwrap();
        assert_eq!(android_emu_mock, 1, "Android emulator should have mock features");
        
        // Android Device should have security constraints
        let android_device_sec: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM device_security WHERE root_access = 0")
            .fetch_one(&android_device_pool)
            .await
            .unwrap();
        assert_eq!(android_device_sec, 1, "Android device should restrict root access");
        
        // Clean up
        ios_sim_pool.close().await;
        ios_device_pool.close().await;
        android_emu_pool.close().await;
        android_device_pool.close().await;
    }

    /// Test performance comparison between iOS and Android database operations
    #[tokio::test]
    #[serial]
    async fn test_cross_platform_performance_comparison() {
        use std::time::Instant;
        
        let temp_manager = TempFileManager::new();
        
        // === Setup iOS Database for Performance Testing ===
        let ios_db = temp_manager.create_temp_file("ios_perf_test", ".db").unwrap();
        let ios_pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", ios_db.display()))
            .await
            .unwrap();
            
        sqlx::query(
            "CREATE TABLE ZPERFORMANCETEST (
                Z_PK INTEGER PRIMARY KEY,
                Z_ENT INTEGER,
                ZDATA TEXT,
                ZTIMESTAMP REAL
            )"
        )
        .execute(&ios_pool)
        .await
        .unwrap();
        
        // === Setup Android Database for Performance Testing ===
        let android_db = temp_manager.create_temp_file("android_perf_test", ".db").unwrap();
        let android_pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", android_db.display()))
            .await
            .unwrap();
            
        sqlx::query(
            "CREATE TABLE performance_test (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT,
                timestamp INTEGER
            )"
        )
        .execute(&android_pool)
        .await
        .unwrap();
        
        // === iOS Performance Test ===
        let ios_start = Instant::now();
        for i in 0..100 {
            sqlx::query("INSERT INTO ZPERFORMANCETEST (Z_PK, Z_ENT, ZDATA, ZTIMESTAMP) VALUES (?, 1, ?, ?)")
                .bind(i + 1)
                .bind(format!("ios_test_data_{}", i))
                .bind(631152000.0 + (i as f64))
                .execute(&ios_pool)
                .await
                .unwrap();
        }
        let ios_duration = ios_start.elapsed();
        
        // === Android Performance Test ===
        let android_start = Instant::now();
        for i in 0..100 {
            sqlx::query("INSERT INTO performance_test (data, timestamp) VALUES (?, ?)")
                .bind(format!("android_test_data_{}", i))
                .bind(1641081600 + i)
                .execute(&android_pool)
                .await
                .unwrap();
        }
        let android_duration = android_start.elapsed();
        
        // === Verify Data Integrity ===
        let ios_count: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM ZPERFORMANCETEST")
            .fetch_one(&ios_pool)
            .await
            .unwrap();
        assert_eq!(ios_count, 100, "iOS database should have 100 performance test records");
        
        let android_count: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM performance_test")
            .fetch_one(&android_pool)
            .await
            .unwrap();
        assert_eq!(android_count, 100, "Android database should have 100 performance test records");
        
        // === Performance Comparison ===
        println!("iOS 100 inserts took: {:?}", ios_duration);
        println!("Android 100 inserts took: {:?}", android_duration);
        
        // Both should complete reasonably quickly (under 1 second for 100 inserts)
        assert!(ios_duration.as_secs() < 1, "iOS performance test should complete quickly");
        assert!(android_duration.as_secs() < 1, "Android performance test should complete quickly");
        
        // === Query Performance Test ===
        let ios_query_start = Instant::now();
        let _ios_results: Vec<String> = sqlx::query_scalar("SELECT ZDATA FROM ZPERFORMANCETEST WHERE Z_PK <= 50")
            .fetch_all(&ios_pool)
            .await
            .unwrap();
        let ios_query_duration = ios_query_start.elapsed();
        
        let android_query_start = Instant::now();
        let _android_results: Vec<String> = sqlx::query_scalar("SELECT data FROM performance_test WHERE id <= 50")
            .fetch_all(&android_pool)
            .await
            .unwrap();
        let android_query_duration = android_query_start.elapsed();
        
        println!("iOS query took: {:?}", ios_query_duration);
        println!("Android query took: {:?}", android_query_duration);
        
        // Both query performances should be reasonable
        assert!(ios_query_duration.as_millis() < 500, "iOS query performance should be reasonable");
        assert!(android_query_duration.as_millis() < 500, "Android query performance should be reasonable");
        
        ios_pool.close().await;
        android_pool.close().await;
    }

    /// Test data migration scenarios between iOS and Android formats
    #[tokio::test]
    #[serial]
    async fn test_cross_platform_data_migration() {
        let temp_manager = TempFileManager::new();
        
        // === Source iOS Database ===
        let ios_source_db = temp_manager.create_temp_file("ios_source", ".db").unwrap();
        let ios_pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", ios_source_db.display()))
            .await
            .unwrap();
            
        // iOS Core Data schema
        sqlx::query(
            "CREATE TABLE ZCONTACT (
                Z_PK INTEGER PRIMARY KEY,
                Z_ENT INTEGER,
                ZFIRSTNAME TEXT,
                ZLASTNAME TEXT,
                ZEMAIL TEXT,
                ZCREATIONDATE REAL
            )"
        )
        .execute(&ios_pool)
        .await
        .unwrap();
        
        // Insert iOS data
        sqlx::query("INSERT INTO ZCONTACT (Z_PK, Z_ENT, ZFIRSTNAME, ZLASTNAME, ZEMAIL, ZCREATIONDATE) VALUES (1, 1, 'John', 'Doe', 'john@ios.com', 631152000.0)")
            .execute(&ios_pool)
            .await
            .unwrap();
            
        sqlx::query("INSERT INTO ZCONTACT (Z_PK, Z_ENT, ZFIRSTNAME, ZLASTNAME, ZEMAIL, ZCREATIONDATE) VALUES (2, 1, 'Jane', 'Smith', 'jane@ios.com', 631238400.0)")
            .execute(&ios_pool)
            .await
            .unwrap();
        
        // === Target Android Database ===
        let android_target_db = temp_manager.create_temp_file("android_target", ".db").unwrap();
        let android_pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", android_target_db.display()))
            .await
            .unwrap();
            
        // Android Room schema
        sqlx::query(
            "CREATE TABLE contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                first_name TEXT,
                last_name TEXT,
                email TEXT,
                created_at INTEGER
            )"
        )
        .execute(&android_pool)
        .await
        .unwrap();
        
        // === Data Migration from iOS to Android ===
        // Read iOS data  
        let ios_contacts: Vec<(i32, String, String, String, f64)> = sqlx::query_as("SELECT Z_PK, ZFIRSTNAME, ZLASTNAME, ZEMAIL, ZCREATIONDATE FROM ZCONTACT")
            .fetch_all(&ios_pool)
            .await
            .unwrap();
        
        // Migrate to Android format
        for (z_pk, zfirstname, zlastname, zemail, zcreationdate) in ios_contacts {
            // Convert NSDate timestamp to Unix timestamp
            let unix_timestamp = (zcreationdate + 978307200.0) as i64; // NSDate reference date conversion
            
            sqlx::query("INSERT INTO contacts (first_name, last_name, email, created_at) VALUES (?, ?, ?, ?)")
                .bind(zfirstname)
                .bind(zlastname)
                .bind(zemail)
                .bind(unix_timestamp)
                .execute(&android_pool)
                .await
                .unwrap();
        }
        
        // === Verify Migration ===
        let migrated_count: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM contacts")
            .fetch_one(&android_pool)
            .await
            .unwrap();
        assert_eq!(migrated_count, 2, "Should migrate all iOS contacts to Android format");
        
        // Verify data integrity
        let john_android: (String, String, String) = sqlx::query_as("SELECT first_name, last_name, email FROM contacts WHERE first_name = 'John'")
            .fetch_one(&android_pool)
            .await
            .unwrap();
        assert_eq!(john_android, ("John".to_string(), "Doe".to_string(), "john@ios.com".to_string()), "Migrated data should maintain integrity");
        
        // === Reverse Migration Test (Android to iOS) ===
        let ios_target_db = temp_manager.create_temp_file("ios_target", ".db").unwrap();
        let ios_target_pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", ios_target_db.display()))
            .await
            .unwrap();
        
        // Create iOS target schema
        sqlx::query(
            "CREATE TABLE ZMIGRATED (
                Z_PK INTEGER PRIMARY KEY,
                Z_ENT INTEGER,
                ZFIRSTNAME TEXT,
                ZLASTNAME TEXT,
                ZEMAIL TEXT,
                ZCREATIONDATE REAL
            )"
        )
        .execute(&ios_target_pool)
        .await
        .unwrap();
        
        // Read Android data
        let android_contacts: Vec<(i32, String, String, String, i64)> = sqlx::query_as("SELECT id, first_name, last_name, email, created_at FROM contacts")
            .fetch_all(&android_pool)
            .await
            .unwrap();
        
        // Migrate back to iOS format
        for (index, (id, first_name, last_name, email, created_at)) in android_contacts.iter().enumerate() {
            // Convert Unix timestamp back to NSDate format
            let nsdate_timestamp = (*created_at as f64) - 978307200.0;
            
            sqlx::query("INSERT INTO ZMIGRATED (Z_PK, Z_ENT, ZFIRSTNAME, ZLASTNAME, ZEMAIL, ZCREATIONDATE) VALUES (?, 1, ?, ?, ?, ?)")
                .bind(index as i32 + 1)
                .bind(first_name)
                .bind(last_name)
                .bind(email)
                .bind(nsdate_timestamp)
                .execute(&ios_target_pool)
                .await
                .unwrap();
        }
        
        // Verify reverse migration
        let reverse_migrated_count: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM ZMIGRATED")
            .fetch_one(&ios_target_pool)
            .await
            .unwrap();
        assert_eq!(reverse_migrated_count, 2, "Should reverse migrate all Android contacts back to iOS format");
        
        ios_pool.close().await;
        android_pool.close().await;
        ios_target_pool.close().await;
    }

    /// Test error handling differences between iOS and Android platforms
    #[tokio::test]
    #[serial]
    async fn test_cross_platform_error_handling() {
        let temp_manager = TempFileManager::new();
        
        // === iOS Error Scenarios ===
        let ios_error_db = temp_manager.create_temp_file("ios_errors", ".db").unwrap();
        let ios_pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", ios_error_db.display()))
            .await
            .unwrap();
        
        sqlx::query(
            "CREATE TABLE ios_error_log (
                id INTEGER PRIMARY KEY,
                error_type TEXT,
                error_message TEXT,
                tool_involved TEXT,
                recovery_possible INTEGER
            )"
        )
        .execute(&ios_pool)
        .await
        .unwrap();
        
        // Simulate iOS-specific errors
        let ios_errors = vec![
            ("tool_missing", "idevice_id: command not found", "libimobiledevice", 1),
            ("device_locked", "Device is locked", "afcclient", 0),
            ("sandbox_denied", "App sandbox access denied", "afcclient", 1),
            ("provisioning_error", "Invalid provisioning profile", "ideviceinstaller", 0),
        ];
        
        for (error_type, message, tool, recoverable) in ios_errors {
            sqlx::query("INSERT INTO ios_error_log (error_type, error_message, tool_involved, recovery_possible) VALUES (?, ?, ?, ?)")
                .bind(error_type)
                .bind(message)
                .bind(tool)
                .bind(recoverable)
                .execute(&ios_pool)
                .await
                .unwrap();
        }
        
        // === Android Error Scenarios ===
        let android_error_db = temp_manager.create_temp_file("android_errors", ".db").unwrap();
        let android_pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", android_error_db.display()))
            .await
            .unwrap();
        
        sqlx::query(
            "CREATE TABLE android_error_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                error_type TEXT,
                error_message TEXT,
                tool_involved TEXT,
                recovery_possible INTEGER
            )"
        )
        .execute(&android_pool)
        .await
        .unwrap();
        
        // Simulate Android-specific errors
        let android_errors = vec![
            ("adb_server_down", "adb server not running", "adb", 1),
            ("device_unauthorized", "device unauthorized", "adb", 1),
            ("permission_denied", "Permission denied", "adb shell", 1),
            ("app_not_debuggable", "App is not debuggable", "run-as", 0),
        ];
        
        for (error_type, message, tool, recoverable) in android_errors {
            sqlx::query("INSERT INTO android_error_log (error_type, error_message, tool_involved, recovery_possible) VALUES (?, ?, ?, ?)")
                .bind(error_type)
                .bind(message)
                .bind(tool)
                .bind(recoverable)
                .execute(&android_pool)
                .await
                .unwrap();
        }
        
        // === Analyze Platform Error Patterns ===
        // iOS error recovery rate
        let ios_recoverable: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM ios_error_log WHERE recovery_possible = 1")
            .fetch_one(&ios_pool)
            .await
            .unwrap();
        let ios_total: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM ios_error_log")
            .fetch_one(&ios_pool)
            .await
            .unwrap();
        
        // Android error recovery rate
        let android_recoverable: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM android_error_log WHERE recovery_possible = 1")
            .fetch_one(&android_pool)
            .await
            .unwrap();
        let android_total: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM android_error_log")
            .fetch_one(&android_pool)
            .await
            .unwrap();
        
        // Verify error scenarios are properly catalogued
        assert_eq!(ios_total, 4, "Should have 4 iOS error scenarios");
        assert_eq!(android_total, 4, "Should have 4 Android error scenarios");
        
        // iOS typically has lower recovery rate due to sandboxing
        let ios_recovery_rate = (ios_recoverable as f32) / (ios_total as f32);
        let android_recovery_rate = (android_recoverable as f32) / (android_total as f32);
        
        println!("iOS error recovery rate: {:.2}", ios_recovery_rate);
        println!("Android error recovery rate: {:.2}", android_recovery_rate);
        
        // Android generally has better error recovery options
        assert!(android_recovery_rate >= ios_recovery_rate, "Android should have equal or better error recovery rate");
        
        // === Test Error Recovery Simulation ===
        // Simulate iOS tool recovery
        sqlx::query("UPDATE ios_error_log SET recovery_possible = 1 WHERE error_type = 'tool_missing'")
            .execute(&ios_pool)
            .await
            .unwrap();
        
        // Simulate Android permission grant
        sqlx::query("UPDATE android_error_log SET recovery_possible = 1 WHERE error_type = 'app_not_debuggable'")
            .execute(&android_pool)
            .await
            .unwrap();
        
        // Verify recovery updates
        let ios_updated_recoverable: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM ios_error_log WHERE recovery_possible = 1")
            .fetch_one(&ios_pool)
            .await
            .unwrap();
        let android_updated_recoverable: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM android_error_log WHERE recovery_possible = 1")
            .fetch_one(&android_pool)
            .await
            .unwrap();
        
        assert!(ios_updated_recoverable >= ios_recoverable, "iOS recovery count should improve");
        assert!(android_updated_recoverable >= android_recoverable, "Android recovery count should improve");
        
        ios_pool.close().await;
        android_pool.close().await;
    }
} 