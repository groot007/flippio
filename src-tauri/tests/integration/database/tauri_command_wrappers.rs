use flippio::commands::database::commands::{get_tables_impl, get_table_data_impl};
use crate::fixtures::temp_files::TempFileManager;
use sqlx::SqlitePool;

/// Simple integration test that focuses on testing Tauri command delegation
/// This tests that our refactored commands properly call the business logic
struct SimpleTauriTestFixture {
    temp_manager: TempFileManager,
    db_path: String,
    pool: SqlitePool,
}

impl SimpleTauriTestFixture {
    async fn new() -> Self {
        let temp_manager = TempFileManager::new();
        let db_path = temp_manager.create_temp_file("simple_tauri_test", ".db").unwrap();
        
        // Create a test database with sample data
        let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.display()))
            .await
            .expect("Failed to connect to test database");
            
        // Create test table
        sqlx::query(
            "CREATE TABLE test_table (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                value TEXT
            )"
        )
        .execute(&pool)
        .await
        .expect("Failed to create test table");
        
        sqlx::query(
            "INSERT INTO test_table (name, value) VALUES 
             ('test1', 'value1'),
             ('test2', 'value2')"
        )
        .execute(&pool)
        .await
        .expect("Failed to insert test data");
        
        Self {
            temp_manager,
            db_path: db_path.to_string_lossy().to_string(),
            pool,
        }
    }
}

#[cfg(test)]
mod simple_tauri_command_tests {
    use super::*;
    use serial_test::serial;

    #[tokio::test]
    #[serial]
    async fn test_get_tables_impl_directly() {
        // This test verifies that our extracted business logic works
        // which is what the Tauri commands now call
        let fixture = SimpleTauriTestFixture::new().await;
        
        let result = get_tables_impl(&fixture.pool).await;
        
        assert!(result.success);
        assert!(result.data.is_some());
        
        let tables = result.data.unwrap();
        assert_eq!(tables.len(), 1);
        assert_eq!(tables[0].name, "test_table");
    }

    #[tokio::test]
    #[serial]
    async fn test_get_table_data_impl_directly() {
        // This test verifies that our extracted business logic works
        // which is what the Tauri commands now call
        let fixture = SimpleTauriTestFixture::new().await;
        
        let result = get_table_data_impl(&fixture.pool, "test_table").await;
        
        assert!(result.success);
        assert!(result.data.is_some());
        
        let table_data = result.data.unwrap();
        assert_eq!(table_data.columns.len(), 3); // id, name, value
        assert_eq!(table_data.rows.len(), 2); // test1, test2
        
        // Verify specific data
        assert!(table_data.rows[0].contains_key("name"));
        assert!(table_data.rows[0].contains_key("value"));
    }

    #[tokio::test]
    #[serial]
    async fn test_error_handling_in_business_logic() {
        let fixture = SimpleTauriTestFixture::new().await;
        
        // Test error case: nonexistent table
        let result = get_table_data_impl(&fixture.pool, "nonexistent_table").await;
        
        assert!(!result.success);
        assert!(result.error.is_some());
        assert!(result.error.unwrap().contains("does not exist"));
    }

    #[tokio::test]
    #[serial]
    async fn test_business_logic_data_types() {
        let fixture = SimpleTauriTestFixture::new().await;
        
        // Test with different data types
        sqlx::query(
            "CREATE TABLE type_test (
                id INTEGER PRIMARY KEY,
                text_col TEXT,
                int_col INTEGER,
                real_col REAL
            )"
        )
        .execute(&fixture.pool)
        .await
        .expect("Failed to create type test table");
        
        sqlx::query(
            "INSERT INTO type_test (text_col, int_col, real_col) VALUES 
             ('sample text', 42, 3.14)"
        )
        .execute(&fixture.pool)
        .await
        .expect("Failed to insert type test data");
        
        let result = get_table_data_impl(&fixture.pool, "type_test").await;
        
        assert!(result.success);
        let table_data = result.data.unwrap();
        assert_eq!(table_data.columns.len(), 4);
        assert_eq!(table_data.rows.len(), 1);
        
        // Verify the row contains our test data
        let row = &table_data.rows[0];
        assert!(row.contains_key("text_col"));
        assert!(row.contains_key("int_col"));
        assert!(row.contains_key("real_col"));
    }

    #[tokio::test]
    #[serial]
    async fn test_tauri_command_coverage_simulation() {
        // This test simulates what the Tauri commands do:
        // 1. Get database pool (we simulate this with our test pool)
        // 2. Call the business logic function
        // 3. Return the result
        
        let fixture = SimpleTauriTestFixture::new().await;
        
        // Simulate db_get_tables command flow
        let tables_result = {
            // This is what db_get_tables does after getting the pool
            get_tables_impl(&fixture.pool).await
        };
        
        assert!(tables_result.success);
        let tables = tables_result.data.unwrap();
        assert!(!tables.is_empty());
        
        // Simulate db_get_table_data command flow
        let data_result = {
            // This is what db_get_table_data does after getting the pool
            get_table_data_impl(&fixture.pool, &tables[0].name).await
        };
        
        assert!(data_result.success);
        let table_data = data_result.data.unwrap();
        assert!(!table_data.rows.is_empty());
    }

    #[tokio::test]
    #[serial] 
    async fn test_multiple_table_operations() {
        let fixture = SimpleTauriTestFixture::new().await;
        
        // Create multiple tables to test table enumeration
        sqlx::query("CREATE TABLE table_a (id INTEGER, data TEXT)")
            .execute(&fixture.pool)
            .await
            .unwrap();
            
        sqlx::query("CREATE TABLE table_b (id INTEGER, info TEXT)")
            .execute(&fixture.pool)
            .await
            .unwrap();
        
        // Test getting all tables
        let tables_result = get_tables_impl(&fixture.pool).await;
        assert!(tables_result.success);
        
        let tables = tables_result.data.unwrap();
        assert_eq!(tables.len(), 3); // test_table + table_a + table_b
        
        // Verify we can get data from each table
        for table in &tables {
            let data_result = get_table_data_impl(&fixture.pool, &table.name).await;
            assert!(data_result.success, "Failed to get data for table: {}", table.name);
        }
    }
} 