use std::collections::HashMap;
use serial_test::serial;
use serde_json::json;
use sqlx::{SqlitePool, Row, Column, ValueRef};

// Import the actual database connection manager from the flippio library crate
use flippio::DatabaseConnectionManager;

#[cfg(test)]
mod database_sync_integration_tests {
    use super::*;
    use crate::fixtures::temp_files::*;
    
    /// Test fixture that creates real database connection manager for sync testing
    struct RealSyncTestFixture {
        pub connection_manager: DatabaseConnectionManager,
        temp_manager: TempFileManager,
    }

    impl RealSyncTestFixture {
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

        async fn insert_user(&self, db_path: &str, name: &str, email: &str) -> Result<i64, String> {
            let pool = self.get_connection(db_path).await?;
            
            let result = sqlx::query("INSERT INTO users (name, email) VALUES (?, ?)")
                .bind(name)
                .bind(email)
                .execute(&pool)
                .await
                .map_err(|e| format!("Database insert error: {}", e))?;
                
            Ok(result.last_insert_rowid())
        }

        async fn verify_user_exists(&self, db_path: &str, name: &str) -> Result<bool, String> {
            let pool = self.get_connection(db_path).await?;
            
            let result = sqlx::query("SELECT COUNT(*) as count FROM users WHERE name = ?")
                .bind(name)
                .fetch_one(&pool)
                .await
                .map_err(|e| format!("Database query error: {}", e))?;

            let count: i64 = result.try_get("count")
                .map_err(|e| format!("Failed to get count: {}", e))?;
            
            Ok(count > 0)
        }

        async fn sync_databases(&self, source_path: &str, dest_path: &str) -> Result<(), String> {
            // Simulate database sync by copying file
            std::fs::copy(source_path, dest_path)
                .map_err(|e| format!("File copy error: {}", e))?;
            
            // In real usage, when a database file is replaced, the connection manager 
            // would need to be notified or connections invalidated. For testing, we'll
            // create a fresh connection manager to simulate this cache invalidation.
            Ok(())
        }

        async fn sync_databases_and_get_fresh_connection_manager(&self, source_path: &str, dest_path: &str) -> Result<DatabaseConnectionManager, String> {
            self.sync_databases(source_path, dest_path).await?;
            // Return a fresh connection manager to simulate cache invalidation
            Ok(DatabaseConnectionManager::new())
        }
    }
    
    #[tokio::test]
    #[serial]
    async fn test_database_synchronization_workflow() {
        let fixture = RealSyncTestFixture::new();
        
        // === Step 1: Create initial database state ===
        let device_db = fixture.create_test_database_with_schema("device_sync",
            "CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL
            );
            INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com');
            INSERT INTO users (name, email) VALUES ('Bob', 'bob@example.com');"
        ).await;
        
