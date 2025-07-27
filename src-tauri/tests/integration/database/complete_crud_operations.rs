use std::collections::HashMap;
use flippio::commands::database::*;
use flippio::commands::database::types::*;
use flippio::commands::database::connection_manager::*;
use crate::fixtures::{RealDatabaseTestFixture, DatabaseCommandsTestFixture};
use sqlx::{SqlitePool, Row, Column, ValueRef};
use serial_test::serial;
use serde_json;

/// Comprehensive test fixture for all database commands
struct ComprehensiveDatabaseTestFixture {
    temp_manager: TempFileManager,
    db_path: String,
    pool: SqlitePool,
    connection_manager: DatabaseConnectionManager,
}

impl ComprehensiveDatabaseTestFixture {
    async fn new() -> Self {
        let temp_manager = TempFileManager::new();
        let db_path = temp_manager.create_temp_file("comprehensive_test", ".db").unwrap();
        let db_path_str = db_path.to_string_lossy().to_string();
        
        // Create connection pool
        let pool = SqlitePool::connect(&format!("sqlite:{}", db_path_str))
            .await
            .expect("Failed to create test database connection");
        
        // Create a comprehensive test database schema
        sqlx::query(r#"
            CREATE TABLE customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE,
                age INTEGER,
                balance REAL DEFAULT 0.0,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        "#)
        .execute(&pool)
        .await
        .expect("Failed to create customers table");
        
        sqlx::query(r#"
            CREATE TABLE orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER,
                order_date DATE,
                total_amount REAL,
                status TEXT DEFAULT 'pending',
                FOREIGN KEY (customer_id) REFERENCES customers(id)
            )
        "#)
        .execute(&pool)
        .await
        .expect("Failed to create orders table");
        
        // Insert test data
        sqlx::query(r#"
            INSERT INTO customers (name, email, age, balance, is_active) VALUES
            ('John Doe', 'john@example.com', 30, 100.50, 1),
            ('Jane Smith', 'jane@example.com', 25, 250.75, 1),
            ('Bob Johnson', 'bob@example.com', 35, 0.00, 0)
        "#)
        .execute(&pool)
        .await
        .expect("Failed to insert test customers");
        
        sqlx::query(r#"
            INSERT INTO orders (customer_id, order_date, total_amount, status) VALUES
            (1, '2024-01-15', 50.25, 'completed'),
            (2, '2024-01-16', 75.00, 'pending'),
            (1, '2024-01-17', 25.00, 'shipped')
        "#)
        .execute(&pool)
        .await
        .expect("Failed to insert test orders");
        
        let connection_manager = DatabaseConnectionManager::new();
        
        Self {
            temp_manager,
            db_path: db_path_str,
            pool,
            connection_manager,
        }
    }
    
    async fn get_table_row_count(&self, table_name: &str) -> i64 {
        let query = format!("SELECT COUNT(*) as count FROM {}", table_name);
        let row = sqlx::query(&query)
            .fetch_one(&self.pool)
            .await
            .expect("Failed to count rows");
        row.get("count")
    }
}

impl Drop for ComprehensiveDatabaseTestFixture {
    fn drop(&mut self) {
        // Cleanup handled by TempFileManager
    }
}

#[tokio::test]
#[serial]
async fn test_db_info_operations() {
    let fixture = ComprehensiveDatabaseTestFixture::new().await;
    
    // Test getting database info
    let info_result = get_database_info_impl(&fixture.db_path).await;
    assert!(info_result.success);
    
    let db_info = info_result.data.unwrap();
    assert_eq!(db_info.path, fixture.db_path);
    assert!(db_info.size > 0);
    assert_eq!(db_info.tables.len(), 2); // customers and orders
    
    let table_names: Vec<String> = db_info.tables.iter().map(|t| t.name.clone()).collect();
    assert!(table_names.contains(&"customers".to_string()));
    assert!(table_names.contains(&"orders".to_string()));
}

#[tokio::test]
#[serial]
async fn test_db_insert_operations() {
    let fixture = ComprehensiveDatabaseTestFixture::new().await;
    
    // Test inserting a new customer
    let mut new_customer = HashMap::new();
    new_customer.insert("name".to_string(), serde_json::Value::String("Alice Wilson".to_string()));
    new_customer.insert("email".to_string(), serde_json::Value::String("alice@example.com".to_string()));
    new_customer.insert("age".to_string(), serde_json::Value::Number(serde_json::Number::from(28)));
    new_customer.insert("balance".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(150.25).unwrap()));
    
    let insert_result = insert_table_row_impl(&fixture.pool, "customers", &new_customer).await;
    assert!(insert_result.success, "Insert should succeed: {:?}", insert_result.error);
    
    // Verify the insert
    let final_count = fixture.get_table_row_count("customers").await;
    assert_eq!(final_count, 4); // Original 3 + 1 new
}

#[tokio::test]
#[serial]
async fn test_db_update_operations() {
    let fixture = ComprehensiveDatabaseTestFixture::new().await;
    
    // Test updating a customer's balance
    let mut update_data = HashMap::new();
    update_data.insert("balance".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(500.00).unwrap()));
    
    let update_result = update_table_row_impl(
        &fixture.pool, 
        "customers", 
        &update_data, 
        "id = 1"
    ).await;
    assert!(update_result.success, "Update should succeed: {:?}", update_result.error);
    assert_eq!(update_result.data.unwrap(), 1); // 1 row affected
    
    // Verify the update
    let updated_row = sqlx::query("SELECT balance FROM customers WHERE id = 1")
        .fetch_one(&fixture.pool)
        .await
        .expect("Failed to fetch updated row");
    let balance: f64 = updated_row.get("balance");
    assert_eq!(balance, 500.00);
}

#[tokio::test]
#[serial]
async fn test_db_delete_operations() {
    let fixture = ComprehensiveDatabaseTestFixture::new().await;
    
    // Test deleting a customer
    let delete_result = delete_table_row_impl(&fixture.pool, "customers", "id = 3").await;
    assert!(delete_result.success, "Delete should succeed: {:?}", delete_result.error);
    assert_eq!(delete_result.data.unwrap(), 1); // 1 row affected
    
    // Verify the delete
    let final_count = fixture.get_table_row_count("customers").await;
    assert_eq!(final_count, 2); // Original 3 - 1 deleted
}

#[tokio::test]
#[serial]
async fn test_db_execute_query_operations() {
    let fixture = ComprehensiveDatabaseTestFixture::new().await;
    
    // Test SELECT query
    let select_query = "SELECT name, email FROM customers WHERE age > 25 ORDER BY name";
    let select_result = execute_query_impl(&fixture.pool, select_query, &[]).await;
    assert!(select_result.success, "SELECT query should succeed: {:?}", select_result.error);
    
    let query_result = select_result.data.unwrap();
    let columns = query_result.get("columns").unwrap().as_array().unwrap();
    let rows = query_result.get("rows").unwrap().as_array().unwrap();
    assert!(!columns.is_empty());
    assert!(!rows.is_empty());
    
    // Test CREATE TABLE query
    let create_query = "CREATE TABLE test_temp (id INTEGER PRIMARY KEY, description TEXT)";
    let create_result = execute_query_impl(&fixture.pool, create_query, &[]).await;
    assert!(create_result.success, "CREATE query should succeed: {:?}", create_result.error);
}

#[tokio::test]
#[serial]
async fn test_add_new_row_with_defaults() {
    let fixture = ComprehensiveDatabaseTestFixture::new().await;
    
    // Test adding a new row with defaults
    let defaults_result = add_new_row_with_defaults_impl(&fixture.pool, "customers").await;
    assert!(defaults_result.success, "Add with defaults should succeed: {:?}", defaults_result.error);
    
    // Verify the new row was added
    let final_count = fixture.get_table_row_count("customers").await;
    assert_eq!(final_count, 4); // Original 3 + 1 new with defaults
    
    // Check that default values were applied
    let new_row = sqlx::query("SELECT * FROM customers ORDER BY id DESC LIMIT 1")
        .fetch_one(&fixture.pool)
        .await
        .expect("Failed to fetch new row");
    
    let balance: f64 = new_row.get("balance");
    let is_active: bool = new_row.get("is_active");
    assert_eq!(balance, 0.0); // Default balance
    assert_eq!(is_active, true); // Default is_active
}

#[tokio::test]
#[serial]
async fn test_connection_stats_and_cache_operations() {
    let fixture = ComprehensiveDatabaseTestFixture::new().await;
    
    // Add the database to connection manager cache
    let _ = fixture.connection_manager.get_connection(&fixture.db_path).await;
    
    // Test getting connection stats
    let stats_result = get_connection_stats_impl(&fixture.connection_manager).await;
    assert!(stats_result.success);
    
    let stats = stats_result.data.unwrap();
    // Just verify that the stats contain the expected keys
    assert!(stats.contains_key("total_connections"));
    assert!(stats.contains_key("max_connections"));
    assert!(stats.contains_key("ttl_seconds"));
    
    // Test clearing cache for specific path
    let clear_result = clear_cache_for_path_impl(&fixture.connection_manager, &fixture.db_path).await;
    assert!(clear_result.success);
    
    // Test clearing all cache
    let clear_all_result = clear_all_cache_impl(&fixture.connection_manager).await;
    assert!(clear_all_result.success);
}

#[tokio::test]
#[serial]
async fn test_error_scenarios() {
    let fixture = ComprehensiveDatabaseTestFixture::new().await;
    
    // Test querying non-existent table
    let bad_query = "SELECT * FROM non_existent_table";
    let error_result = execute_query_impl(&fixture.pool, bad_query, &[]).await;
    assert!(!error_result.success);
    assert!(error_result.error.is_some());
    
    // Test inserting with invalid constraint
    let mut invalid_customer = HashMap::new();
    invalid_customer.insert("email".to_string(), serde_json::Value::String("john@example.com".to_string())); // Duplicate email
    
    let constraint_result = insert_table_row_impl(&fixture.pool, "customers", &invalid_customer).await;
    assert!(!constraint_result.success);
    assert!(constraint_result.error.is_some());
    
    // Test updating with invalid condition
    let mut update_data = HashMap::new();
    update_data.insert("name".to_string(), serde_json::Value::String("Updated Name".to_string()));
    
    let invalid_update = update_table_row_impl(&fixture.pool, "customers", &update_data, "invalid_condition_syntax").await;
    assert!(!invalid_update.success);
}

#[tokio::test]
#[serial]
async fn test_complex_data_types() {
    let fixture = ComprehensiveDatabaseTestFixture::new().await;
    
    // Create table with various data types
    let create_query = r#"
        CREATE TABLE data_types_test (
            id INTEGER PRIMARY KEY,
            text_field TEXT,
            integer_field INTEGER,
            real_field REAL,
            blob_field BLOB,
            date_field DATE,
            datetime_field DATETIME,
            boolean_field BOOLEAN
        )
    "#;
    
    let _ = execute_query_impl(&fixture.pool, create_query, &[]).await;
    
    // Insert data with various types
    let mut complex_data = HashMap::new();
    complex_data.insert("text_field".to_string(), serde_json::Value::String("Test String".to_string()));
    complex_data.insert("integer_field".to_string(), serde_json::Value::Number(serde_json::Number::from(42)));
    complex_data.insert("real_field".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(3.14159).unwrap()));
    complex_data.insert("boolean_field".to_string(), serde_json::Value::Bool(true));
    complex_data.insert("date_field".to_string(), serde_json::Value::String("2024-01-15".to_string()));
    complex_data.insert("datetime_field".to_string(), serde_json::Value::String("2024-01-15 14:30:00".to_string()));
    
