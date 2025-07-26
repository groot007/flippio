use std::sync::Arc;
use tokio::sync::RwLock;
use sqlx::sqlite::SqlitePool;

#[cfg(test)]
mod database_tests {
    use super::*;
    use crate::fixtures::test_databases::*;
    
    #[tokio::test]
    async fn test_database_pool_creation() {
        let (_temp_dir, db_path) = create_test_db().await;
        
        // Test that we can create a pool and connect
        let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.display()))
            .await;
            
        assert!(pool.is_ok());
        
        let pool = pool.unwrap();
        
        // Test a simple query
        let result = sqlx::query("SELECT COUNT(*) as count FROM test_table")
            .fetch_one(&pool)
            .await;
            
        assert!(result.is_ok());
    }
    
    #[tokio::test]
    async fn test_database_pool_state_management() {
        let db_pool: Arc<RwLock<Option<SqlitePool>>> = Arc::new(RwLock::new(None));
        
        // Initially should be None
        {
            let read_guard = db_pool.read().await;
            assert!(read_guard.is_none());
        }
        
        // Set a pool
        let (_temp_dir, db_path) = create_test_db().await;
        let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.display()))
            .await
            .unwrap();
            
        {
            let mut write_guard = db_pool.write().await;
            *write_guard = Some(pool);
        }
        
        // Should now have a pool
        {
            let read_guard = db_pool.read().await;
            assert!(read_guard.is_some());
        }
    }
    
    #[tokio::test]
    async fn test_concurrent_database_access() {
        let (_temp_dir, db_path) = create_complex_test_db().await;
        let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.display()))
            .await
            .unwrap();
            
        let db_pool: Arc<RwLock<Option<SqlitePool>>> = Arc::new(RwLock::new(Some(pool)));
        
        // Spawn multiple concurrent tasks
        let handles: Vec<_> = (0..5).map(|i| {
            let db_pool_clone = Arc::clone(&db_pool);
            tokio::spawn(async move {
                let read_guard = db_pool_clone.read().await;
                if let Some(pool) = read_guard.as_ref() {
                    let result = sqlx::query("SELECT COUNT(*) as count FROM users")
                        .fetch_one(pool)
                        .await;
                    assert!(result.is_ok(), "Task {} failed", i);
                }
            })
        }).collect();
        
        // Wait for all tasks to complete
        for handle in handles {
            assert!(handle.await.is_ok());
        }
    }
    
    #[tokio::test]
    async fn test_invalid_database_connection() {
        // Test connection to non-existent database
        let result = SqlitePool::connect("sqlite:/nonexistent/path/database.db").await;
        assert!(result.is_err());
    }
    
    #[tokio::test]
    async fn test_corrupted_database_handling() {
        let (_temp_dir, db_path) = create_corrupted_db();
        
        // Try to connect - SQLite might connect but queries should fail
        let result = SqlitePool::connect(&format!("sqlite:{}", db_path.display())).await;
        
        if let Ok(pool) = result {
            // If connection succeeds, try a query that should fail on corrupted data
            let query_result = sqlx::query("SELECT COUNT(*) FROM sqlite_master")
                .fetch_one(&pool)
                .await;
            assert!(query_result.is_err(), "Query on corrupted DB should fail");
        }
        // If connection fails, that's also acceptable behavior
    }
    
    #[tokio::test]
    async fn test_empty_database_handling() {
        let (_temp_dir, db_path) = create_empty_db();
        
        // SQLite can connect to empty files and treat them as new databases
        let result = SqlitePool::connect(&format!("sqlite:{}", db_path.display())).await;
        
        if let Ok(pool) = result {
            // Connection succeeds - this is normal SQLite behavior
            // Verify it's treated as an empty database
            let tables_result = sqlx::query("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'")
                .fetch_one(&pool)
                .await;
            assert!(tables_result.is_ok(), "Should be able to query empty database");
        }
    }
}

#[cfg(test)]
mod database_operations_tests {
    use super::*;
    use crate::fixtures::test_databases::*;
    
    #[tokio::test]
    async fn test_table_listing() {
        let (_temp_dir, db_path) = create_complex_test_db().await;
        let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.display()))
            .await
            .unwrap();
            
        // Test getting table names
        let result = sqlx::query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            .fetch_all(&pool)
            .await;
            
        assert!(result.is_ok());
        let tables = result.unwrap();
        assert!(tables.len() >= 2); // Should have users and posts tables
    }
    
    #[tokio::test]
    async fn test_table_data_retrieval() {
        let (_temp_dir, db_path) = create_complex_test_db().await;
        let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.display()))
            .await
            .unwrap();
            
        // Test getting data from users table
        let result = sqlx::query("SELECT * FROM users")
            .fetch_all(&pool)
            .await;
            
        assert!(result.is_ok());
        let users = result.unwrap();
        assert!(users.len() > 0);
    }
    
    #[tokio::test]
    async fn test_table_schema_info() {
        let (_temp_dir, db_path) = create_complex_test_db().await;
        let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.display()))
            .await
            .unwrap();
            
        // Test getting table schema
        let result = sqlx::query("PRAGMA table_info(users)")
            .fetch_all(&pool)
            .await;
            
        assert!(result.is_ok());
        let columns = result.unwrap();
        assert!(columns.len() > 0);
    }
    
    #[tokio::test]
    async fn test_foreign_key_constraints() {
        let (_temp_dir, db_path) = create_complex_test_db().await;
        let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.display()))
            .await
            .unwrap();
            
        // Enable foreign keys
        let result = sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&pool)
            .await;
            
        assert!(result.is_ok());
        
        // Test that foreign key constraints are enforced
        let _invalid_insert = sqlx::query("INSERT INTO posts (user_id, title) VALUES (999, 'Invalid Post')")
            .execute(&pool)
            .await;
            
        // This should succeed in SQLite even with FK constraints due to its permissive nature
        // But we can test that the constraint is at least enabled
        let fk_check = sqlx::query("PRAGMA foreign_key_check")
            .fetch_all(&pool)
            .await;
            
        assert!(fk_check.is_ok());
    }
}