        let local_db = fixture.create_test_database_with_schema("local_sync",
            "CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL
            );"
        ).await;
        
        // === Step 2: Initial sync - copy device database to local ===
        fixture.sync_databases(&device_db, &local_db).await.unwrap();
        
        // === Step 3: Verify initial sync using real connection manager ===
        let initial_count = fixture.get_table_count(&local_db, "users").await.unwrap();
        assert_eq!(initial_count, 2, "Should have initial users after sync");
        
        let alice_exists = fixture.verify_user_exists(&local_db, "Alice").await.unwrap();
        assert!(alice_exists, "Alice should exist after initial sync");
        
        // === Step 4: Simulate device database changes ===
        let updated_device_result = fixture.insert_user(&device_db, "Charlie", "charlie@example.com").await;
        assert!(updated_device_result.is_ok(), "Should insert new user on device");
        
        // === Step 5: Sync updated database back to local ===
        fixture.sync_databases(&device_db, &local_db).await.unwrap();
        
        // === Step 6: Verify sync worked using real connection manager ===
        let final_count = fixture.get_table_count(&local_db, "users").await.unwrap();
        assert_eq!(final_count, 3, "Should have 3 users after sync");
        
        let charlie_exists = fixture.verify_user_exists(&local_db, "Charlie").await.unwrap();
        assert!(charlie_exists, "Charlie should exist after sync");
    }
    
    #[tokio::test]
    #[serial]
    async fn test_multi_device_database_management() {
        let fixture = RealSyncTestFixture::new();
        
        // === Create databases for multiple devices ===
        let device1_db = fixture.create_test_database_with_schema("device1_multitest",
            "CREATE TABLE test_table (
                id INTEGER PRIMARY KEY,
                data TEXT
            );
            INSERT INTO test_table (data) VALUES ('device1_data');"
        ).await;
        
        let device2_db = fixture.create_test_database_with_schema("device2_multitest",
            "CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL
            );
            INSERT INTO users (name, email) VALUES ('Device2User', 'device2@example.com');"
        ).await;
        
        // === Test accessing different databases through connection manager ===
        // Access device 1 database
        let device1_count = fixture.get_table_count(&device1_db, "test_table").await;
        assert!(device1_count.is_ok(), "Should access device 1 database");
        assert_eq!(device1_count.unwrap(), 1, "Device 1 should have 1 record");
        
        // Access device 2 database  
        let device2_count = fixture.get_table_count(&device2_db, "users").await;
        assert!(device2_count.is_ok(), "Should access device 2 database");
        assert_eq!(device2_count.unwrap(), 1, "Device 2 should have 1 user");
        
        // === Test rapid switching between devices ===
        for round in 0..3 {
            // Switch to device 1
            let d1_conn = fixture.get_connection(&device1_db).await;
            assert!(d1_conn.is_ok(), "Should connect to device 1 in round {}", round);
            
            // Switch to device 2
            let d2_conn = fixture.get_connection(&device2_db).await;
            assert!(d2_conn.is_ok(), "Should connect to device 2 in round {}", round);
        }
    }
    
    #[tokio::test]
    #[serial]
    async fn test_database_state_consistency() {
        let fixture = RealSyncTestFixture::new();
        
        let db_path = fixture.create_test_database_with_schema("consistency_test",
            "CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL
            );
            INSERT INTO users (name, email) VALUES ('TestUser', 'test@example.com');"
        ).await;
        
        // === Perform multiple concurrent operations using real connection manager ===
        let handles: Vec<_> = (0..5).map(|i| {
            let fixture_db_path = db_path.clone();
            let fixture_connection_manager = DatabaseConnectionManager::new();
            tokio::spawn(async move {
                // Each task gets a connection and performs operations
                let connection_result = fixture_connection_manager.get_connection(&fixture_db_path).await;
                assert!(connection_result.is_ok(), "Connection {} should succeed", i);
                
                let pool = connection_result.unwrap();
                let result = sqlx::query("SELECT COUNT(*) as count FROM users")
                    .fetch_one(&pool)
                    .await;
                    
                assert!(result.is_ok(), "Read operation {} should succeed", i);
                let count: i64 = result.unwrap().try_get("count").unwrap();
                assert!(count >= 0, "Count should be non-negative in operation {}", i);
            })
        }).collect();
        
        // Wait for all operations
        for handle in handles {
            assert!(handle.await.is_ok(), "All concurrent operations should complete");
        }
        
        // === Verify database is still accessible after concurrent operations ===
        let final_count = fixture.get_table_count(&db_path, "users").await.unwrap();
        assert_eq!(final_count, 1, "Database should still have 1 user");
    }
    
    #[tokio::test]
    #[serial]
    async fn test_database_refresh_cycle() {
        let fixture = RealSyncTestFixture::new();
        
        let local_db = fixture.create_test_database_with_schema("refresh_cycle",
            "CREATE TABLE test_table (
                id INTEGER PRIMARY KEY,
                data TEXT
            );"
        ).await;
        
        // === Cycle 1: Initial load ===
        let source1 = fixture.create_test_database_with_schema("source1_refresh",
            "CREATE TABLE test_table (
                id INTEGER PRIMARY KEY,
                data TEXT
            );
            INSERT INTO test_table (data) VALUES ('cycle1_data');"
        ).await;
        
        fixture.sync_databases(&source1, &local_db).await.unwrap();
        
        // Verify initial state using real connection manager
        let cycle1_count = fixture.get_table_count(&local_db, "test_table").await.unwrap();
        assert_eq!(cycle1_count, 1, "Should have 1 record after cycle 1");
        
        // === Cycle 2: Refresh with new schema and data ===
        let source2 = fixture.create_test_database_with_schema("source2_refresh",
            "CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL
            );
            INSERT INTO users (name, email) VALUES ('RefreshUser', 'refresh@example.com');"
        ).await;
        
        // When database schema changes, we need a fresh connection manager
        let fresh_manager = fixture.sync_databases_and_get_fresh_connection_manager(&source2, &local_db).await.unwrap();
        
        // Verify refreshed state (new schema) using fresh connection manager
        let cycle2_count = fresh_manager.get_connection(&local_db).await.unwrap();
        let row = sqlx::query("SELECT COUNT(*) as count FROM users")
            .fetch_one(&cycle2_count)
            .await
            .unwrap();
        let count: i64 = row.try_get("count").unwrap();
        assert_eq!(count, 1, "Should have 1 user after cycle 2");
        
        // Old table should no longer be accessible with fresh manager
        let old_table_result = sqlx::query("SELECT COUNT(*) as count FROM test_table")
            .fetch_one(&cycle2_count)
            .await;
        assert!(old_table_result.is_err(), "Old table should not exist after refresh");
        
        // === Cycle 3: Back to original structure ===
        let fresh_manager2 = fixture.sync_databases_and_get_fresh_connection_manager(&source1, &local_db).await.unwrap();
        
        // Verify we're back to original structure using fresh connection manager
        let cycle3_count = fresh_manager2.get_connection(&local_db).await.unwrap();
        let row3 = sqlx::query("SELECT COUNT(*) as count FROM test_table")
            .fetch_one(&cycle3_count)
            .await
            .unwrap();
        let count3: i64 = row3.try_get("count").unwrap();
        assert_eq!(count3, 1, "Should have test_table again after cycle 3");
        
        // Users table should no longer exist
        let users_result = sqlx::query("SELECT COUNT(*) as count FROM users")
            .fetch_one(&cycle3_count)
            .await;
        assert!(users_result.is_err(), "Users table should not exist after cycle 3");
    }
    
    #[tokio::test]
    #[serial]
    async fn test_database_connection_pooling() {
        let fixture = RealSyncTestFixture::new();
        
        // === Create multiple databases ===
        let mut db_paths = Vec::new();
        for i in 0..3 {
            let db_path = fixture.create_test_database_with_schema(
                &format!("pool_test_{}", i),
                &format!("CREATE TABLE test_table_{} (
                    id INTEGER PRIMARY KEY,
                    data TEXT
                );
                INSERT INTO test_table_{} (data) VALUES ('pool_data_{}');", i, i, i)
            ).await;
            db_paths.push(db_path);
        }
        
        // === Test that all connections work through the real connection manager ===
        for (i, db_path) in db_paths.iter().enumerate() {
            let table_name = format!("test_table_{}", i);
            let count = fixture.get_table_count(db_path, &table_name).await;
            assert!(count.is_ok(), "Connection {} should work", i);
            assert_eq!(count.unwrap(), 1, "Each database should have 1 record");
        }
        
        // === Test concurrent access to different databases ===
        let handles: Vec<_> = db_paths.into_iter().enumerate().map(|(i, db_path)| {
            let connection_manager = DatabaseConnectionManager::new();
            tokio::spawn(async move {
                let pool = connection_manager.get_connection(&db_path).await.unwrap();
                let table_name = format!("test_table_{}", i);
                let result = sqlx::query(&format!("SELECT COUNT(*) as count FROM {}", table_name))
                    .fetch_one(&pool)
                    .await;
                assert!(result.is_ok(), "Concurrent access to database {} should work", i);
                
                let count: i64 = result.unwrap().try_get("count").unwrap();
                assert_eq!(count, 1, "Database {} should have 1 record", i);
            })
        }).collect();
        
        for handle in handles {
            assert!(handle.await.is_ok(), "All concurrent database accesses should succeed");
        }
    }
}