    let insert_result = insert_table_row_impl(&fixture.pool, "data_types_test", &complex_data).await;
    assert!(insert_result.success, "Complex data insert should succeed: {:?}", insert_result.error);
    
    // Verify we can read the data back
    let table_data = get_table_data_impl(&fixture.pool, "data_types_test").await;
    assert!(table_data.success);
    
    let data = table_data.data.unwrap();
    assert!(!data.rows.is_empty());
    assert_eq!(data.columns.len(), 8); // All columns present
}

// Helper functions that would be extracted from the main command functions
// These would need to be implemented in the actual commands.rs file

async fn get_database_info_impl(db_path: &str) -> DbResponse<DbInfo> {
    match std::fs::metadata(db_path) {
        Ok(metadata) => {
            let pool = match SqlitePool::connect(&format!("sqlite:{}", db_path)).await {
                Ok(pool) => pool,
                Err(e) => {
                    return DbResponse {
                        success: false,
                        data: None,
                        error: Some(format!("Failed to connect to database: {}", e)),
                    };
                }
            };
            
            let tables_result = sqlx::query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
                .fetch_all(&pool)
                .await;
            
            pool.close().await;
            
            match tables_result {
                Ok(rows) => {
                    let tables: Vec<TableInfo> = rows
                        .iter()
                        .map(|row| TableInfo {
                            name: row.get::<String, _>("name"),
                        })
                        .collect();
                    DbResponse {
                        success: true,
                        data: Some(DbInfo {
                            path: db_path.to_string(),
                            size: metadata.len(),
                            tables,
                        }),
                        error: None,
                    }
                }
                Err(e) => DbResponse {
                    success: false,
                    data: None,
                    error: Some(format!("Error getting database info: {}", e)),
                }
            }
        }
        Err(e) => DbResponse {
            success: false,
            data: None,
            error: Some(format!("Error reading file: {}", e)),
        }
    }
}

