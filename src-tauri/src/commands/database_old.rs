// Database commands module
// Implements all database-related IPC commands matching Electron behavior

use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqlitePool, Row, Column, ValueRef, TypeInfo};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{State};
use tokio::sync::RwLock;
use base64::{Engine as _, engine::general_purpose};

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

// Helper function to get default value based on column type
fn get_default_value_for_type(type_name: &str) -> serde_json::Value {
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

// Database commands

#[tauri::command]
pub async fn db_open(
    state: State<'_, DbPool>,
    file_path: String,
) -> Result<DbResponse<String>, String> {
    log::info!("Opening database: {}", file_path);
    
    // Close existing connection if any
    {
        let mut pool_guard = state.write().await;
        if let Some(pool) = pool_guard.take() {
            pool.close().await;
        }
    }
    
    // Open new connection
    match SqlitePool::connect(&format!("sqlite:{}", file_path)).await {
        Ok(pool) => {
            *state.write().await = Some(pool);
            Ok(DbResponse {
                success: true,
                data: Some(file_path.clone()),
                error: None,
            })
        }
        Err(e) => {
            log::error!("Failed to open database: {}", e);
            Ok(DbResponse {
                success: false,
                data: None,
                error: Some(format!("Could not connect to database: {}", e)),
            })
        }
    }
}

#[tauri::command]
pub async fn db_get_tables(
    state: State<'_, DbPool>,
) -> Result<DbResponse<Vec<TableInfo>>, String> {
    let pool_guard = state.read().await;
    let pool = match pool_guard.as_ref() {
        Some(pool) => pool,
        None => {
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some("No database connection".to_string()),
            });
        }
    };
    
    match sqlx::query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .fetch_all(pool)
        .await
    {
        Ok(rows) => {
            let tables: Vec<TableInfo> = rows
                .iter()
                .map(|row| TableInfo {
                    name: row.get::<String, _>("name"),
                })
                .collect();
            
            Ok(DbResponse {
                success: true,
                data: Some(tables),
                error: None,
            })
        }
        Err(e) => {
            log::error!("Error getting tables: {}", e);
            Ok(DbResponse {
                success: false,
                data: None,
                error: Some(format!("Error getting tables: {}", e)),
            })
        }
    }
}

#[tauri::command]
pub async fn db_get_table_data(
    state: State<'_, DbPool>,
    table_name: String,
) -> Result<DbResponse<TableData>, String> {
    let pool_guard = state.read().await;
    let pool = match pool_guard.as_ref() {
        Some(pool) => pool,
        None => {
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some("No database connection".to_string()),
            });
        }
    };
    
    // Get column info
    let column_query = format!("PRAGMA table_info({})", table_name);
    let column_rows = match sqlx::query(&column_query).fetch_all(pool).await {
        Ok(rows) => rows,
        Err(e) => {
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some(format!("Error getting table info: {}", e)),
            });
        }
    };
    
    let columns: Vec<ColumnInfo> = column_rows
        .iter()
        .map(|row| ColumnInfo {
            name: row.get::<String, _>("name"),
            type_name: row.get::<String, _>("type"),
            notnull: row.get::<i64, _>("notnull") != 0,
            pk: row.get::<i64, _>("pk") != 0,
            default_value: get_default_value_for_type(&row.get::<String, _>("type")),
        })
        .collect();
    
    // Get table data
    let data_query = format!("SELECT * FROM {}", table_name);
    let data_rows = match sqlx::query(&data_query).fetch_all(pool).await {
        Ok(rows) => rows,
        Err(e) => {
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some(format!("Error getting table data: {}", e)),
            });
        }
    };
    
    let mut rows = Vec::new();
    for row in data_rows {
        let mut row_data = HashMap::new();
        for (i, column) in row.columns().iter().enumerate() {
            let value = match row.try_get_raw(i) {
                Ok(raw_value) => {
                    if raw_value.is_null() {
                        serde_json::Value::Null
                    } else {
                        match column.type_info().name() {
                            "TEXT" => serde_json::Value::String(row.get::<String, _>(i)),
                            "INTEGER" => serde_json::Value::Number(
                                serde_json::Number::from(row.get::<i64, _>(i))
                            ),
                            "REAL" => serde_json::Value::Number(
                                serde_json::Number::from_f64(row.get::<f64, _>(i))
                                    .unwrap_or(serde_json::Number::from(0))
                            ),
                            "BLOB" => {
                                let blob_data: Vec<u8> = row.get(i);
                                serde_json::Value::String(
                                    general_purpose::STANDARD.encode(blob_data)
                                )
                            },
                            _ => serde_json::Value::String(
                                "Unknown type".to_string()
                            ),
                        }
                    }
                }
                Err(_) => serde_json::Value::Null,
            };
            row_data.insert(column.name().to_string(), value);
        }
        rows.push(row_data);
    }
    
    Ok(DbResponse {
        success: true,
        data: Some(TableData { columns, rows }),
        error: None,
    })
}

