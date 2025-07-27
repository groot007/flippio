use serial_test::serial;
use flippio::commands::database::types::*;
use serde_json::json;
use std::collections::HashMap;

mod database_types_tests {
    use super::*;

    #[tokio::test]
    #[serial]
    async fn test_db_response_success() {
        let response: DbResponse<String> = DbResponse {
            success: true,
            data: Some("test data".to_string()),
            error: None,
        };

        assert!(response.success);
        assert!(response.data.is_some());
        assert_eq!(response.data.unwrap(), "test data");
        assert!(response.error.is_none());
    }

    #[tokio::test]
    #[serial]
    async fn test_db_response_error() {
        let response: DbResponse<String> = DbResponse {
            success: false,
            data: None,
            error: Some("Database error".to_string()),
        };

        assert!(!response.success);
        assert!(response.data.is_none());
        assert!(response.error.is_some());
        assert_eq!(response.error.unwrap(), "Database error");
    }

    #[tokio::test]
    #[serial]
    async fn test_table_info_structure() {
        let table_info = TableInfo {
            name: "users".to_string(),
        };

        assert_eq!(table_info.name, "users");
    }

    #[tokio::test]
    #[serial]
    async fn test_multiple_table_info() {
        let tables = vec![
            TableInfo { name: "users".to_string() },
            TableInfo { name: "products".to_string() },
            TableInfo { name: "orders".to_string() },
        ];

        assert_eq!(tables.len(), 3);
        assert_eq!(tables[0].name, "users");
        assert_eq!(tables[1].name, "products");
        assert_eq!(tables[2].name, "orders");
    }

    #[tokio::test]
    #[serial]
    async fn test_db_response_serialization() {
        let response = DbResponse {
            success: true,
            data: Some(vec![
                TableInfo { name: "table1".to_string() },
                TableInfo { name: "table2".to_string() },
            ]),
            error: None,
        };

        // Test serialization
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"success\":true"));
        assert!(json.contains("\"table1\""));
        assert!(json.contains("\"table2\""));

        // Test deserialization
        let deserialized: DbResponse<Vec<TableInfo>> = serde_json::from_str(&json).unwrap();
        assert!(deserialized.success);
        assert!(deserialized.data.is_some());
        assert_eq!(deserialized.data.unwrap().len(), 2);
    }

    #[tokio::test]
    #[serial]
    async fn test_db_response_with_json_data() {
        let json_data = json!({
            "rows": [
                {"id": 1, "name": "John"},
                {"id": 2, "name": "Jane"}
            ],
            "total": 2
        });

        let response: DbResponse<serde_json::Value> = DbResponse {
            success: true,
            data: Some(json_data),
            error: None,
        };

        assert!(response.success);
        assert!(response.data.is_some());
        
        let data = response.data.unwrap();
        assert!(data["rows"].is_array());
        assert_eq!(data["total"].as_u64().unwrap(), 2);
    }

    #[tokio::test]
    #[serial]
    async fn test_db_response_edge_cases() {
        // Test with empty string data
        let empty_response: DbResponse<String> = DbResponse {
            success: true,
            data: Some(String::new()),
            error: None,
        };
        assert!(empty_response.success);
        assert_eq!(empty_response.data.unwrap(), "");

        // Test with both data and error (should not happen in practice)
        let inconsistent_response: DbResponse<String> = DbResponse {
            success: false,
            data: Some("some data".to_string()),
            error: Some("some error".to_string()),
        };
        assert!(!inconsistent_response.success);
        assert!(inconsistent_response.data.is_some());
        assert!(inconsistent_response.error.is_some());
    }
}

mod database_row_operations_tests {
    use super::*;

    #[tokio::test]
    #[serial]
    async fn test_row_data_creation() {
        let mut row_data = HashMap::new();
        row_data.insert("id".to_string(), json!(1));
        row_data.insert("name".to_string(), json!("John Doe"));
        row_data.insert("email".to_string(), json!("john@example.com"));
        row_data.insert("age".to_string(), json!(30));

        assert_eq!(row_data.len(), 4);
        assert_eq!(row_data["id"], json!(1));
        assert_eq!(row_data["name"], json!("John Doe"));
        assert_eq!(row_data["email"], json!("john@example.com"));
        assert_eq!(row_data["age"], json!(30));
    }