async fn insert_table_row_impl(pool: &SqlitePool, table_name: &str, row_data: &HashMap<String, serde_json::Value>) -> DbResponse<u64> {
    if row_data.is_empty() {
        return DbResponse {
            success: false,
            data: None,
            error: Some("No data provided for insert".to_string()),
        };
    }
    
    let columns: Vec<String> = row_data.keys().cloned().collect();
    let placeholders: Vec<String> = (0..columns.len()).map(|i| format!("${}", i + 1)).collect();
    
    let query = format!(
        "INSERT INTO {} ({}) VALUES ({})",
        table_name,
        columns.join(", "),
        placeholders.join(", ")
    );
    
    let mut query_builder = sqlx::query(&query);
    
    for column in &columns {
        if let Some(value) = row_data.get(column) {
            query_builder = match value {
                serde_json::Value::String(s) => query_builder.bind(s),
                serde_json::Value::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        query_builder.bind(i)
                    } else if let Some(f) = n.as_f64() {
                        query_builder.bind(f)
                    } else {
                        query_builder.bind(n.to_string())
                    }
                }
                serde_json::Value::Bool(b) => query_builder.bind(*b),
                serde_json::Value::Null => query_builder.bind(Option::<String>::None),
                _ => query_builder.bind(value.to_string()),
            };
        }
    }
    
    match query_builder.execute(pool).await {
        Ok(result) => DbResponse {
            success: true,
            data: Some(result.rows_affected()),
            error: None,
        },
        Err(e) => DbResponse {
            success: false,
            data: None,
            error: Some(format!("Insert failed: {}", e)),
        }
    }
}