#[tauri::command]
pub async fn db_get_info(
    file_path: String,
) -> Result<DbResponse<DbInfo>, String> {
    match std::fs::metadata(&file_path) {
        Ok(metadata) => {
            let pool = match SqlitePool::connect(&format!("sqlite:{}", file_path)).await {
                Ok(pool) => pool,
                Err(e) => {
                    return Ok(DbResponse {
                        success: false,
                        data: None,
                        error: Some(format!("Failed to connect to database: {}", e)),
                    });
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
                    
                    Ok(DbResponse {
                        success: true,
                        data: Some(DbInfo {
                            path: file_path,
                            size: metadata.len(),
                            tables,
                        }),
                        error: None,
                    })
                }
                Err(e) => Ok(DbResponse {
                    success: false,
                    data: None,
                    error: Some(format!("Error getting database info: {}", e)),
                })
            }
        }
        Err(e) => Ok(DbResponse {
            success: false,
            data: None,
            error: Some(format!("Error reading file: {}", e)),
        })
    }
}

#[tauri::command]
pub async fn db_update_table_row(
    state: State<'_, DbPool>,
    table_name: String,
    row: HashMap<String, serde_json::Value>,
    condition: String,
) -> Result<DbResponse<u64>, String> {
    let pool_guard = state.read().await;
    let pool = match pool_guard.as_ref() {
        Some(pool) => pool,
        None => {
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some("No database connection".to_string()),
            });
        }
    };
    
    let columns: Vec<String> = row.keys().cloned().collect();
    let set_clause = columns.iter()
        .map(|col| format!("{} = ?", col))
        .collect::<Vec<_>>()
        .join(", ");
    
    let query = format!("UPDATE {} SET {} WHERE {}", table_name, set_clause, condition);
    
    let mut query_builder = sqlx::query(&query);
    for col in &columns {
        if let Some(value) = row.get(col) {
            query_builder = match value {
                serde_json::Value::String(s) => query_builder.bind(s),
                serde_json::Value::Number(n) => {
                    if n.is_i64() {
                        query_builder.bind(n.as_i64().unwrap())
                    } else {
                        query_builder.bind(n.as_f64().unwrap())
                    }
                },
                serde_json::Value::Bool(b) => query_builder.bind(*b),
                serde_json::Value::Null => query_builder.bind(None::<String>),
                _ => query_builder.bind(value.to_string()),
            };
        }
    }
    
    match query_builder.execute(pool).await {
        Ok(result) => Ok(DbResponse {
            success: true,
            data: Some(result.rows_affected()),
            error: None,
        }),
        Err(e) => {
            log::error!("Error updating row: {}", e);
            Ok(DbResponse {
                success: false,
                data: None,
                error: Some(format!("Error updating row: {}", e)),
            })
        }
    }
}

#[tauri::command]
pub async fn db_insert_table_row(
    state: State<'_, DbPool>,
    table_name: String,
    row: HashMap<String, serde_json::Value>,
) -> Result<DbResponse<i64>, String> {
    let pool_guard = state.read().await;
    let pool = match pool_guard.as_ref() {
        Some(pool) => pool,
        None => {
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some("No database connection".to_string()),
            });
        }
    };
    
    let columns: Vec<String> = row.keys().cloned().collect();
    let placeholders = vec!["?"; columns.len()].join(", ");
    let columns_str = columns.join(", ");
    
    let query = format!("INSERT INTO {} ({}) VALUES ({})", table_name, columns_str, placeholders);
    
    let mut query_builder = sqlx::query(&query);
    for col in &columns {
        if let Some(value) = row.get(col) {
            query_builder = match value {
                serde_json::Value::String(s) => query_builder.bind(s),
                serde_json::Value::Number(n) => {
                    if n.is_i64() {
                        query_builder.bind(n.as_i64().unwrap())
                    } else {
                        query_builder.bind(n.as_f64().unwrap())
                    }
                },
                serde_json::Value::Bool(b) => query_builder.bind(*b),
                serde_json::Value::Null => query_builder.bind(None::<String>),
                _ => query_builder.bind(value.to_string()),
            };
        }
    }
    
    match query_builder.execute(pool).await {
        Ok(result) => Ok(DbResponse {
            success: true,
            data: Some(result.last_insert_rowid()),
            error: None,
        }),
        Err(e) => {
            log::error!("Error inserting row: {}", e);
            Ok(DbResponse {
                success: false,
                data: None,
                error: Some(format!("Error inserting row: {}", e)),
            })
        }
    }
}

