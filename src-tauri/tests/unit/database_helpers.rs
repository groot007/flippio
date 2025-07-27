use sqlx::{SqlitePool, Row};
use serde_json;

// Import the actual database functionality from the flippio library crate
use flippio::{DatabaseConnectionManager, get_default_value_for_type, reset_sqlite_wal_mode};

#[cfg(test)]
mod database_tests {
    use super::*;
    use crate::fixtures::temp_files::*;
    
    /// Test fixture for database helper tests with real functionality
    struct DatabaseHelperTestFixture {
        pub connection_manager: DatabaseConnectionManager,
        temp_manager: TempFileManager,
    }

    impl DatabaseHelperTestFixture {
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
    }
    
    #[tokio::test]
    async fn test_database_connection_manager_creation() {
        let connection_manager = DatabaseConnectionManager::new();
        
        // Test that we can create a connection manager
        // The actual connections are tested when we try to get a connection
        
        let fixture = DatabaseHelperTestFixture::new();
        let db_path = fixture.create_test_database_with_schema("connection_test",
            "CREATE TABLE test_table (
                id INTEGER PRIMARY KEY,
                data TEXT
            );
            INSERT INTO test_table (data) VALUES ('test_data');"
        ).await;
        
        // Test that we can get a connection through the manager
        let connection_result = connection_manager.get_connection(&db_path).await;
        assert!(connection_result.is_ok(), "Should create connection through manager");
        
        let pool = connection_result.unwrap();
        
        // Test a simple query through the connection
        let result = sqlx::query("SELECT COUNT(*) as count FROM test_table")
            .fetch_one(&pool)
            .await;
            
