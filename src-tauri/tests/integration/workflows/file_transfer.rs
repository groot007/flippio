use std::path::PathBuf;
use std::fs;
use sqlx::{SqlitePool, Row};

// Import the actual database connection manager for database verification
use flippio::DatabaseConnectionManager;

#[cfg(test)]
mod file_transfer_integration_tests {
    use super::*;
    use crate::fixtures::{temp_files::*, mock_devices::*};
    
    /// Test fixture for file transfer workflows with real database verification
    struct FileTransferTestFixture {
        pub connection_manager: DatabaseConnectionManager,
        temp_manager: TempFileManager,
    }

    impl FileTransferTestFixture {
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

        async fn verify_database_validity(&self, db_path: &str) -> Result<bool, String> {
            // Use real connection manager to verify database
            let connection_result = self.connection_manager.get_connection(db_path).await;
            match connection_result {
                Ok(pool) => {
                    // Try a basic query to verify the database is accessible
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
            let pool = self.connection_manager.get_connection(db_path).await?;
            
            let query = format!("SELECT COUNT(*) as count FROM {}", table_name);
            let row = sqlx::query(&query)
                .fetch_one(&pool)
                .await
                .map_err(|e| format!("Database query error: {}", e))?;

            let count: i64 = row.try_get("count")
                .map_err(|e| format!("Failed to get count: {}", e))?;
            
            Ok(count)
        }

        fn create_temp_file(&self, prefix: &str, extension: &str) -> PathBuf {
            self.temp_manager.create_temp_file(prefix, extension).unwrap()
        }
    }
    
    #[tokio::test]
    async fn test_ios_to_local_transfer_workflow() {
        let fixture = FileTransferTestFixture::new();
        
        // Simulate complete iOS file transfer workflow
        let ios_devices = create_mock_ios_devices();
        let ios_databases = create_mock_ios_databases();
        
        for device in ios_devices.iter().take(1) { // Test one device
            let device_databases: Vec<_> = ios_databases.iter()
                .filter(|db| db.device_udid == device.udid)
                .collect();
                
            for _database in device_databases.iter().take(1) { // Test one database
                // === Step 1: Create temporary local destination ===
                let local_path = fixture.create_temp_file("ios_transfer", ".db");
                
                // === Step 2: Simulate afcclient transfer ===
                // In real scenario: afcclient -u {udid} cp {remote_path} {local_path}
                let source_db = fixture.create_test_database_with_schema("ios_source",
                    "CREATE TABLE test_table (
                        id INTEGER PRIMARY KEY,
                        data TEXT
                    );
                    INSERT INTO test_table (data) VALUES ('ios_test_data');"
                ).await;
                
                fs::copy(&source_db, &local_path).unwrap();
                
                // === Step 3: Verify transfer success ===
                assert!(local_path.exists(), "Transferred file should exist");
                
                let metadata = fs::metadata(&local_path).unwrap();
                assert!(metadata.len() > 0, "Transferred file should have content");
                
                // === Step 4: Verify file integrity ===
                let content = fs::read(&local_path).unwrap();
                assert!(content.len() > 0, "File should contain data");
                
                // === Step 5: Verify it's a valid SQLite database using real connection manager ===
                let db_path_str = local_path.to_string_lossy().to_string();
                let is_valid = fixture.verify_database_validity(&db_path_str).await;
                assert!(is_valid.is_ok(), "Transferred file should be valid SQLite database: {:?}", is_valid);
                
                // === Step 6: Verify data integrity using real database operations ===
                let record_count = fixture.get_table_count(&db_path_str, "test_table").await;
                assert!(record_count.is_ok(), "Should query transferred database");
                assert_eq!(record_count.unwrap(), 1, "Should have 1 record in transferred database");
            }
        }
    }
    
    #[tokio::test]
    async fn test_android_to_local_transfer_workflow() {
        let fixture = FileTransferTestFixture::new();
        
        // Simulate complete Android file transfer workflow
        let android_devices = create_mock_adb_devices();
        let android_databases = create_mock_android_databases();
        
        for device in android_devices.iter().take(1) { // Test one device
            let device_databases: Vec<_> = android_databases.iter()
                .filter(|db| db.device_id == device.id)
                .collect();
                
            for _database in device_databases.iter().take(1) { // Test one database
                // === Step 1: Create temporary local destination ===
                let local_path = fixture.create_temp_file("android_transfer", ".db");
                
                // === Step 2: Simulate adb pull ===
                // In real scenario: adb -s {device_id} pull {remote_path} {local_path}
                let source_db = fixture.create_test_database_with_schema("android_source",
                    "CREATE TABLE users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        email TEXT NOT NULL
                    );
                    INSERT INTO users (name, email) VALUES ('AndroidUser', 'android@example.com');"
                ).await;
                
                fs::copy(&source_db, &local_path).unwrap();
                
                // === Step 3: Verify transfer success ===
                assert!(local_path.exists(), "Transferred file should exist");
                
                // === Step 4: Verify content ===
                let metadata = fs::metadata(&local_path).unwrap();
                assert!(metadata.len() > 0, "File should have content");
                
                // === Step 5: Test database connection using real connection manager ===
                let db_path_str = local_path.to_string_lossy().to_string();
                let is_valid = fixture.verify_database_validity(&db_path_str).await;
                assert!(is_valid.is_ok(), "Should connect to transferred Android database: {:?}", is_valid);
                
                // === Step 6: Verify Android database content ===
                let user_count = fixture.get_table_count(&db_path_str, "users").await;
                assert!(user_count.is_ok(), "Should query users table");
                assert_eq!(user_count.unwrap(), 1, "Should have 1 user in Android database");
            }
        }
    }
    
