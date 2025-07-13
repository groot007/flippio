// Database helpers - exact copy from original database.rs
use serde_json;

// Helper function to get default value based on column type
pub fn get_default_value_for_type(type_name: &str) -> serde_json::Value {
    match type_name.to_uppercase().as_str() {
        "INTEGER" | "INT" | "BIGINT" | "SMALLINT" | "TINYINT" => {
            serde_json::Value::Number(serde_json::Number::from(0))
        },
        "REAL" | "FLOAT" | "DOUBLE" | "NUMERIC" | "DECIMAL" => {
            serde_json::Value::Number(serde_json::Number::from_f64(0.0).unwrap())
        },
        "TEXT" | "VARCHAR" | "CHAR" | "STRING" => {
            serde_json::Value::String("".to_string())
        },
        "BLOB" | "BINARY" => {
            serde_json::Value::String("".to_string()) // Empty base64 string for blobs
        },
        "BOOLEAN" | "BOOL" => {
            serde_json::Value::Bool(false)
        },
        "DATE" | "DATETIME" | "TIMESTAMP" => {
            serde_json::Value::Null // For date types, use null as default
        },
        _ => {
            // For unknown types, default to empty string
            serde_json::Value::String("".to_string())
        }
    }
}