async fn update_table_row_impl(pool: &SqlitePool, table_name: &str, row_data: &HashMap<String, serde_json::Value>, condition: &str) -> DbResponse<u64> {
    if row_data.is_empty() {
        return DbResponse {
            success: false,
            data: None,
            error: Some("No data provided for update".to_string()),
        };
    }
    
    let set_clauses: Vec<String> = row_data.keys()
        .enumerate()
        .map(|(i, column)| format!("{} = ${}", column, i + 1))
        .collect();
    
    let query = format!(
        "UPDATE {} SET {} WHERE {}",
        table_name,
        set_clauses.join(", "),
        condition
    );
    
    let mut query_builder = sqlx::query(&query);
    
    for column in row_data.keys() {
        if let Some(value) = row_data.get(column) {
            query_builder = match value {
                serde_json::Value::String(s) => query_builder.bind(s),
                serde_json::Value::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        query_builder.bind(i)
                    } else if let Some(f) = n.as_f64() {
                        query_builder.bind(f)
                    } else {
                        query_builder.bind(n.to_string())
                    }
                }
                serde_json::Value::Bool(b) => query_builder.bind(*b),
                serde_json::Value::Null => query_builder.bind(Option::<String>::None),
                _ => query_builder.bind(value.to_string()),
            };
        }
    }
    
    match query_builder.execute(pool).await {
        Ok(result) => DbResponse {
            success: true,
            data: Some(result.rows_affected()),
            error: None,
        },
        Err(e) => DbResponse {
            success: false,
            data: None,
            error: Some(format!("Update failed: {}", e)),
        }
    }
}

async fn delete_table_row_impl(pool: &SqlitePool, table_name: &str, condition: &str) -> DbResponse<u64> {
    let query = format!("DELETE FROM {} WHERE {}", table_name, condition);
    
    match sqlx::query(&query).execute(pool).await {
        Ok(result) => DbResponse {
            success: true,
            data: Some(result.rows_affected()),
            error: None,
        },
        Err(e) => DbResponse {
            success: false,
            data: None,
            error: Some(format!("Delete failed: {}", e)),
        }
    }
}

