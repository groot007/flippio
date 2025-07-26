use std::sync::Arc;
use tokio::sync::RwLock;
use sqlx::sqlite::SqlitePool;
use sqlx::Row;
use serial_test::serial;

#[cfg(test)]
mod database_sync_integration_tests {
    use super::*;
    use crate::fixtures::{test_databases::*, temp_files::*};
    
    #[tokio::test]
    #[serial]
    async fn test_database_synchronization_workflow() {
        // Test syncing databases between device and local state
        let temp_manager = TempFileManager::new();
        let db_pool: Arc<RwLock<Option<SqlitePool>>> = Arc::new(RwLock::new(None));
        
        // Step 1: Create initial database state
        let (_temp_dir1, device_db) = create_complex_test_db().await;
        let local_db = temp_manager.create_temp_file("local_sync", ".db").unwrap();
        
        // Copy device database to local
        std::fs::copy(&device_db, &local_db).unwrap();
        
        // Step 2: Connect to local database
        let pool = SqlitePool::connect(&format!("sqlite:{}", local_db.display()))
            .await
            .unwrap();
            
        {
            let mut write_guard = db_pool.write().await;
            *write_guard = Some(pool);
        }
        
        // Step 3: Verify initial state
        {
            let read_guard = db_pool.read().await;
            if let Some(pool) = read_guard.as_ref() {
                let user_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
                    .fetch_one(pool)
                    .await
                    .unwrap();
                assert!(user_count.0 > 0, "Should have initial users");
            }
        }
        
        // Step 4: Simulate device database changes by creating new version
        let (_temp_dir2, updated_device_db) = create_complex_test_db().await;
        
        // Add more data to simulate device changes
        let update_pool = SqlitePool::connect(&format!("sqlite:{}", updated_device_db.display()))
            .await
            .unwrap();
            
        sqlx::query("INSERT INTO users (name, email) VALUES ('New User', 'new@example.com')")
            .execute(&update_pool)
            .await
            .unwrap();
            
        // Step 5: Sync updated database
        std::fs::copy(&updated_device_db, &local_db).unwrap();
        
        // Reconnect to get updated data
        let new_pool = SqlitePool::connect(&format!("sqlite:{}", local_db.display()))
            .await
            .unwrap();
            
        {
            let mut write_guard = db_pool.write().await;
            *write_guard = Some(new_pool);
        }
        
        // Step 6: Verify sync worked
        {
            let read_guard = db_pool.read().await;
            if let Some(pool) = read_guard.as_ref() {
                let new_user: (String,) = sqlx::query_as("SELECT name FROM users WHERE name = 'New User'")
                    .fetch_one(pool)
                    .await
                    .unwrap();
                assert_eq!(new_user.0, "New User", "Should have synced new data");
            }
        }
    }
    
    #[tokio::test]
    #[serial]
    async fn test_multi_device_database_management() {
        // Test managing databases from multiple devices simultaneously
        let temp_manager = TempFileManager::new();
        let db_pools: Arc<RwLock<Vec<Option<SqlitePool>>>> = Arc::new(RwLock::new(Vec::new()));
        
        // Create databases for multiple devices
        let device1_db = temp_manager.create_temp_file("device1", ".db").unwrap();
        let device2_db = temp_manager.create_temp_file("device2", ".db").unwrap();
        
        let (_temp_dir1, source1) = create_test_db().await;
        let (_temp_dir2, source2) = create_complex_test_db().await;
        
        std::fs::copy(&source1, &device1_db).unwrap();
        std::fs::copy(&source2, &device2_db).unwrap();
        
        // Connect to both databases
        let pool1 = SqlitePool::connect(&format!("sqlite:{}", device1_db.display()))
            .await
            .unwrap();
        let pool2 = SqlitePool::connect(&format!("sqlite:{}", device2_db.display()))
            .await
            .unwrap();
            
        // Store pools
        {
            let mut write_guard = db_pools.write().await;
            write_guard.push(Some(pool1));
            write_guard.push(Some(pool2));
        }
        
        // Test accessing different databases
        {
            let read_guard = db_pools.read().await;
            
            // Query first database (has test_table)
            if let Some(Some(pool)) = read_guard.get(0) {
                let result = sqlx::query("SELECT COUNT(*) as count FROM test_table")
                    .fetch_one(pool)
                    .await;
                assert!(result.is_ok(), "Should query first database");
            }
            
            // Query second database (has users table)
            if let Some(Some(pool)) = read_guard.get(1) {
                let result = sqlx::query("SELECT COUNT(*) as count FROM users")
                    .fetch_one(pool)
                    .await;
                assert!(result.is_ok(), "Should query second database");
            }
        }
    }
    