    #[tokio::test]
    async fn test_transfer_error_handling() {
        let fixture = FileTransferTestFixture::new();
        
        // === Test 1: Source file doesn't exist ===
        let nonexistent_source = PathBuf::from("/nonexistent/file.db");
        let dest1 = fixture.create_temp_file("error_test1", ".db");
        
        let copy_result = fs::copy(&nonexistent_source, &dest1);
        assert!(copy_result.is_err(), "Should fail to copy nonexistent file");
        
        // === Test 2: Invalid destination directory ===
        let source_db = fixture.create_test_database_with_schema("valid_source",
            "CREATE TABLE test (id INTEGER PRIMARY KEY);"
        ).await;
        let invalid_dest = PathBuf::from("/invalid/directory/file.db");
        
        let copy_result2 = fs::copy(&source_db, &invalid_dest);
        assert!(copy_result2.is_err(), "Should fail to copy to invalid destination");
        
        // === Test 3: Corrupted source file ===
        let corrupted_source = fixture.create_temp_file("corrupted", ".db");
        fs::write(&corrupted_source, b"not a database").unwrap();
        
        let dest3 = fixture.create_temp_file("error_test3", ".db");
        let copy_result3 = fs::copy(&corrupted_source, &dest3);
        assert!(copy_result3.is_ok(), "File copy should succeed even if content is invalid");
        
        // === Test 4: Verify corruption is detected by real connection manager ===
        let db_path_str = dest3.to_string_lossy().to_string();
        let validity_result = fixture.verify_database_validity(&db_path_str).await;
        assert!(validity_result.is_err(), "Connection manager should detect corrupted database");
    }
    
    #[tokio::test]
    async fn test_large_file_transfer_simulation() {
        let fixture = FileTransferTestFixture::new();
        
        // === Create a "large" database with substantial content ===
        let mut schema_sql = String::from(
            "CREATE TABLE large_table (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT
            );"
        );
        
        // Add many insert statements to simulate a large database
        for i in 0..100 {
            schema_sql.push_str(&format!(
                "INSERT INTO large_table (data) VALUES ('Large data entry number {}');", i
            ));
        }
        
        let large_db = fixture.create_test_database_with_schema("large_db", &schema_sql).await;
        
        // === Transfer to destination ===
        let dest = fixture.create_temp_file("large_transfer", ".db");
        let copy_result = fs::copy(&large_db, &dest);
        
        assert!(copy_result.is_ok(), "Should handle large file transfer");
        
        // === Verify size ===
        let source_size = fs::metadata(&large_db).unwrap().len();
        let dest_size = fs::metadata(&dest).unwrap().len();
        assert_eq!(source_size, dest_size, "Transferred file should be same size");
        
        // === Verify content using real connection manager ===
        let dest_path = dest.to_string_lossy().to_string();
        let is_valid = fixture.verify_database_validity(&dest_path).await;
        assert!(is_valid.is_ok(), "Large transferred database should be valid");
        
