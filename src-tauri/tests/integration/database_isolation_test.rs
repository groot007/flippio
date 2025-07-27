use std::collections::HashMap;
use serial_test::serial;
use serde_json::json;
use sqlx::{SqlitePool, Row, Column, ValueRef};

// Import the actual database functions from the flippio library crate
use flippio::{
    DatabaseConnectionManager
};

#[cfg(test)]
mod database_isolation_integration_tests {
    use super::*;
    use crate::fixtures::temp_files::*;

    /// Test fixture that creates real database connection manager for testing
    struct RealDatabaseTestFixture {
        pub connection_manager: DatabaseConnectionManager,
        temp_manager: TempFileManager,
    }

    impl RealDatabaseTestFixture {
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

        async fn get_table_data(&self, db_path: &str, table_name: &str) -> Result<Vec<serde_json::Map<String, serde_json::Value>>, String> {
            let pool = self.get_connection(db_path).await?;
            
            let query = format!("SELECT * FROM {}", table_name);
            let rows = sqlx::query(&query)
                .fetch_all(&pool)
                .await
                .map_err(|e| format!("Database query error: {}", e))?;

            let mut result_rows = Vec::new();
            for row in rows {
                let mut row_data = serde_json::Map::new();
                
                for (index, column) in row.columns().iter().enumerate() {
                    let value = match row.try_get_raw(index) {
                        Ok(raw_value) => {
                            if raw_value.is_null() {
                                serde_json::Value::Null
                            } else {
                                // Try different types
                                if let Ok(val) = row.try_get::<String, _>(index) {
                                    json!(val)
                                } else if let Ok(val) = row.try_get::<i64, _>(index) {
                                    json!(val)
                                } else if let Ok(val) = row.try_get::<f64, _>(index) {
                                    json!(val)
                                } else if let Ok(val) = row.try_get::<bool, _>(index) {
                                    json!(val)
                                } else {
                                    json!("unknown")
                                }
                            }
                        }
                        Err(_) => serde_json::Value::Null,
                    };
                    row_data.insert(column.name().to_string(), value);
                }
                result_rows.push(row_data);
            }
            
            Ok(result_rows)
        }

        async fn insert_table_row(&self, db_path: &str, table_name: &str, row_data: HashMap<String, serde_json::Value>) -> Result<i64, String> {
            let pool = self.get_connection(db_path).await?;
            
            let columns: Vec<String> = row_data.keys().cloned().collect();
            let placeholders = vec!["?"; columns.len()].join(", ");
            let columns_str = columns.join(", ");
            let query = format!("INSERT INTO {} ({}) VALUES ({})", table_name, columns_str, placeholders);
            
            let mut query_builder = sqlx::query(&query);
            
            for col in &columns {
                if let Some(value) = row_data.get(col) {
                    query_builder = match value {
                        serde_json::Value::String(s) => query_builder.bind(s),
                        serde_json::Value::Number(n) => {
                            if let Some(int_val) = n.as_i64() {
                                query_builder.bind(int_val)
                            } else if let Some(float_val) = n.as_f64() {
                                query_builder.bind(float_val)
                            } else {
                                return Err(format!("Invalid number format for column '{}'", col));
                            }
                        },
                        serde_json::Value::Bool(b) => query_builder.bind(b),
                        serde_json::Value::Null => query_builder.bind(None::<String>),
                        _ => query_builder.bind(value.to_string()),
                    };
                }
            }
            
            let result = query_builder.execute(&pool).await
                .map_err(|e| format!("Database insert error: {}", e))?;
                
            Ok(result.last_insert_rowid())
        }
    }

    /// Test database isolation using real database connection manager - operations target correct databases
    #[tokio::test]
    #[serial]
    async fn test_database_isolation_between_operations() {
        let fixture = RealDatabaseTestFixture::new();
        
        // Create two separate test databases with different schemas
        let db1_path = fixture.create_test_database_with_schema("isolation_test_1", 
            "CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                email TEXT NOT NULL
            ); INSERT INTO users (username, email) VALUES ('john_doe', 'john@example.com');"
        ).await;
        