    #[tokio::test]
    #[serial]
    async fn test_database_state_consistency() {
        // Test maintaining consistent database state during operations
        let temp_manager = TempFileManager::new();
        let db_pool: Arc<RwLock<Option<SqlitePool>>> = Arc::new(RwLock::new(None));
        
        let local_db = temp_manager.create_temp_file("consistency_test", ".db").unwrap();
        let (_temp_dir, source) = create_complex_test_db().await;
        std::fs::copy(&source, &local_db).unwrap();
        
        // Initial connection
        let pool = SqlitePool::connect(&format!("sqlite:{}", local_db.display()))
            .await
            .unwrap();
            
        {
            let mut write_guard = db_pool.write().await;
            *write_guard = Some(pool);
        }
        
        // Perform multiple operations to test consistency
        let handles: Vec<_> = (0..5).map(|i| {
            let db_pool_clone = Arc::clone(&db_pool);
            tokio::spawn(async move {
                // Each task performs read operations
                let read_guard = db_pool_clone.read().await;
                if let Some(pool) = read_guard.as_ref() {
                    let result = sqlx::query("SELECT COUNT(*) as count FROM users")
                        .fetch_one(pool)
                        .await;
                    assert!(result.is_ok(), "Read operation {} should succeed", i);
                    
                    // Get the count value
                    let count: i64 = result.unwrap().get("count");
                    assert!(count >= 0, "Count should be non-negative in operation {}", i);
                }
            })
        }).collect();
        
        // Wait for all operations
        for handle in handles {
            assert!(handle.await.is_ok());
        }
        
        // Verify database is still accessible
        {
            let read_guard = db_pool.read().await;
            assert!(read_guard.is_some(), "Pool should still be available");
        }
    }
    
    #[tokio::test]
    #[serial]
    async fn test_database_refresh_cycle() {
        // Test the cycle of refreshing database from device
        let temp_manager = TempFileManager::new();
        let db_pool: Arc<RwLock<Option<SqlitePool>>> = Arc::new(RwLock::new(None));
        
        let local_db = temp_manager.create_temp_file("refresh_cycle", ".db").unwrap();
        
        // Cycle 1: Initial load
        let (_temp_dir1, source1) = create_test_db().await;
        std::fs::copy(&source1, &local_db).unwrap();
        
        let pool1 = SqlitePool::connect(&format!("sqlite:{}", local_db.display()))
            .await
            .unwrap();
            
        {
            let mut write_guard = db_pool.write().await;
            *write_guard = Some(pool1);
        }
        
        // Verify initial state
        {
            let read_guard = db_pool.read().await;
            if let Some(pool) = read_guard.as_ref() {
                let result = sqlx::query("SELECT COUNT(*) as count FROM test_table")
                    .fetch_one(pool)
                    .await;
                assert!(result.is_ok(), "Should access initial database");
            }
        }
        
        // Cycle 2: Refresh with new data
        {
            let mut write_guard = db_pool.write().await;
            *write_guard = None; // Disconnect
        }
        
        let (_temp_dir2, source2) = create_complex_test_db().await;
        std::fs::copy(&source2, &local_db).unwrap();
        
        let pool2 = SqlitePool::connect(&format!("sqlite:{}", local_db.display()))
            .await
            .unwrap();
            
        {
            let mut write_guard = db_pool.write().await;
            *write_guard = Some(pool2);
        }
        
        // Verify refreshed state
        {
            let read_guard = db_pool.read().await;
            if let Some(pool) = read_guard.as_ref() {
                let result = sqlx::query("SELECT COUNT(*) as count FROM users")
                    .fetch_one(pool)
                    .await;
                assert!(result.is_ok(), "Should access refreshed database");
            }
        }
        
        // Cycle 3: Another refresh
        {
            let mut write_guard = db_pool.write().await;
            *write_guard = None;
        }
        
        std::fs::copy(&source1, &local_db).unwrap(); // Back to original
        
        let pool3 = SqlitePool::connect(&format!("sqlite:{}", local_db.display()))
            .await
            .unwrap();
            
        {
            let mut write_guard = db_pool.write().await;
            *write_guard = Some(pool3);
        }
        
        // Verify we're back to original state
        {
            let read_guard = db_pool.read().await;
            if let Some(pool) = read_guard.as_ref() {
                let result = sqlx::query("SELECT COUNT(*) as count FROM test_table")
                    .fetch_one(pool)
                    .await;
                assert!(result.is_ok(), "Should access original database again");
            }
        }
    }
    
    #[tokio::test]
    #[serial]
    async fn test_database_connection_pooling() {
        // Test connection pool management for multiple databases
        let temp_manager = TempFileManager::new();
        let mut pools = Vec::new();
        
        // Create multiple databases
        for i in 0..3 {
            let db_file = temp_manager.create_temp_file(&format!("pool_test_{}", i), ".db").unwrap();
            let (_temp_dir, source) = create_test_db().await;
            std::fs::copy(&source, &db_file).unwrap();
            
            let pool = SqlitePool::connect(&format!("sqlite:{}", db_file.display()))
                .await
                .unwrap();
            pools.push(pool);
        }
        
        // Test that all pools are functional
        for (i, pool) in pools.iter().enumerate() {
            let result = sqlx::query("SELECT COUNT(*) as count FROM test_table")
                .fetch_one(pool)
                .await;
            assert!(result.is_ok(), "Pool {} should be functional", i);
        }
        
        // Test concurrent access to different pools
        let handles: Vec<_> = pools.into_iter().enumerate().map(|(i, pool)| {
            tokio::spawn(async move {
                let result = sqlx::query("SELECT COUNT(*) as count FROM test_table")
                    .fetch_one(&pool)
                    .await;
                assert!(result.is_ok(), "Concurrent access to pool {} should work", i);
            })
        }).collect();
        
        for handle in handles {
            assert!(handle.await.is_ok());
        }
    }
}