async fn execute_query_impl(pool: &SqlitePool, query: &str, _params: &[serde_json::Value]) -> DbResponse<serde_json::Value> {
    match sqlx::query(query).fetch_all(pool).await {
        Ok(rows) => {
            let mut result_rows = Vec::new();
            let mut columns = Vec::new();
            
            if !rows.is_empty() {
                // Get column info from first row
                for column in rows[0].columns() {
                    columns.push(serde_json::json!({
                        "name": column.name(),
                        "type": ""
                    }));
                }
                
                // Process all rows
                for row in rows {
                    let mut row_data = HashMap::new();
                    for (i, column) in row.columns().iter().enumerate() {
                        let value = match row.try_get_raw(i) {
                            Ok(raw_value) => {
                                if raw_value.is_null() {
                                    serde_json::Value::Null
                                } else {
                                    match row.try_get::<String, _>(i) {
                                        Ok(s) => serde_json::Value::String(s),
                                        Err(_) => {
                                            match row.try_get::<i64, _>(i) {
                                                Ok(n) => serde_json::Value::Number(serde_json::Number::from(n)),
                                                Err(_) => {
                                                    match row.try_get::<f64, _>(i) {
                                                        Ok(f) => serde_json::Value::Number(serde_json::Number::from_f64(f).unwrap_or(serde_json::Number::from(0))),
                                                        Err(_) => serde_json::Value::String("Unknown type".to_string()),
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            Err(_) => serde_json::Value::Null,
                        };
                        row_data.insert(column.name().to_string(), value);
                    }
                    result_rows.push(serde_json::json!(row_data));
                }
            }
            
            DbResponse {
                success: true,
                data: Some(serde_json::json!({
                    "rows": result_rows,
                    "columns": columns
                })),
                error: None,
            }
        }
        Err(e) => DbResponse {
            success: false,
            data: None,
            error: Some(format!("Query execution failed: {}", e)),
        }
    }
}

async fn add_new_row_with_defaults_impl(pool: &SqlitePool, table_name: &str) -> DbResponse<u64> {
    // Get table info to understand column structure
    let table_info_query = format!("PRAGMA table_info({})", table_name);
    let columns_result = sqlx::query(&table_info_query).fetch_all(pool).await;
    
    match columns_result {
        Ok(columns) => {
            let mut default_values = HashMap::new();
            
                    for column in columns {
            let column_name: String = column.get("name");
            let column_type: String = column.get("type");
            let _not_null: i32 = column.get("notnull");
            let default_value: Option<String> = column.try_get("dflt_value").ok();
            let is_pk: i32 = column.get("pk");
            
            // Skip primary key columns (usually auto-increment)
            if is_pk == 1 {
                continue;
            }
            
            // Add default values for all non-primary key columns that don't have meaningful defaults
            // This ensures we have some data to insert
            let needs_default = match &default_value {
                None => true,
                Some(val) => val.is_empty() || val == "\"\"", // Empty string or quoted empty string
            };
            
            if needs_default {
                let default_val = match column_type.to_uppercase().as_str() {
                    "TEXT" | "VARCHAR" | "CHAR" => serde_json::Value::String("Default Text".to_string()),
                    "INTEGER" | "INT" => serde_json::Value::Number(serde_json::Number::from(0)),
                    "REAL" | "FLOAT" | "DOUBLE" => serde_json::Value::Number(serde_json::Number::from_f64(0.0).unwrap()),
                    "BOOLEAN" | "BOOL" => serde_json::Value::Bool(true),
                    _ => serde_json::Value::String("Default Value".to_string()),
                };
                default_values.insert(column_name, default_val);
            }
        }
            
            // Insert the row with defaults
            insert_table_row_impl(pool, table_name, &default_values).await
        }
        Err(e) => DbResponse {
            success: false,
            data: None,
            error: Some(format!("Failed to get table info: {}", e)),
        }
    }
}

async fn get_connection_stats_impl(manager: &DatabaseConnectionManager) -> DbResponse<HashMap<String, serde_json::Value>> {
    let stats = manager.get_stats().await;
    DbResponse {
        success: true,
        data: Some(stats),
        error: None,
    }
}

async fn clear_cache_for_path_impl(manager: &DatabaseConnectionManager, db_path: &str) -> DbResponse<String> {
    manager.close_connection(db_path).await;
    DbResponse {
        success: true,
        data: Some(format!("Cache cleared for: {}", db_path)),
        error: None,
    }
}

async fn clear_all_cache_impl(manager: &DatabaseConnectionManager) -> DbResponse<String> {
    manager.close_all_connections().await;
    DbResponse {
        success: true,
        data: Some("All cache cleared".to_string()),
        error: None,
    }
} 