// Database types - exact copy from original database.rs
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use sqlx::sqlite::SqlitePool;

// Database connection state
pub type DbPool = Arc<RwLock<Option<SqlitePool>>>;

// Response types matching Electron IPC responses
#[derive(Debug, Serialize, Deserialize)]
pub struct DbResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TableInfo {
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub type_name: String,
    pub notnull: bool,
    pub pk: bool,
    #[serde(rename = "defaultValue")]
    pub default_value: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TableData {
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DbInfo {
    pub path: String,
    pub size: u64,
    pub tables: Vec<TableInfo>,
}
