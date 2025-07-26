// Database commands - enhanced with connection caching
use crate::commands::database::types::*;
use crate::commands::database::helpers::{get_default_value_for_type, ensure_database_file_permissions};
use serde_json;
use sqlx::{sqlite::SqlitePool, Row, Column, ValueRef, TypeInfo};
use std::collections::HashMap;
use tauri::State;
use base64::{Engine as _, engine::general_purpose};

// Database commands

#[tauri::command]
pub async fn db_open(
    state: State<'_, DbPool>,
    db_cache: State<'_, DbConnectionCache>,
    file_path: String,
) -> Result<DbResponse<String>, String> {
    log::info!("Opening database with caching: {}", file_path);
    
    // Try to get connection from cache
    match get_cached_connection(&db_cache, &file_path).await {
        Ok(pool) => {
            // Update legacy state for backward compatibility
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
                error: Some(e),
            })
        }
    }
}

#[tauri::command]
pub async fn db_get_tables(
    state: State<'_, DbPool>,
    db_cache: State<'_, DbConnectionCache>,
    current_db_path: Option<String>,
) -> Result<DbResponse<Vec<TableInfo>>, String> {
    // Get the current pool using the helper function
    let pool = match get_current_pool(&state, &db_cache, current_db_path).await {
        Ok(pool) => pool,
        Err(e) => {
            log::error!("❌ {}", e);
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some(e),
            });
        }
    };
    
    match sqlx::query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .fetch_all(&pool)
        .await
    {
        Ok(rows) => {
            let tables: Vec<TableInfo> = rows
                .iter()
                .map(|row| TableInfo {
                    name: row.get::<String, &str>("name"),
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
    db_cache: State<'_, DbConnectionCache>,
    table_name: String,
    current_db_path: Option<String>,
) -> Result<DbResponse<TableData>, String> {
    log::info!("📊 Getting table data for: {}", table_name);
    
    // Get the current pool using the helper function
    let pool = match get_current_pool(&state, &db_cache, current_db_path).await {
        Ok(pool) => pool,
        Err(e) => {
            log::error!("❌ {}", e);
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some(e),
            });
        }
    };
    
    // First, verify the table exists
    let table_exists_query = "SELECT name FROM sqlite_master WHERE type='table' AND name = ?";
    match sqlx::query(table_exists_query)
        .bind(&table_name)
        .fetch_optional(&pool)
        .await
    {
        Ok(Some(_)) => {
            log::info!("✅ Table '{}' exists", table_name);
        }
        Ok(None) => {
            log::error!("❌ Table '{}' does not exist", table_name);
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some(format!("Table '{}' does not exist", table_name)),
            });
        }
        Err(e) => {
            log::error!("❌ Error checking if table exists: {}", e);
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some(format!("Error checking table existence: {}", e)),
            });
        }
    }
    
    // Get column information
    let column_query = format!("PRAGMA table_info({})", table_name);
    let column_rows = match sqlx::query(&column_query).fetch_all(&pool).await {
        Ok(rows) => {
            log::info!("✅ Retrieved {} columns for table '{}'", rows.len(), table_name);
            rows
        }
        Err(e) => {
            log::error!("❌ Error getting table info for '{}': {}", table_name, e);
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
    let data_rows = match sqlx::query(&data_query).fetch_all(&pool).await {
        Ok(rows) => {
            log::info!("✅ Retrieved {} rows from table '{}'", rows.len(), table_name);
            rows
        }
        Err(e) => {
            log::error!("❌ Error getting table data for '{}': {}", table_name, e);
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
    
    log::info!("✅ Successfully processed table data for '{}': {} columns, {} rows", table_name, columns.len(), rows.len());
    
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
    db_cache: State<'_, DbConnectionCache>,
    table_name: String,
    row: HashMap<String, serde_json::Value>,
    condition: String,
    current_db_path: Option<String>,
) -> Result<DbResponse<u64>, String> {
    // Get the current pool using the helper function
    let pool = match get_current_pool(&state, &db_cache, current_db_path).await {
        Ok(pool) => pool,
        Err(e) => {
            log::error!("❌ {}", e);
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some(e),
            });
        }
    };
    
    // Build the UPDATE query
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
                    if let Some(int_val) = n.as_i64() {
                        query_builder.bind(int_val)
                    } else if let Some(float_val) = n.as_f64() {
                        query_builder.bind(float_val)
                    } else {
                        log::error!("Error binding value for column '{}': Invalid number format", col);
                        return Ok(DbResponse {
                            success: false,
                            data: None,
                            error: Some(format!("Error binding value for column '{}': Invalid number format", col)),
                        });
                    }
                },
                serde_json::Value::Bool(b) => query_builder.bind(b),
                serde_json::Value::Null => query_builder.bind(None::<String>),
                _ => query_builder.bind(value.to_string()),
            };
        }
    }
    
    match query_builder.execute(&pool).await {
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
    db_cache: State<'_, DbConnectionCache>,
    table_name: String,
    row: HashMap<String, serde_json::Value>,
    current_db_path: Option<String>,
) -> Result<DbResponse<i64>, String> {
    // Get the current pool using the helper function
    let pool = match get_current_pool(&state, &db_cache, current_db_path).await {
        Ok(pool) => pool,
        Err(e) => {
            log::error!("❌ {}", e);
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some(e),
            });
        }
    };
    
    // Build the INSERT query
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
                    if let Some(int_val) = n.as_i64() {
                        query_builder.bind(int_val)
                    } else if let Some(float_val) = n.as_f64() {
                        query_builder.bind(float_val)
                    } else {
                        log::error!("Error binding value for column '{}': Invalid number format", col);
                        return Ok(DbResponse {
                            success: false,
                            data: None,
                            error: Some(format!("Error binding value for column '{}': Invalid number format", col)),
                        });
                    }
                },
                serde_json::Value::Bool(b) => query_builder.bind(b),
                serde_json::Value::Null => query_builder.bind(None::<String>),
                _ => query_builder.bind(value.to_string()),
            };
        }
    }
    
    match query_builder.execute(&pool).await {
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
    db_cache: State<'_, DbConnectionCache>,
    table_name: String,
    current_db_path: Option<String>,
) -> Result<DbResponse<i64>, String> {
    // Get the current pool using the helper function
    let pool = match get_current_pool(&state, &db_cache, current_db_path).await {
        Ok(pool) => pool,
        Err(e) => {
            log::error!("❌ {}", e);
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some(e),
            });
        }
    };
    
    // Use INSERT with DEFAULT VALUES
    let query = format!("INSERT INTO {} DEFAULT VALUES", table_name);
    
    match sqlx::query(&query).execute(&pool).await {
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
    db_cache: State<'_, DbConnectionCache>,
    table_name: String,
    condition: String,
    current_db_path: Option<String>,
) -> Result<DbResponse<u64>, String> {
    // Get the current pool using the helper function
    let pool = match get_current_pool(&state, &db_cache, current_db_path).await {
        Ok(pool) => pool,
        Err(e) => {
            log::error!("❌ {}", e);
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some(e),
            });
        }
    };
    
    // Safety checks
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
    
    match sqlx::query(&query).execute(&pool).await {
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
    db_cache: State<'_, DbConnectionCache>,
    query: String,
    _db_path: String,
    _params: Option<Vec<serde_json::Value>>,
    current_db_path: Option<String>,
) -> Result<DbResponse<serde_json::Value>, String> {
    // Get the current pool using the helper function
    let pool = match get_current_pool(&state, &db_cache, current_db_path).await {
        Ok(pool) => pool,
        Err(e) => {
            log::error!("❌ {}", e);
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some(e),
            });
        }
    };
    
    let is_select = query.trim().to_uppercase().starts_with("SELECT");
    
    if is_select {
        // Handle SELECT queries
        match sqlx::query(&query).fetch_all(&pool).await {
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
        // Handle non-SELECT queries (INSERT, UPDATE, DELETE, etc.)
        match sqlx::query(&query).execute(&pool).await {
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

/// Get database connection statistics
#[tauri::command]
pub async fn db_get_connection_stats(
    db_cache: State<'_, DbConnectionCache>,
) -> Result<DbResponse<HashMap<String, serde_json::Value>>, String> {
    let cache_guard = db_cache.read().await;
    let mut stats = HashMap::new();
    
    stats.insert("total_connections".to_string(), serde_json::Value::from(cache_guard.len()));
    
    let connection_details: Vec<serde_json::Value> = cache_guard
        .iter()
        .map(|(path, conn)| {
            serde_json::json!({
                "path": path,
                "age_seconds": conn.created_at.elapsed().as_secs(),
                "last_used_seconds_ago": conn.last_used.elapsed().as_secs()
            })
        })
        .collect();
        
    stats.insert("connections".to_string(), serde_json::Value::Array(connection_details));
    
    Ok(DbResponse {
        success: true,
        data: Some(stats),
        error: None,
    })
}

/// Get or create a database connection from cache
async fn get_cached_connection(
    db_cache: &DbConnectionCache,
    db_path: &str,
) -> Result<SqlitePool, String> {
    let normalized_path = match std::fs::canonicalize(db_path) {
        Ok(absolute_path) => absolute_path.to_string_lossy().to_string(),
        Err(_) => db_path.to_string(),
    };
    
    // Try to get existing connection from cache
    {
        let mut cache_guard = db_cache.write().await;
        
        if let Some(cached_conn) = cache_guard.get_mut(&normalized_path) {
            // Check if connection is still valid (5 minutes TTL)
            if !cached_conn.is_expired(std::time::Duration::from_secs(300)) {
                cached_conn.update_last_used();
                log::info!("📦 Reusing cached connection for: {}", normalized_path);
                return Ok(cached_conn.pool.clone());
            } else {
                log::info!("⏰ Cached connection expired for: {}", normalized_path);
                cached_conn.pool.close().await;
                cache_guard.remove(&normalized_path);
            }
        }
    }

    // Create new connection
    log::info!("🔗 Creating new connection for: {}", normalized_path);
    
    // Validate file exists
    if !std::path::Path::new(&normalized_path).exists() {
        return Err(format!("Database file does not exist: {}", normalized_path));
    }

    // Ensure file permissions are correct
    ensure_database_file_permissions(&normalized_path)?;

    let pool = match SqlitePool::connect(&format!("sqlite:{}?mode=rwc", normalized_path)).await {
        Ok(pool) => {
            log::info!("✅ Successfully connected to database: {}", normalized_path);
            pool
        }
        Err(e) => {
            log::error!("❌ Failed to connect to database '{}': {}", normalized_path, e);
            return Err(format!("Could not connect to database: {}", e));
        }
    };
    
    // Add to cache
    {
        let mut cache_guard = db_cache.write().await;
        
        // Check cache size limit (10 connections max)
        if cache_guard.len() >= 10 {
            // Remove oldest connection
            if let Some((oldest_path, _)) = cache_guard
                .iter()
                .min_by_key(|(_, conn)| conn.last_used)
                .map(|(path, conn)| (path.clone(), conn.clone()))
            {
                log::info!("🧹 Removing oldest cached connection: {}", oldest_path);
                if let Some(removed_conn) = cache_guard.remove(&oldest_path) {
                    removed_conn.pool.close().await;
                }
            }
        }
        
        cache_guard.insert(normalized_path.clone(), CachedConnection::new(pool.clone()));
    }

    Ok(pool)
}

// Helper function to get the current active database from cache or state
async fn get_current_pool(
    state: &State<'_, DbPool>,
    db_cache: &State<'_, DbConnectionCache>,
    current_db_path: Option<String>,
) -> Result<SqlitePool, String> {
    // If path is provided, try to get from cache first
    if let Some(db_path) = current_db_path {
        match get_cached_connection(db_cache, &db_path).await {
            Ok(cached_pool) => {
                log::info!("✅ Using cached connection for: {}", db_path);
                return Ok(cached_pool);
            }
            Err(e) => {
                log::warn!("⚠️ Failed to get cached connection: {}", e);
            }
        }
    }
    
    // Try to find any active connection in cache
    {
        let cache_guard = db_cache.read().await;
        if let Some((path, cached_conn)) = cache_guard.iter().next() {
            if !cached_conn.is_expired(std::time::Duration::from_secs(300)) {
                log::info!("✅ Using cached connection from cache: {}", path);
                return Ok(cached_conn.pool.clone());
            }
        }
    }
    
    // Fallback to legacy pool
    let pool_guard = state.read().await;
    match pool_guard.as_ref() {
        Some(pool) => {
            log::info!("✅ Using legacy pool connection");
            Ok(pool.clone())
        }
        None => {
            Err("No database connection available".to_string())
        }
    }
}