        let db2_path = fixture.create_test_database_with_schema("isolation_test_2",
            "CREATE TABLE profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                handle TEXT NOT NULL,
                display_name TEXT
            ); INSERT INTO profiles (handle, display_name) VALUES ('@tech_guru', 'Tech Guru');"
        ).await;

        // === PHASE 1: Verify initial database content ===
        let db1_users = fixture.get_table_data(&db1_path, "users").await.unwrap();
        assert_eq!(db1_users.len(), 1, "Database 1 should have 1 user");
        assert_eq!(db1_users[0]["username"].as_str().unwrap(), "john_doe");

        let db2_profiles = fixture.get_table_data(&db2_path, "profiles").await.unwrap();
        assert_eq!(db2_profiles.len(), 1, "Database 2 should have 1 profile");
        assert_eq!(db2_profiles[0]["handle"].as_str().unwrap(), "@tech_guru");

        // === PHASE 2: Test isolation - Insert into database 1 ===
        let mut new_user = HashMap::new();
        new_user.insert("username".to_string(), json!("test_user"));
        new_user.insert("email".to_string(), json!("test@example.com"));

        let insert1_result = fixture.insert_table_row(&db1_path, "users", new_user).await;
        assert!(insert1_result.is_ok(), "Should insert into database 1: {:?}", insert1_result);

        // === PHASE 3: Test isolation - Insert into database 2 ===
        let mut new_profile = HashMap::new();
        new_profile.insert("handle".to_string(), json!("@test_profile"));
        new_profile.insert("display_name".to_string(), json!("Test Profile"));

        let insert2_result = fixture.insert_table_row(&db2_path, "profiles", new_profile).await;
        assert!(insert2_result.is_ok(), "Should insert into database 2: {:?}", insert2_result);

        // === PHASE 4: Verify data isolation ===
        // Database 1 should have 2 users
        let final_users = fixture.get_table_data(&db1_path, "users").await.unwrap();
        assert_eq!(final_users.len(), 2, "Database 1 should have 2 users");

        // Database 2 should have 2 profiles
        let final_profiles = fixture.get_table_data(&db2_path, "profiles").await.unwrap();
        assert_eq!(final_profiles.len(), 2, "Database 2 should have 2 profiles");

        // === PHASE 5: Verify no cross-contamination ===
        // Try to query users table in database 2 (should fail)
        let cross_contamination_result = fixture.get_table_data(&db2_path, "users").await;
        assert!(cross_contamination_result.is_err(), "Database 2 should not have users table");
    }

    /// Test connection pool health after database switching using real connection manager
    #[tokio::test]
    #[serial] 
    async fn test_connection_pool_health_after_database_switch() {
        let fixture = RealDatabaseTestFixture::new();
        
        // Create 3 test databases to simulate switching
        let mut db_paths = Vec::new();
        for i in 0..3 {
            let db_path = fixture.create_test_database_with_schema(
                &format!("switch_test_{}", i),
                &format!("CREATE TABLE test_table_{} (id INTEGER PRIMARY KEY, data TEXT);
                         INSERT INTO test_table_{} (data) VALUES ('test_data_{}')", i, i, i)
            ).await;
            db_paths.push(db_path);
        }
        
        // === Test rapid switching between databases ===
        for round in 0..5 {
            for (db_index, db_path) in db_paths.iter().enumerate() {
                // Get connection (which tests the connection manager's logic)
                let connection_result = fixture.get_connection(db_path).await;
                assert!(connection_result.is_ok(), "Connection should succeed for {} in round {}", db_path, round);
                
                // Perform operation to verify connection works
                let table_name = format!("test_table_{}", db_index);
                let data_result = fixture.get_table_data(db_path, &table_name).await;
                
                assert!(data_result.is_ok(), "Table data fetch should succeed for {} in round {}", db_path, round);
                let data = data_result.unwrap();
                assert_eq!(data.len(), 1, "Each database should have 1 record");
                assert_eq!(data[0]["data"].as_str().unwrap(), format!("test_data_{}", db_index));
            }
        }
    }

    /// Test WAL file recovery using real connection manager
    #[tokio::test]
    #[serial]
    async fn test_wal_file_recovery_simulation() {
        let fixture = RealDatabaseTestFixture::new();
        let db_path = fixture.create_test_database_with_schema("wal_test",
            "CREATE TABLE notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT
            ); PRAGMA journal_mode=WAL;"
        ).await;
        
        // === Perform multiple write operations ===
        for i in 0..5 {
            let mut note_data = HashMap::new();
            note_data.insert("title".to_string(), json!(format!("Note {}", i)));
            note_data.insert("content".to_string(), json!(format!("Content for note {}", i)));
            
            let insert_result = fixture.insert_table_row(&db_path, "notes", note_data).await;
            assert!(insert_result.is_ok(), "Should insert note {}: {:?}", i, insert_result);
        }
        
        // === Verify data was written ===
        let count_result = fixture.get_table_data(&db_path, "notes").await;
        assert!(count_result.is_ok(), "Should get notes data");
        assert_eq!(count_result.unwrap().len(), 5, "Should have 5 notes written");
        
        // === Test connection reuse/recreation (simulates the issues we had) ===
        for i in 0..3 {
            let connection = fixture.get_connection(&db_path).await;
            assert!(connection.is_ok(), "Should get connection on attempt {}", i);
            
            let final_count_result = fixture.get_table_data(&db_path, "notes").await;
            assert!(final_count_result.is_ok(), "Should get final notes data on attempt {}", i);
            assert_eq!(final_count_result.unwrap().len(), 5, "Should still have 5 notes on attempt {}", i);
        }
        
        // === Test additional write operation ===
        let mut recovery_note = HashMap::new();
        recovery_note.insert("title".to_string(), json!("Recovery Test"));
        recovery_note.insert("content".to_string(), json!("Testing connection recovery"));
        
        let recovery_insert = fixture.insert_table_row(&db_path, "notes", recovery_note).await;
        assert!(recovery_insert.is_ok(), "Should insert after recovery: {:?}", recovery_insert);
        
        let recovery_count_result = fixture.get_table_data(&db_path, "notes").await;
        assert!(recovery_count_result.is_ok(), "Should get recovery count data");
        assert_eq!(recovery_count_result.unwrap().len(), 6, "Should have 6 notes after recovery test");
    }

    /// Test complete user workflow simulation using real connection manager
    #[tokio::test]
    #[serial]
    async fn test_complete_user_workflow_simulation() {
        let fixture = RealDatabaseTestFixture::new();
        
        // === Create ecommerce database ===
        let ecommerce_db = fixture.create_test_database_with_schema("workflow_ecommerce",
            "CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL
            );
            INSERT INTO users (username, email) VALUES ('john_doe', 'john@example.com');
            INSERT INTO users (username, email) VALUES ('jane_smith', 'jane@example.com');"
        ).await;
        
        // === Create social database ===
        let social_db = fixture.create_test_database_with_schema("workflow_social",
            "CREATE TABLE profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                handle TEXT NOT NULL UNIQUE,
                display_name TEXT
            );
            INSERT INTO profiles (handle, display_name) VALUES ('@tech_guru', 'Tech Guru');
            INSERT INTO profiles (handle, display_name) VALUES ('@photo_lover', 'Sarah Photography');"
        ).await;
        
        // === Step 1: User views ecommerce users ===
        let initial_users = fixture.get_table_data(&ecommerce_db, "users").await.unwrap();
        assert_eq!(initial_users.len(), 2, "Should start with 2 users");
        
        // === Step 2: User adds new user ===
        let mut new_user = HashMap::new();
        new_user.insert("username".to_string(), json!("test_user"));
        new_user.insert("email".to_string(), json!("test@example.com"));
        
        let insert_result = fixture.insert_table_row(&ecommerce_db, "users", new_user).await;
        assert!(insert_result.is_ok(), "Should insert new user: {:?}", insert_result);
        
        // === Step 3: User switches to social database ===
        let social_profiles = fixture.get_table_data(&social_db, "profiles").await.unwrap();
        assert_eq!(social_profiles.len(), 2, "Social database should have 2 profiles");
        
        // === Step 4: User returns to ecommerce database ===
        let final_users = fixture.get_table_data(&ecommerce_db, "users").await.unwrap();
        assert_eq!(final_users.len(), 3, "Ecommerce should have 3 users (including test_user)");
        
        // === Step 5: Verify no cross-contamination ===
        let final_profiles = fixture.get_table_data(&social_db, "profiles").await.unwrap();
        assert_eq!(final_profiles.len(), 2, "Social should still have only 2 profiles");
        
        // Verify specific data integrity
        let test_user = final_users.iter().find(|user| user["username"].as_str() == Some("test_user"));
        assert!(test_user.is_some(), "test_user should exist in ecommerce database");
        assert_eq!(test_user.unwrap()["email"].as_str().unwrap(), "test@example.com");
    }
} 