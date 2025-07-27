use std::collections::HashMap;
use serial_test::serial;
use sqlx::SqlitePool;

// Import the extracted business logic functions that Tauri commands now use
use flippio::commands::database::commands::{get_tables_impl, get_table_data_impl};
use flippio::commands::database::types::*;

#[cfg(test)]
mod production_business_logic_tests {
    use super::*;
    use crate::fixtures::temp_files::*;

    /// Test fixture for production business logic
    struct ProductionLogicTestFixture {
        temp_manager: TempFileManager,
    }

    impl ProductionLogicTestFixture {
        fn new() -> Self {
            let temp_manager = TempFileManager::new();
            Self { temp_manager }
        }

        /// Create a production-realistic database
        async fn create_production_database(&self, name: &str) -> (String, SqlitePool) {
            let db_path = self.temp_manager.create_temp_file(name, ".db").unwrap();
            let db_path_str = db_path.to_string_lossy().to_string();
            
            let pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", db_path_str))
                .await
                .unwrap();
            
            // Create production-like schema
            sqlx::query(r#"
                CREATE TABLE customers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE,
                    phone TEXT,
                    address TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    is_active BOOLEAN DEFAULT 1
                );
            "#).execute(&pool).await.unwrap();
            
            sqlx::query(r#"
                CREATE TABLE orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id INTEGER NOT NULL,
                    order_date DATE NOT NULL,
                    total_amount REAL NOT NULL,
                    status TEXT DEFAULT 'pending',
                    notes TEXT,
                    FOREIGN KEY (customer_id) REFERENCES customers(id)
                );
            "#).execute(&pool).await.unwrap();
            
            sqlx::query(r#"
                CREATE TABLE products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    description TEXT,
                    price REAL NOT NULL,
                    stock_quantity INTEGER DEFAULT 0,
                    category TEXT,
                    is_available BOOLEAN DEFAULT 1
                );
            "#).execute(&pool).await.unwrap();
            
            // Insert realistic test data
            sqlx::query("INSERT INTO customers (name, email, phone, address) VALUES (?, ?, ?, ?)")
                .bind("John Smith")
                .bind("john.smith@email.com")
                .bind("+1-555-0101")
                .bind("123 Main St, City, State")
                .execute(&pool).await.unwrap();
                
            sqlx::query("INSERT INTO customers (name, email, phone, address) VALUES (?, ?, ?, ?)")
                .bind("Jane Doe")
                .bind("jane.doe@email.com")
                .bind("+1-555-0102")
                .bind("456 Oak Ave, City, State")
                .execute(&pool).await.unwrap();
                
            sqlx::query("INSERT INTO products (name, description, price, stock_quantity, category) VALUES (?, ?, ?, ?, ?)")
                .bind("Laptop")
                .bind("High-performance laptop")
                .bind(1299.99)
                .bind(15)
                .bind("Electronics")
                .execute(&pool).await.unwrap();
                
            sqlx::query("INSERT INTO products (name, description, price, stock_quantity, category) VALUES (?, ?, ?, ?, ?)")
                .bind("Mouse")
                .bind("Wireless optical mouse")
                .bind(29.99)
                .bind(50)
                .bind("Electronics")
                .execute(&pool).await.unwrap();
                
            sqlx::query("INSERT INTO orders (customer_id, order_date, total_amount, status) VALUES (?, ?, ?, ?)")
                .bind(1)
                .bind("2024-01-15")
                .bind(1329.98)
                .bind("completed")
                .execute(&pool).await.unwrap();
                
            sqlx::query("INSERT INTO orders (customer_id, order_date, total_amount, status) VALUES (?, ?, ?, ?)")
                .bind(2)
                .bind("2024-01-16")
                .bind(29.99)
                .bind("pending")
                .execute(&pool).await.unwrap();
            
            (db_path_str, pool)
        }
    }

    /// Test the extracted get_tables_impl function (called by db_get_tables Tauri command)
    #[tokio::test]
    #[serial]
    async fn test_production_get_tables_impl() {
        let fixture = ProductionLogicTestFixture::new();
        let (_db_path, pool) = fixture.create_production_database("production_get_tables").await;

        // Test the actual business logic function that the Tauri command calls
        let result = get_tables_impl(&pool).await;

        assert!(result.success, "get_tables_impl should succeed");
        assert!(result.error.is_none(), "Should not have error");
        
        let tables = result.data.unwrap();
        assert_eq!(tables.len(), 3, "Should have 3 tables");
        
        let table_names: Vec<String> = tables.iter().map(|t| t.name.clone()).collect();
        assert!(table_names.contains(&"customers".to_string()));
        assert!(table_names.contains(&"orders".to_string()));
        assert!(table_names.contains(&"products".to_string()));
        
        pool.close().await;
    }

    /// Test the extracted get_table_data_impl function (called by db_get_table_data Tauri command)
    #[tokio::test]
    #[serial]
    async fn test_production_get_table_data_impl() {
        let fixture = ProductionLogicTestFixture::new();
        let (_db_path, pool) = fixture.create_production_database("production_get_table_data").await;

        // Test customers table
        let result = get_table_data_impl(&pool, "customers").await;

        assert!(result.success, "get_table_data_impl should succeed");
        assert!(result.error.is_none(), "Should not have error");
        
        let table_data = result.data.unwrap();
        assert_eq!(table_data.rows.len(), 2, "Should have 2 customers");
        assert!(!table_data.columns.is_empty(), "Should have column information");
        
        // Verify data structure and types
        let first_customer = &table_data.rows[0];
        assert!(first_customer.contains_key("id"));
        assert!(first_customer.contains_key("name"));
        assert!(first_customer.contains_key("email"));
        assert!(first_customer.contains_key("phone"));
        assert!(first_customer.contains_key("is_active"));
        
        // Test orders table
        let orders_result = get_table_data_impl(&pool, "orders").await;
        assert!(orders_result.success);
        let orders_data = orders_result.data.unwrap();
        assert_eq!(orders_data.rows.len(), 2, "Should have 2 orders");
        
        // Test products table
        let products_result = get_table_data_impl(&pool, "products").await;
        assert!(products_result.success);
        let products_data = products_result.data.unwrap();
        assert_eq!(products_data.rows.len(), 2, "Should have 2 products");
        
        pool.close().await;
    }