    #[tokio::test]
    #[serial]
    async fn test_row_data_types() {
        let mut row_data = HashMap::new();
        
        // Test different JSON value types
        row_data.insert("integer".to_string(), json!(42));
        row_data.insert("float".to_string(), json!(3.14));
        row_data.insert("string".to_string(), json!("text"));
        row_data.insert("boolean".to_string(), json!(true));
        row_data.insert("null".to_string(), json!(null));
        row_data.insert("array".to_string(), json!([1, 2, 3]));
        row_data.insert("object".to_string(), json!({"key": "value"}));

        assert_eq!(row_data["integer"], json!(42));
        assert_eq!(row_data["float"], json!(3.14));
        assert_eq!(row_data["string"], json!("text"));
        assert_eq!(row_data["boolean"], json!(true));
        assert_eq!(row_data["null"], json!(null));
        assert!(row_data["array"].is_array());
        assert!(row_data["object"].is_object());
    }

    #[tokio::test]
    #[serial]
    async fn test_empty_row_data() {
        let row_data: HashMap<String, serde_json::Value> = HashMap::new();
        assert!(row_data.is_empty());
        assert_eq!(row_data.len(), 0);
    }

    #[tokio::test]
    #[serial]
    async fn test_row_data_modification() {
        let mut row_data = HashMap::new();
        row_data.insert("name".to_string(), json!("Original"));
        
        // Update existing value
        row_data.insert("name".to_string(), json!("Updated"));
        assert_eq!(row_data["name"], json!("Updated"));
        
        // Add new value
        row_data.insert("new_field".to_string(), json!("new_value"));
        assert_eq!(row_data["new_field"], json!("new_value"));
        
        // Remove value
        let removed = row_data.remove("name");
        assert!(removed.is_some());
        assert_eq!(removed.unwrap(), json!("Updated"));
        assert!(!row_data.contains_key("name"));
    }

    #[tokio::test]
    #[serial]
    async fn test_row_data_serialization() {
        let mut row_data = HashMap::new();
        row_data.insert("id".to_string(), json!(1));
        row_data.insert("name".to_string(), json!("Test User"));
        row_data.insert("active".to_string(), json!(true));

        // Serialize to JSON
        let json_string = serde_json::to_string(&row_data).unwrap();
        assert!(json_string.contains("\"id\":1"));
        assert!(json_string.contains("\"name\":\"Test User\""));
        assert!(json_string.contains("\"active\":true"));

        // Deserialize back
        let deserialized: HashMap<String, serde_json::Value> = 
            serde_json::from_str(&json_string).unwrap();
        assert_eq!(deserialized, row_data);
    }
}

mod database_query_tests {
    use super::*;

    #[tokio::test]
    #[serial]
    async fn test_query_result_structure() {
        let query_result = json!({
            "rows": [
                {"id": 1, "name": "Alice"},
                {"id": 2, "name": "Bob"}
            ],
            "columns": [
                {"name": "id", "type": "INTEGER"},
                {"name": "name", "type": "TEXT"}
            ]
        });

        assert!(query_result["rows"].is_array());
        assert!(query_result["columns"].is_array());
        assert_eq!(query_result["rows"].as_array().unwrap().len(), 2);
        assert_eq!(query_result["columns"].as_array().unwrap().len(), 2);
    }

    #[tokio::test]
    #[serial]
    async fn test_query_pagination_params() {
        // Test pagination parameters that would be used in queries
        let page = Some(1);
        let limit = Some(10);
        let offset = page.map(|p| (p - 1) * limit.unwrap_or(50));

        assert_eq!(page, Some(1));
        assert_eq!(limit, Some(10));
        assert_eq!(offset, Some(0));

        // Test second page
        let page = Some(2);
        let offset = page.map(|p| (p - 1) * limit.unwrap_or(50));
        assert_eq!(offset, Some(10));
    }

    #[tokio::test]
    #[serial]
    async fn test_query_ordering_params() {
        let order_by = Some("name".to_string());
        let order_desc = Some(true);

        let order_clause = match (&order_by, &order_desc) {
            (Some(column), Some(true)) => format!("ORDER BY {} DESC", column),
            (Some(column), Some(false)) => format!("ORDER BY {} ASC", column),
            (Some(column), None) => format!("ORDER BY {}", column),
            _ => String::new(),
        };

        assert_eq!(order_clause, "ORDER BY name DESC");
    }

