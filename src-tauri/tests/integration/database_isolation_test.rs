use sqlx::sqlite::SqlitePool;
use serial_test::serial;

#[cfg(test)]
mod database_isolation_integration_tests {
    use super::*;
    use crate::fixtures::temp_files::*;

    /// Test database isolation - operations target correct databases
    #[tokio::test]
    #[serial]
    async fn test_database_isolation_between_operations() {
        let temp_manager = TempFileManager::new();
        
        // Create two separate test databases
        let db1_path = temp_manager.create_temp_file("isolation_test_1", ".db").unwrap();
        let db2_path = temp_manager.create_temp_file("isolation_test_2", ".db").unwrap();
        
        // Setup first database with users table
        let pool1 = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", db1_path.display()))
            .await
            .unwrap();
            
        sqlx::query(
            "CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                email TEXT NOT NULL
            )"
        )
        .execute(&pool1)
        .await
        .unwrap();
        
        sqlx::query("INSERT INTO users (username, email) VALUES ('john_doe', 'john@example.com')")
            .execute(&pool1)
            .await
            .unwrap();
        
        // Setup second database with profiles table  
        let pool2 = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", db2_path.display()))
            .await
            .unwrap();
            
        sqlx::query(
            "CREATE TABLE profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                handle TEXT NOT NULL,
                display_name TEXT
            )"
        )
        .execute(&pool2)
        .await
        .unwrap();
        
        sqlx::query("INSERT INTO profiles (handle, display_name) VALUES ('@tech_guru', 'Tech Guru')")
            .execute(&pool2)
            .await
            .unwrap();
        
        // Test isolation: Insert into database 1
        sqlx::query("INSERT INTO users (username, email) VALUES ('test_user', 'test@example.com')")
            .execute(&pool1)
            .await
            .unwrap();
        
        // Test isolation: Insert into database 2
        sqlx::query("INSERT INTO profiles (handle, display_name) VALUES ('@test_profile', 'Test Profile')")
            .execute(&pool2)
            .await
            .unwrap();
        
        // Verify data isolation - database 1 should have 2 users
        let users_count: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
            .fetch_one(&pool1)
            .await
            .unwrap();
        assert_eq!(users_count, 2, "Database 1 should have 2 users");
        
        // Verify data isolation - database 2 should have 2 profiles
        let profiles_count: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM profiles")
            .fetch_one(&pool2)
            .await
            .unwrap();
        assert_eq!(profiles_count, 2, "Database 2 should have 2 profiles");
        
        // Verify no cross-contamination - trying to query users in database 2 should fail
        let result = sqlx::query("SELECT COUNT(*) FROM users")
            .fetch_one(&pool2)
            .await;
        assert!(result.is_err(), "Database 2 should not have users table");
        
        pool1.close().await;
        pool2.close().await;
    }

    /// Test connection pool health after database switching simulation
    #[tokio::test]
    #[serial] 
    async fn test_connection_pool_health_after_database_switch() {
        let temp_manager = TempFileManager::new();
        let mut pools = Vec::new();
        
        // Create 3 test databases to simulate switching
        for i in 0..3 {
            let db_path = temp_manager.create_temp_file(&format!("switch_test_{}", i), ".db").unwrap();
            
            let pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", db_path.display()))
                .await
                .unwrap();
                
            // Create different tables in each database
            let table_sql = match i {
                0 => "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)",
                1 => "CREATE TABLE profiles (id INTEGER PRIMARY KEY, handle TEXT)", 
                2 => "CREATE TABLE notes (id INTEGER PRIMARY KEY, title TEXT)",
                _ => unreachable!(),
            };
            
            sqlx::query(table_sql)
                .execute(&pool)
                .await
                .unwrap();
                
            // Insert test data
            let insert_sql = match i {
                0 => "INSERT INTO users (name) VALUES ('test_user')",
                1 => "INSERT INTO profiles (handle) VALUES ('@test_profile')",
                2 => "INSERT INTO notes (title) VALUES ('test_note')",
                _ => unreachable!(),
            };
            
            sqlx::query(insert_sql)
                .execute(&pool)
                .await
                .unwrap();
                
            pools.push(pool);
        }
        
        // Rapidly switch between databases multiple times
        for round in 0..5 {
            for (pool_index, pool) in pools.iter().enumerate() {
                // Verify connection is healthy
                assert!(!pool.is_closed(), "Pool {} should not be closed in round {}", pool_index, round);
                
                // Perform operation to verify connection works
                let table_name = match pool_index {
                    0 => "users",
                    1 => "profiles", 
                    2 => "notes",
                    _ => unreachable!(),
                };
                
                let count: i32 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {}", table_name))
                    .fetch_one(pool)
                    .await
                    .unwrap();
                    
                assert_eq!(count, 1, "Each database should have 1 record");
            }
        }
        
        // Clean up
        for pool in pools {
            pool.close().await;
        }
    }

    /// Test WAL file recovery simulation
    #[tokio::test]
    #[serial]
    async fn test_wal_file_recovery_simulation() {
        let temp_manager = TempFileManager::new();
        let db_path = temp_manager.create_temp_file("wal_test", ".db").unwrap();
        
        // Create database with WAL mode enabled
        let pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", db_path.display()))
            .await
            .unwrap();
            
        // Enable WAL mode
        sqlx::query("PRAGMA journal_mode=WAL")
            .execute(&pool)
            .await
            .unwrap();
            
        sqlx::query(
            "CREATE TABLE notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT
            )"
        )
        .execute(&pool)
        .await
        .unwrap();
        
        // Perform multiple write operations to create WAL files
        for i in 0..5 {
            sqlx::query("INSERT INTO notes (title, content) VALUES (?, ?)")
                .bind(format!("Note {}", i))
                .bind(format!("Content for note {}", i))
                .execute(&pool)
                .await
                .unwrap();
        }
        
        // Verify data was written
        let count: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM notes")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 5, "Should have 5 notes written");
        
        // Simulate database switching by closing and reopening
        pool.close().await;
        
        // Reopen the database - should handle any WAL files properly
        let pool2 = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", db_path.display()))
            .await
            .unwrap();
        
        // Verify data is still accessible after "switching"
        let count2: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM notes")
            .fetch_one(&pool2)
            .await
            .unwrap();
        assert_eq!(count2, 5, "Should still have 5 notes after reconnection");
        
        // Perform additional write operation to verify write capability
        sqlx::query("INSERT INTO notes (title, content) VALUES ('Recovery Test', 'Testing WAL recovery')")
            .execute(&pool2)
            .await
            .unwrap();
            
        let final_count: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM notes")
            .fetch_one(&pool2)
            .await
            .unwrap();
        assert_eq!(final_count, 6, "Should have 6 notes after recovery test");
        
        pool2.close().await;
    }

    /// Test complete user workflow simulation
    #[tokio::test]
    #[serial]
    async fn test_complete_user_workflow_simulation() {
        let temp_manager = TempFileManager::new();
        
        // Simulate user workflow: ecommerce database
        let ecommerce_db = temp_manager.create_temp_file("workflow_ecommerce", ".db").unwrap();
        let ecommerce_pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", ecommerce_db.display()))
            .await
            .unwrap();
            
        sqlx::query(
            "CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL
            )"
        )
        .execute(&ecommerce_pool)
        .await
        .unwrap();
        
        // Initial data
        sqlx::query("INSERT INTO users (username, email) VALUES ('john_doe', 'john@example.com')")
            .execute(&ecommerce_pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO users (username, email) VALUES ('jane_smith', 'jane@example.com')")
            .execute(&ecommerce_pool)
            .await
            .unwrap();
        
        // Step 1: User views ecommerce users (should see 2)
        let initial_count: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
            .fetch_one(&ecommerce_pool)
            .await
            .unwrap();
        assert_eq!(initial_count, 2, "Should start with 2 users");
        
        // Step 2: User adds new user
        sqlx::query("INSERT INTO users (username, email) VALUES ('test_user', 'test@example.com')")
            .execute(&ecommerce_pool)
            .await
            .unwrap();
        
        // Simulate user switching to social database
        let social_db = temp_manager.create_temp_file("workflow_social", ".db").unwrap();
        let social_pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", social_db.display()))
            .await
            .unwrap();
            
        sqlx::query(
            "CREATE TABLE profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                handle TEXT NOT NULL UNIQUE,
                display_name TEXT
            )"
        )
        .execute(&social_pool)
        .await
        .unwrap();
        
        sqlx::query("INSERT INTO profiles (handle, display_name) VALUES ('@tech_guru', 'Tech Guru')")
            .execute(&social_pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO profiles (handle, display_name) VALUES ('@photo_lover', 'Sarah Photography')")
            .execute(&social_pool)
            .await
            .unwrap();
        
        // Step 3: User views social profiles (should see 2, not affected by ecommerce changes)
        let social_count: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM profiles")
            .fetch_one(&social_pool)
            .await
            .unwrap();
        assert_eq!(social_count, 2, "Social database should have 2 profiles");
        
        // Step 4: User returns to ecommerce database - data should persist
        let final_ecommerce_count: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
            .fetch_one(&ecommerce_pool)
            .await
            .unwrap();
        assert_eq!(final_ecommerce_count, 3, "Ecommerce database should have 3 users (including test_user)");
        
        // Step 5: Verify no cross-contamination
        let final_social_count: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM profiles")
            .fetch_one(&social_pool)
            .await
            .unwrap();
        assert_eq!(final_social_count, 2, "Social database should still have only 2 profiles");
        
        ecommerce_pool.close().await;
        social_pool.close().await;
    }
} 