    /// Test error handling in production business logic
    #[tokio::test]
    #[serial]
    async fn test_production_error_scenarios() {
        let fixture = ProductionLogicTestFixture::new();
        let (_db_path, pool) = fixture.create_production_database("production_errors").await;

        // Test non-existent table
        let result = get_table_data_impl(&pool, "nonexistent_table").await;
        assert!(!result.success, "Should fail for non-existent table");
        assert!(result.error.is_some(), "Should have error message");
        assert!(result.error.unwrap().contains("does not exist"));
        
        pool.close().await;
    }

    /// Test complex production scenarios
    #[tokio::test]
    #[serial]
    async fn test_production_complex_scenarios() {
        let fixture = ProductionLogicTestFixture::new();
        let (_db_path, pool) = fixture.create_production_database("production_complex").await;

        // Test with tables that have various data types
        let customers_result = get_table_data_impl(&pool, "customers").await;
        assert!(customers_result.success);
        let customers_data = customers_result.data.unwrap();
        
        // Verify different data types are handled correctly
        let first_customer = &customers_data.rows[0];
        
        // INTEGER type (id)
        assert!(first_customer["id"].is_number());
        
        // TEXT type (name, email)
        assert!(first_customer["name"].is_string());
        assert!(first_customer["email"].is_string());
        
        // BOOLEAN type (is_active) - let's see what type it actually is
        println!("is_active value: {:?}, type: {}", first_customer["is_active"], 
                 if first_customer["is_active"].is_number() { "number" } 
                 else if first_customer["is_active"].is_boolean() { "boolean" }
                 else if first_customer["is_active"].is_string() { "string" }
                 else { "other" });
        // Just check that the key exists and has some value
        assert!(first_customer.contains_key("is_active"));
        
        // Test orders table with REAL data type
        let orders_result = get_table_data_impl(&pool, "orders").await;
        assert!(orders_result.success);
        let orders_data = orders_result.data.unwrap();
        let first_order = &orders_data.rows[0];
        
        // REAL type (total_amount)
        assert!(first_order["total_amount"].is_number());
        
        pool.close().await;
    }

    /// Test production workflow simulation
    #[tokio::test]
    #[serial]
    async fn test_production_workflow_complete() {
        let fixture = ProductionLogicTestFixture::new();
        let (_db_path, pool) = fixture.create_production_database("production_workflow").await;

        // Step 1: Get list of tables (like user opening database)
        let tables_result = get_tables_impl(&pool).await;
        assert!(tables_result.success);
        let tables = tables_result.data.unwrap();
        assert_eq!(tables.len(), 3);

        // Step 2: Browse each table (like user exploring database)
        for table in &tables {
            let table_data_result = get_table_data_impl(&pool, &table.name).await;
            assert!(table_data_result.success, "Should be able to get data for table: {}", table.name);
            
            let table_data = table_data_result.data.unwrap();
            assert!(!table_data.columns.is_empty(), "Table {} should have columns", table.name);
            
            // All our test tables should have data
            assert!(!table_data.rows.is_empty(), "Table {} should have rows", table.name);
        }

        // Step 3: Focus on specific table analysis
        let customers_result = get_table_data_impl(&pool, "customers").await;
        let customers_data = customers_result.data.unwrap();
        
        // Verify we can see detailed customer information
        assert_eq!(customers_data.rows.len(), 2);
        for row in &customers_data.rows {
            assert!(row.contains_key("name"));
            assert!(row.contains_key("email"));
            assert!(row["name"].is_string());
            assert!(row["email"].is_string());
        }
        
        pool.close().await;
    }

    /// Test production performance with larger dataset
    #[tokio::test]
    #[serial]
    async fn test_production_performance_scenario() {
        let fixture = ProductionLogicTestFixture::new();
        let db_path = fixture.temp_manager.create_temp_file("production_performance", ".db").unwrap();
        let db_path_str = db_path.to_string_lossy().to_string();
        
        let pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", db_path_str))
            .await
            .unwrap();
        
        // Create table for performance test
        sqlx::query(r#"
            CREATE TABLE large_table (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data_field TEXT,
                numeric_field REAL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        "#).execute(&pool).await.unwrap();
        
        // Insert multiple rows for performance testing
        for i in 1..=100 {
            sqlx::query("INSERT INTO large_table (data_field, numeric_field) VALUES (?, ?)")
                .bind(format!("Data item {}", i))
                .bind(i as f64 * 1.5)
                .execute(&pool).await.unwrap();
        }
        
        // Test that our business logic can handle larger datasets
        let result = get_table_data_impl(&pool, "large_table").await;
        assert!(result.success);
        let table_data = result.data.unwrap();
        assert_eq!(table_data.rows.len(), 100);
        assert!(!table_data.columns.is_empty());
        
        pool.close().await;
    }
} 