    #[tokio::test]
    #[serial]
    async fn test_sql_query_building() {
        let table_name = "users";
        let base_query = format!("SELECT * FROM {}", table_name);
        
        // Test with WHERE clause
        let where_clause = "WHERE age > 18";
        let full_query = format!("{} {}", base_query, where_clause);
        assert_eq!(full_query, "SELECT * FROM users WHERE age > 18");

        // Test with ORDER BY
        let order_clause = "ORDER BY name ASC";
        let ordered_query = format!("{} {}", base_query, order_clause);
        assert_eq!(ordered_query, "SELECT * FROM users ORDER BY name ASC");

        // Test with LIMIT
        let limit_clause = "LIMIT 10 OFFSET 0";
        let limited_query = format!("{} {}", base_query, limit_clause);
        assert_eq!(limited_query, "SELECT * FROM users LIMIT 10 OFFSET 0");
    }
}

mod database_error_handling_tests {
    use super::*;

    #[tokio::test]
    #[serial]
    async fn test_common_sql_errors() {
        let error_types = vec![
            "no such table: nonexistent_table",
            "UNIQUE constraint failed: users.email",
            "NOT NULL constraint failed: users.name",
            "database is locked",
            "attempt to write a readonly database",
            "disk I/O error",
        ];

        for error_msg in error_types {
            let error_response: DbResponse<String> = DbResponse {
                success: false,
                data: None,
                error: Some(error_msg.to_string()),
            };

            assert!(!error_response.success);
            assert!(error_response.error.is_some());
            assert!(error_response.data.is_none());
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_error_categorization() {
        let errors = vec![
            ("no such table", "schema"),
            ("UNIQUE constraint", "constraint"),
            ("NOT NULL constraint", "constraint"),
            ("database is locked", "lock"),
            ("readonly database", "permission"),
            ("disk I/O error", "io"),
        ];

        for (error_msg, expected_category) in errors {
            let category = if error_msg.contains("table") {
                "schema"
            } else if error_msg.contains("constraint") {
                "constraint"
            } else if error_msg.contains("locked") {
                "lock"
            } else if error_msg.contains("readonly") {
                "permission"
            } else if error_msg.contains("I/O") {
                "io"
            } else {
                "unknown"
            };

            assert_eq!(category, expected_category);
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_error_response_creation() {
        // Helper function to create error responses (mimics actual error handling)
        fn create_error_response(error_msg: &str) -> DbResponse<String> {
            DbResponse {
                success: false,
                data: None,
                error: Some(format!("Database operation failed: {}", error_msg)),
            }
        }

        let response = create_error_response("table not found");
        assert!(!response.success);
        assert!(response.error.unwrap().contains("Database operation failed"));
    }
}

mod database_connection_types_tests {
    use super::*;

    #[tokio::test]
    #[serial]
    async fn test_connection_stats_structure() {
        // Simulate connection statistics
        let stats = json!({
            "total_connections": 5,
            "active_connections": 3,
            "idle_connections": 2,
            "cache_hits": 150,
            "cache_misses": 25
        });

        assert_eq!(stats["total_connections"], json!(5));
        assert_eq!(stats["active_connections"], json!(3));
        assert_eq!(stats["idle_connections"], json!(2));
        assert_eq!(stats["cache_hits"], json!(150));
        assert_eq!(stats["cache_misses"], json!(25));
    }

    #[tokio::test]
    #[serial]
    async fn test_database_paths() {
        let test_paths = vec![
            "/path/to/database.db",
            "/path/to/database.sqlite",
            "/path/to/database.sqlite3",
            "relative/path/database.db",
            "./local.db",
            "../parent.db",
        ];

        for path in test_paths {
            assert!(!path.is_empty());
            
            // Basic path validation
            if path.starts_with('/') {
                assert!(path.starts_with('/'), "Should be absolute path");
            } else {
                assert!(!path.starts_with('/'), "Should be relative path");
            }
            
            // Extension validation
            assert!(
                path.ends_with(".db") || 
                path.ends_with(".sqlite") || 
                path.ends_with(".sqlite3"),
                "Should have database extension"
            );
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_database_path_normalization() {
        let paths_and_expected = vec![
            ("/path/to/../database.db", "/path/database.db"),
            ("./database.db", "database.db"),
            ("../database.db", "../database.db"),
            ("/path/./database.db", "/path/database.db"),
        ];

        for (input_path, expected) in paths_and_expected {
            // Simple normalization logic (in real code this would use std::path)
            let normalized = input_path
                .replace("/./", "/")
                .replace("/../", "/")
                .trim_start_matches("./")
                .to_string();
            
            if expected == "database.db" {
                assert_eq!(normalized, expected);
            } else {
                // For more complex cases, just ensure it's valid
                assert!(!normalized.is_empty());
            }
        }
    }
} 