        let record_count = fixture.get_table_count(&dest_path, "large_table").await;
        assert!(record_count.is_ok(), "Should query large database");
        assert_eq!(record_count.unwrap(), 100, "Should have 100 records in large database");
    }
    
    #[tokio::test]
    async fn test_concurrent_transfers() {
        let fixture = FileTransferTestFixture::new();
        let num_transfers = 5;
        
        // === Create source databases ===
        let mut source_data = Vec::new();
        for i in 0..num_transfers {
            let source_db = fixture.create_test_database_with_schema(
                &format!("concurrent_source_{}", i),
                &format!("CREATE TABLE test_table (
                    id INTEGER PRIMARY KEY,
                    data TEXT
                );
                INSERT INTO test_table (data) VALUES ('concurrent_data_{}');", i)
            ).await;
            source_data.push((i, source_db));
        }
        
        // === Perform concurrent transfers ===
        let handles: Vec<_> = source_data.iter().map(|(i, source)| {
            let i = *i;
            let source = source.clone();
            let connection_manager = DatabaseConnectionManager::new();
            tokio::spawn(async move {
                // Add small delay to reduce file system contention
                tokio::time::sleep(tokio::time::Duration::from_millis(i as u64 * 10)).await;
                
                // Create temp manager within task but return it to keep files alive
                let temp_manager = TempFileManager::new();
                let dest = temp_manager.create_temp_file(&format!("concurrent_{}", i), ".db").unwrap();
                
                let copy_result = fs::copy(&source, &dest);
                if copy_result.is_err() {
                    eprintln!("Transfer {} failed: {:?}", i, copy_result.err());
                    return Err(format!("Transfer {} failed", i));
                }
                
                // Verify the transfer using real connection manager
                if !dest.exists() {
                    return Err(format!("Destination {} does not exist", i));
                }
                
                let source_metadata = fs::metadata(&source);
                let dest_metadata = fs::metadata(&dest);
                
                if source_metadata.is_err() || dest_metadata.is_err() {
                    return Err(format!("Could not get metadata for transfer {}", i));
                }
                
                let source_size = source_metadata.unwrap().len();
                let dest_size = dest_metadata.unwrap().len();
                
                if source_size != dest_size {
                    return Err(format!("Size mismatch for transfer {}: {} != {}", i, source_size, dest_size));
                }
                
                // Verify database validity using real connection manager
                let dest_path = dest.to_string_lossy().to_string();
                let validity_result = connection_manager.get_connection(&dest_path).await;
                if validity_result.is_err() {
                    return Err(format!("Database {} is not valid after transfer", i));
                }
                
                // Return both dest path and temp manager to keep files alive
                Ok((dest_path, temp_manager))
            })
        }).collect();
        
        // === Wait for all transfers to complete ===
        let mut results = Vec::new();
        let mut temp_managers = Vec::new(); // Keep temp managers alive
        let mut successful_transfers = 0;
        
        for handle in handles {
            match handle.await {
                Ok(Ok((dest_path, temp_manager))) => {
                    results.push(dest_path);
                    temp_managers.push(temp_manager);
                    successful_transfers += 1;
                }
                Ok(Err(err)) => {
                    eprintln!("Transfer error: {}", err);
                }
                Err(join_err) => {
                    eprintln!("Task join error: {:?}", join_err);
                }
            }
        }
        
        // At least most transfers should succeed
        assert!(successful_transfers >= num_transfers - 1, 
            "Most transfers should succeed: {}/{}", successful_transfers, num_transfers);
        
        // === Verify all successful results using real connection manager ===
        for dest_path in &results {
            assert!(std::path::Path::new(dest_path).exists(), "All transferred files should exist");
            
            let validity_result = fixture.verify_database_validity(dest_path).await;
            assert!(validity_result.is_ok(), "All transferred databases should be valid");
        }
        
        // temp_managers will be dropped here, cleaning up the files
    }
    
    #[tokio::test]
    async fn test_transfer_cleanup() {
        let fixture = FileTransferTestFixture::new();
        
        // === Create and transfer file ===
        let source = fixture.create_test_database_with_schema("cleanup_source",
            "CREATE TABLE test (id INTEGER PRIMARY KEY);"
        ).await;
        
        let dest = fixture.create_temp_file("cleanup_test", ".db");
        fs::copy(&source, &dest).unwrap();
        
        assert!(dest.exists(), "File should exist after transfer");
        
        // === Verify it's a valid database before cleanup ===
        let dest_path = dest.to_string_lossy().to_string();
        let is_valid = fixture.verify_database_validity(&dest_path).await;
        assert!(is_valid.is_ok(), "Database should be valid before cleanup");
        
        // === Manual cleanup ===
        fs::remove_file(&dest).unwrap();
        assert!(!dest.exists(), "File should be removed after cleanup");
    }
    
    #[tokio::test]
    async fn test_transfer_with_filename_conflicts() {
        let fixture = FileTransferTestFixture::new();
        let temp_dir = fixture.temp_manager.create_temp_dir("conflict_test").unwrap();
        
        let source = fixture.create_test_database_with_schema("conflict_source",
            "CREATE TABLE test (id INTEGER PRIMARY KEY);"
        ).await;
        
        // === Create first file ===
        let dest1 = temp_dir.join("database.db");
        fs::copy(&source, &dest1).unwrap();
        assert!(dest1.exists());
        
        // Verify first database using real connection manager
        let dest1_path = dest1.to_string_lossy().to_string();
        let is_valid1 = fixture.verify_database_validity(&dest1_path).await;
        assert!(is_valid1.is_ok(), "First database should be valid");
        
        // === Try to create second file with same name - should overwrite ===
        let copy_result = fs::copy(&source, &dest1);
        assert!(copy_result.is_ok(), "Should overwrite existing file");
        
        // Verify file still exists and is valid
        assert!(dest1.exists());
        let is_still_valid = fixture.verify_database_validity(&dest1_path).await;
        assert!(is_still_valid.is_ok(), "Overwritten database should still be valid");
        
        // === Create file with different name to avoid conflict ===
        let dest2 = temp_dir.join("database_2.db");
        let copy_result2 = fs::copy(&source, &dest2);
        assert!(copy_result2.is_ok(), "Should create file with different name");
        
        // Both files should exist and be valid
        assert!(dest1.exists());
        assert!(dest2.exists());
        
        let dest2_path = dest2.to_string_lossy().to_string();
        let is_valid2 = fixture.verify_database_validity(&dest2_path).await;
        assert!(is_valid2.is_ok(), "Second database should be valid");
    }
}