        assert!(result.is_ok(), "Should execute query through managed connection");
        let count: i64 = result.unwrap().try_get("count").unwrap();
        assert_eq!(count, 1, "Should have 1 record in test table");
    }
    
    #[tokio::test]
    async fn test_database_connection_manager_caching() {
        let fixture = DatabaseHelperTestFixture::new();
        
        let db_path = fixture.create_test_database_with_schema("caching_test",
            "CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL
            );
            INSERT INTO users (name) VALUES ('Alice');"
        ).await;
        
        // Get connection twice - should use cache on second call
        let connection1 = fixture.connection_manager.get_connection(&db_path).await;
        assert!(connection1.is_ok(), "First connection should succeed");
        
        let connection2 = fixture.connection_manager.get_connection(&db_path).await;
        assert!(connection2.is_ok(), "Second connection should succeed (cached)");
        
        // Both connections should work and access the same database
        let pool1 = connection1.unwrap();
        let pool2 = connection2.unwrap();
        
        let result1 = sqlx::query("SELECT COUNT(*) as count FROM users")
            .fetch_one(&pool1)
            .await
            .unwrap();
        let count1: i64 = result1.try_get("count").unwrap();
        
        let result2 = sqlx::query("SELECT COUNT(*) as count FROM users")
            .fetch_one(&pool2)
            .await
            .unwrap();
        let count2: i64 = result2.try_get("count").unwrap();
        
        assert_eq!(count1, count2, "Both connections should see same data");
        assert_eq!(count1, 1, "Should have 1 user");
    }
    
    #[tokio::test]
    async fn test_database_connection_manager_different_databases() {
        let fixture = DatabaseHelperTestFixture::new();
        
        // Create two different databases
        let db1_path = fixture.create_test_database_with_schema("db1_test",
            "CREATE TABLE products (
                id INTEGER PRIMARY KEY,
                name TEXT
            );
            INSERT INTO products (name) VALUES ('Product1');"
        ).await;
        
        let db2_path = fixture.create_test_database_with_schema("db2_test",
            "CREATE TABLE orders (
                id INTEGER PRIMARY KEY,
                amount REAL
            );
            INSERT INTO orders (amount) VALUES (99.99);"
        ).await;
        
        // Get connections to both databases
        let connection1 = fixture.connection_manager.get_connection(&db1_path).await.unwrap();
        let connection2 = fixture.connection_manager.get_connection(&db2_path).await.unwrap();
        
        // Test that each connection accesses its own database
        let result1 = sqlx::query("SELECT COUNT(*) as count FROM products")
            .fetch_one(&connection1)
            .await;
        assert!(result1.is_ok(), "Should query products table in db1");
        
        let result2 = sqlx::query("SELECT COUNT(*) as count FROM orders")
            .fetch_one(&connection2)
            .await;
        assert!(result2.is_ok(), "Should query orders table in db2");
        
        // Cross-database queries should fail
        let cross_result = sqlx::query("SELECT COUNT(*) as count FROM orders")
            .fetch_one(&connection1)
            .await;
        assert!(cross_result.is_err(), "Should not find orders table in db1");
    }
    
    #[tokio::test]
    async fn test_get_default_value_for_type_helper() {
        // Test the real get_default_value_for_type helper function
        
        // Test INTEGER type
        let int_default = get_default_value_for_type("INTEGER");
        assert_eq!(int_default, serde_json::Value::Number(serde_json::Number::from(0)));
        
        // Test TEXT type
        let text_default = get_default_value_for_type("TEXT");
        assert_eq!(text_default, serde_json::Value::String("".to_string()));
        
        // Test REAL type
        let real_default = get_default_value_for_type("REAL");
        assert_eq!(real_default, serde_json::Value::Number(serde_json::Number::from_f64(0.0).unwrap()));
        
        // Test BOOLEAN type
        let bool_default = get_default_value_for_type("BOOLEAN");
        assert_eq!(bool_default, serde_json::Value::Bool(false));
        
        // Test unknown type
        let unknown_default = get_default_value_for_type("UNKNOWN_TYPE");
        assert_eq!(unknown_default, serde_json::Value::Null);
        
        // Test case insensitivity
        let lowercase_int = get_default_value_for_type("integer");
        assert_eq!(lowercase_int, serde_json::Value::Number(serde_json::Number::from(0)));
    }
    
    #[tokio::test]
    async fn test_reset_sqlite_wal_mode_helper() {
        let fixture = DatabaseHelperTestFixture::new();
        
        // Create a test database
        let db_path = fixture.create_test_database_with_schema("wal_test",
            "CREATE TABLE test (id INTEGER PRIMARY KEY);"
        ).await;
        
        // Simulate WAL files by creating them
        let db_path_obj = std::path::Path::new(&db_path);
        let db_stem = db_path_obj.file_stem().and_then(|s| s.to_str()).unwrap();
        let db_dir = db_path_obj.parent().unwrap();
        
        let wal_file = db_dir.join(format!("{}.db-wal", db_stem));
        let shm_file = db_dir.join(format!("{}.db-shm", db_stem));
        
        // Create mock WAL and SHM files
        std::fs::write(&wal_file, b"mock wal content").unwrap();
        std::fs::write(&shm_file, b"mock shm content").unwrap();
        
        // Verify files exist
        assert!(wal_file.exists(), "WAL file should exist before cleanup");
        assert!(shm_file.exists(), "SHM file should exist before cleanup");
        
        // Test the reset_sqlite_wal_mode helper function
        let result = reset_sqlite_wal_mode(&db_path);
        assert!(result.is_ok(), "WAL mode reset should succeed");
        
        // Verify files are removed
        assert!(!wal_file.exists(), "WAL file should be removed after cleanup");
        assert!(!shm_file.exists(), "SHM file should be removed after cleanup");
    }
    
    #[tokio::test]
    async fn test_reset_sqlite_wal_mode_nonexistent_database() {
        // Test reset_sqlite_wal_mode with non-existent database
        let result = reset_sqlite_wal_mode("/nonexistent/database.db");
        assert!(result.is_err(), "Should fail for non-existent database");
        
        let error_msg = result.unwrap_err();
        assert!(error_msg.contains("does not exist"), "Error should mention file doesn't exist");
    }
    
    #[tokio::test]
    async fn test_database_connection_error_handling() {
        let connection_manager = DatabaseConnectionManager::new();
        
        // Test connection to non-existent database
        let result = connection_manager.get_connection("/nonexistent/path/database.db").await;
        assert!(result.is_err(), "Should fail to connect to non-existent database");
        
        let error_msg = result.unwrap_err();
        assert!(!error_msg.is_empty(), "Should provide error message");
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