#[tauri::command]
pub async fn db_add_new_row_with_defaults(
    state: State<'_, DbPool>,
    table_name: String,
) -> Result<DbResponse<i64>, String> {
    let pool_guard = state.read().await;
    let pool = match pool_guard.as_ref() {
        Some(pool) => pool,
        None => {
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some("No database connection".to_string()),
            });
        }
    };
    
    // Use INSERT with DEFAULT VALUES to let SQLite handle defaults
    let query = format!("INSERT INTO {} DEFAULT VALUES", table_name);
    
    match sqlx::query(&query).execute(pool).await {
        Ok(result) => Ok(DbResponse {
            success: true,
            data: Some(result.last_insert_rowid()),
            error: None,
        }),
        Err(e) => {
            log::error!("Error inserting row with defaults: {}", e);
            Ok(DbResponse {
                success: false,
                data: None,
                error: Some(format!("Error inserting row with defaults: {}", e)),
            })
        }
    }
}

#[tauri::command]
pub async fn db_delete_table_row(
    state: State<'_, DbPool>,
    table_name: String,
    condition: String,
) -> Result<DbResponse<u64>, String> {
    let pool_guard = state.read().await;
    let pool = match pool_guard.as_ref() {
        Some(pool) => pool,
        None => {
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some("No database connection".to_string()),
            });
        }
    };
    
    // Validate inputs
    if table_name.trim().is_empty() {
        return Ok(DbResponse {
            success: false,
            data: None,
            error: Some("Table name cannot be empty".to_string()),
        });
    }
    
    if condition.trim().is_empty() {
        return Ok(DbResponse {
            success: false,
            data: None,
            error: Some("Delete condition cannot be empty".to_string()),
        });
    }
    
    let query = format!("DELETE FROM {} WHERE {}", table_name, condition);
    log::info!("Executing delete query: {}", query);
    
    match sqlx::query(&query).execute(pool).await {
        Ok(result) => {
            let rows_affected = result.rows_affected();
            log::info!("Delete successful, rows affected: {}", rows_affected);
            Ok(DbResponse {
                success: true,
                data: Some(rows_affected),
                error: None,
            })
        },
        Err(e) => {
            log::error!("Error deleting row: {}", e);
            Ok(DbResponse {
                success: false,
                data: None,
                error: Some(format!("Error deleting row: {}", e)),
            })
        }
    }
}

#[tauri::command]
pub async fn db_execute_query(
    state: State<'_, DbPool>,
    query: String,
    _db_path: String,
    _params: Option<Vec<serde_json::Value>>,
) -> Result<DbResponse<serde_json::Value>, String> {
    let pool_guard = state.read().await;
    let pool = match pool_guard.as_ref() {
        Some(pool) => pool,
        None => {
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some("No database connection".to_string()),
            });
        }
    };
    
    let is_select = query.trim().to_uppercase().starts_with("SELECT");
    
    if is_select {
        match sqlx::query(&query).fetch_all(pool).await {
            Ok(rows) => {
                let mut result_rows = Vec::new();
                let mut columns = Vec::new();
                
                if !rows.is_empty() {
                    // Get column names
                    for column in rows[0].columns() {
                        columns.push(serde_json::json!({
                            "name": column.name(),
                            "type": ""
                        }));
                    }
                    
                    // Get row data
                    for row in rows {
                        let mut row_data = HashMap::new();
                        for (i, column) in row.columns().iter().enumerate() {
                            let value = match row.try_get_raw(i) {
                                Ok(raw_value) => {
                                    if raw_value.is_null() {
                                        serde_json::Value::Null
                                    } else {
                                        match column.type_info().name() {
                                            "TEXT" => serde_json::Value::String(row.get::<String, _>(i)),
                                            "INTEGER" => serde_json::Value::Number(
                                                serde_json::Number::from(row.get::<i64, _>(i))
                                            ),
                                            "REAL" => serde_json::Value::Number(
                                                serde_json::Number::from_f64(row.get::<f64, _>(i))
                                                    .unwrap_or(serde_json::Number::from(0))
                                            ),
                                            _ => serde_json::Value::String(row.get::<String, _>(i)),
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
                
                Ok(DbResponse {
                    success: true,
                    data: Some(serde_json::json!({
                        "rows": result_rows,
                        "columns": columns
                    })),
                    error: None,
                })
            }
            Err(e) => {
                log::error!("Error executing query: {}", e);
                Ok(DbResponse {
                    success: false,
                    data: None,
                    error: Some(format!("Error executing query: {}", e)),
                })
            }
        }
    } else {
        match sqlx::query(&query).execute(pool).await {
            Ok(result) => Ok(DbResponse {
                success: true,
                data: Some(serde_json::json!({
                    "changes": result.rows_affected(),
                    "lastID": result.last_insert_rowid()
                })),
                error: None,
            }),
            Err(e) => {
                log::error!("Error executing query: {}", e);
                Ok(DbResponse {
                    success: false,
                    data: None,
                    error: Some(format!("Error executing query: {}", e)),
                })
            }
        }
    }
}
