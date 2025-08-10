// Database commands - enhanced with connection caching
use crate::commands::database::types::*;
use crate::commands::database::helpers::{get_default_value_for_type, ensure_database_file_permissions};
use crate::commands::database::change_history::{
    capture_old_values_for_update, extract_context_from_path,
    record_change_with_safety, create_change_event, OperationType
};
use crate::commands::database::change_tracking::{
    create_field_changes_optimized, extract_row_values
};
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

/// Helper function to validate that a pool is actually usable
async fn validate_pool_health(pool: &SqlitePool) -> bool {
    if pool.is_closed() {
        log::warn!("🚫 Pool is marked as closed");
        return false;
    }
    
    // Try a simple query to verify the connection is actually working
    match sqlx::query("SELECT 1").fetch_one(pool).await {
        Ok(_) => {
            log::debug!("✅ Pool health check passed");
            true
        }
        Err(e) => {
            log::warn!("🚫 Pool health check failed: {}", e);
            false
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
    let mut pool = match get_current_pool(&state, &db_cache, current_db_path.clone()).await {
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
    
    // Validate pool health before using it
    if !validate_pool_health(&pool).await {
        log::warn!("🔄 Pool failed health check, attempting to get fresh connection");
        match get_current_pool(&state, &db_cache, current_db_path.clone()).await {
            Ok(fresh_pool) => {
                if validate_pool_health(&fresh_pool).await {
                    log::info!("✅ Fresh pool passed health check");
                    pool = fresh_pool;
                } else {
                    log::error!("❌ Even fresh pool failed health check");
                    return Ok(DbResponse {
                        success: false,
                        data: None,
                        error: Some("Unable to establish a working database connection".to_string()),
                    });
                }
            }
            Err(e) => {
                log::error!("❌ Failed to get fresh connection: {}", e);
                return Ok(DbResponse {
                    success: false,
                    data: None,
                    error: Some(format!("Connection error: {}", e)),
                });
            }
        }
    }
    
    // First, verify the table exists
    let table_exists_query = "SELECT name FROM sqlite_master WHERE type='table' AND name = ?";
    let table_check_result = sqlx::query(table_exists_query)
        .bind(&table_name)
        .fetch_optional(&pool)
        .await;
    
    // Handle table existence check
    match table_check_result {
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
    
    log::info!("📊 Reading table data from database: {}", current_db_path.as_deref().unwrap_or("unknown"));
    
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
                            "TEXT" => {
                                match row.try_get::<String, _>(i) {
                                    Ok(val) => serde_json::Value::String(val),
                                    Err(_) => serde_json::Value::String("".to_string()),
                                }
                            },
                            "INTEGER" => {
                                match row.try_get::<i64, _>(i) {
                                    Ok(val) => serde_json::Value::Number(serde_json::Number::from(val)),
                                    Err(_) => {
                                        // Try as string first, then convert to number if possible
                                        match row.try_get::<String, _>(i) {
                                            Ok(str_val) => {
                                                if let Ok(int_val) = str_val.parse::<i64>() {
                                                    serde_json::Value::Number(serde_json::Number::from(int_val))
                                                } else {
                                                    serde_json::Value::String(str_val)
                                                }
                                            },
                                            Err(_) => serde_json::Value::Null,
                                        }
                                    }
                                }
                            },
                            "REAL" => {
                                match row.try_get::<f64, _>(i) {
                                    Ok(val) => serde_json::Value::Number(
                                        serde_json::Number::from_f64(val).unwrap_or(serde_json::Number::from(0))
                                    ),
                                    Err(_) => {
                                        // Try as string first, then convert to number if possible
                                        match row.try_get::<String, _>(i) {
                                            Ok(str_val) => {
                                                if let Ok(float_val) = str_val.parse::<f64>() {
                                                    serde_json::Value::Number(
                                                        serde_json::Number::from_f64(float_val).unwrap_or(serde_json::Number::from(0))
                                                    )
                                                } else {
                                                    serde_json::Value::String(str_val)
                                                }
                                            },
                                            Err(_) => serde_json::Value::Null,
                                        }
                                    }
                                }
                            },
                            "BLOB" => {
                                match row.try_get::<Vec<u8>, _>(i) {
                                    Ok(blob_data) => serde_json::Value::String(
                                        general_purpose::STANDARD.encode(blob_data)
                                    ),
                                    Err(_) => serde_json::Value::String("".to_string()),
                                }
                            },
                            _ => {
                                match row.try_get::<String, _>(i) {
                                    Ok(val) => serde_json::Value::String(val),
                                    Err(_) => serde_json::Value::String("Unknown type".to_string()),
                                }
                            },
                        }
                    }
                }
                Err(_) => serde_json::Value::Null,
            };
            row_data.insert(column.name().to_string(), value);
        }
        rows.push(row_data);
    }
    
    log::info!("✅ Successfully processed table data for '{}' from database '{}': {} columns, {} rows", 
               table_name, 
               current_db_path.as_deref().unwrap_or("unknown"),
               columns.len(), 
               rows.len());
    
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
    change_history: State<'_, super::change_history::ChangeHistoryManager>,
    table_name: String,
    row: HashMap<String, serde_json::Value>,
    condition: String,
    current_db_path: Option<String>,
    // Context information for change tracking (optional for backward compatibility)
    device_id: Option<String>,
    device_name: Option<String>,
    device_type: Option<String>,
    package_name: Option<String>,
    app_name: Option<String>,
) -> Result<DbResponse<u64>, String> {
    // Validate that we have a specific database path for write operations
    let db_path = match current_db_path.clone() {
        Some(path) => {
            log::info!("📝 UPDATE operation for table '{}' on database: {}", table_name, path);
            path
        }
        None => {
            log::error!("❌ UPDATE operation requires a specific database path");
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some("UPDATE operation requires a specific database path - no database selected".to_string()),
            });
        }
    };

    // Get the current pool using the helper function
    let pool = match get_current_pool(&state, &db_cache, current_db_path.clone()).await {
        Ok(pool) => pool,
        Err(e) => {
            log::error!("❌ Failed to get connection for UPDATE operation: {}", e);
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some(format!("Database connection error: {}", e)),
            });
        }
    };
    
    // Ensure database file permissions are correct before write operation
    if let Err(permission_error) = ensure_database_file_permissions(&db_path) {
        log::error!("❌ Failed to ensure database permissions: {}", permission_error);
        return Ok(DbResponse {
            success: false,
            data: None,
            error: Some(format!("Database permission error: {}", permission_error)),
        });
    }
    
    // Build the UPDATE query
    let columns: Vec<String> = row.keys().cloned().collect();
    let set_clause = columns.iter().map(|col| format!("{} = ?", col)).collect::<Vec<_>>().join(", ");
    let query = format!("UPDATE {} SET {} WHERE {}", table_name, set_clause, condition);
    
    log::info!("🔧 Executing UPDATE query on database '{}': {}", db_path, query);
    
    // PHASE 2: Capture old values for change tracking (non-fatal if fails)
    let old_values = match capture_old_values_for_update(&pool, &table_name, &condition, &columns).await {
        Ok(values) => {
            log::debug!("📝 Captured old values for change tracking");
            Some(values)
        }
        Err(e) => {
            log::warn!("⚠️ Failed to capture old values for change tracking (non-fatal): {}", e);
            None
        }
    };
    
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
        Ok(result) => {
            let rows_affected = result.rows_affected();
            log::info!("✅ UPDATE successful on database '{}': {} rows affected", db_path, rows_affected);
            
            // PHASE 2: Record change in history (non-fatal if fails)
            if let Some(old_vals) = old_values {
                let user_context = extract_context_from_path(
                    &db_path,
                    device_id,
                    device_name,
                    device_type,
                    package_name,
                    app_name,
                );
                
                let field_changes = create_field_changes_optimized(
                    &OperationType::Update,
                    &old_vals,
                    &row
                );
                
                if !field_changes.is_empty() {
                    match create_change_event(
                        &db_path,
                        &table_name,
                        OperationType::Update,
                        user_context,
                        field_changes,
                        None, // TODO: Extract primary key from condition
                        Some(query.clone()),
                    ) {
                        Ok(change_event) => {
                            let _ = record_change_with_safety(&change_history, change_event).await;
                        }
                        Err(e) => {
                            log::warn!("⚠️ Failed to create change event (non-fatal): {}", e);
                        }
                    }
                } else {
                    log::debug!("📝 No field changes detected, skipping change record");
                }
            }
            
            Ok(DbResponse {
                success: true,
                data: Some(rows_affected),
                error: None,
            })
        }
        Err(e) => {
            log::error!("❌ UPDATE failed on database '{}': {}", db_path, e);
            
            // If it's a read-only error, try to fix permissions and retry once
            if e.to_string().contains("readonly database") || e.to_string().contains("attempt to write a readonly database") {
                log::warn!("🔄 Detected read-only database error, attempting to fix permissions and retry");
                
                match ensure_database_file_permissions(&db_path) {
                    Ok(()) => {
                        log::info!("✅ Fixed permissions, retrying UPDATE operation");
                        
                        // Rebuild the query for retry
                        let mut retry_query_builder = sqlx::query(&query);
                        for col in &columns {
                            if let Some(value) = row.get(col) {
                                retry_query_builder = match value {
                                    serde_json::Value::String(s) => retry_query_builder.bind(s),
                                    serde_json::Value::Number(n) => {
                                        if let Some(int_val) = n.as_i64() {
                                            retry_query_builder.bind(int_val)
                                        } else if let Some(float_val) = n.as_f64() {
                                            retry_query_builder.bind(float_val)
                                        } else {
                                            retry_query_builder.bind(value.to_string())
                                        }
                                    },
                                    serde_json::Value::Bool(b) => retry_query_builder.bind(b),
                                    serde_json::Value::Null => retry_query_builder.bind(None::<String>),
                                    _ => retry_query_builder.bind(value.to_string()),
                                };
                            }
                        }
                        
                        // Retry the operation once
                        match retry_query_builder.execute(&pool).await {
                            Ok(result) => {
                                let rows_affected = result.rows_affected();
                                log::info!("✅ UPDATE retry successful on database '{}': {} rows affected", db_path, rows_affected);
                                return Ok(DbResponse {
                                    success: true,
                                    data: Some(rows_affected),
                                    error: None,
                                });
                            }
                            Err(retry_error) => {
                                log::error!("❌ UPDATE failed even after permission fix: {}", retry_error);
                            }
                        }
                    }
                    Err(perm_error) => {
                        log::error!("❌ Failed to fix permissions: {}", perm_error);
                    }
                }
            }
            
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
    change_history: State<'_, super::change_history::ChangeHistoryManager>,
    table_name: String,
    row: HashMap<String, serde_json::Value>,
    current_db_path: Option<String>,
    // Context information for change tracking (optional for backward compatibility)
    device_id: Option<String>,
    device_name: Option<String>,
    device_type: Option<String>,
    package_name: Option<String>,
    app_name: Option<String>,
) -> Result<DbResponse<i64>, String> {
    // Validate that we have a specific database path for write operations
    let db_path = match current_db_path.clone() {
        Some(path) => {
            log::info!("📝 INSERT operation for table '{}' on database: {}", table_name, path);
            path
        }
        None => {
            log::error!("❌ INSERT operation requires a specific database path");
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some("INSERT operation requires a specific database path - no database selected".to_string()),
            });
        }
    };

    // Get the current pool using the helper function
    let pool = match get_current_pool(&state, &db_cache, current_db_path.clone()).await {
        Ok(pool) => pool,
        Err(e) => {
            log::error!("❌ Failed to get connection for INSERT operation: {}", e);
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some(format!("Database connection error: {}", e)),
            });
        }
    };
    
    // Ensure database file permissions are correct before write operation
    if let Err(permission_error) = ensure_database_file_permissions(&db_path) {
        log::error!("❌ Failed to ensure database permissions: {}", permission_error);
        return Ok(DbResponse {
            success: false,
            data: None,
            error: Some(format!("Database permission error: {}", permission_error)),
        });
    }
    
    // Build the INSERT query
    let columns: Vec<String> = row.keys().cloned().collect();
    let placeholders = vec!["?"; columns.len()].join(", ");
    let columns_str = columns.join(", ");
    let query = format!("INSERT INTO {} ({}) VALUES ({})", table_name, columns_str, placeholders);
    
    log::info!("🔧 Executing INSERT query on database '{}': {}", db_path, query);
    
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
        Ok(result) => {
            let row_id = result.last_insert_rowid();
            log::info!("✅ INSERT successful on database '{}': new row ID {}", db_path, row_id);
            
            // PHASE 2: Record change in history (non-fatal if fails)
            let user_context = extract_context_from_path(
                &db_path,
                device_id,
                device_name,
                device_type,
                package_name,
                app_name,
            );
            
            // For INSERT, all values are "new" values, no old values
            let empty_old_values = HashMap::new();
            let field_changes = create_field_changes_optimized(
                &OperationType::Insert,
                &empty_old_values,
                &row
            );
            
            if !field_changes.is_empty() {
                match create_change_event(
                    &db_path,
                    &table_name,
                    OperationType::Insert,
                    user_context,
                    field_changes,
                    Some(row_id.to_string()), // Use the inserted row ID as identifier
                    Some(query.clone()),
                ) {
                    Ok(change_event) => {
                        let _ = record_change_with_safety(&change_history, change_event).await;
                    }
                    Err(e) => {
                        log::warn!("⚠️ Failed to create change event for INSERT (non-fatal): {}", e);
                    }
                }
            }
            
            Ok(DbResponse {
                success: true,
                data: Some(row_id),
                error: None,
            })
        }
        Err(e) => {
            log::error!("❌ INSERT failed on database '{}': {}", db_path, e);
            
            // If it's a read-only error, try to fix permissions and retry once
            if e.to_string().contains("readonly database") || e.to_string().contains("attempt to write a readonly database") {
                log::warn!("🔄 Detected read-only database error, attempting to fix permissions and retry");
                
                match ensure_database_file_permissions(&db_path) {
                    Ok(()) => {
                        log::info!("✅ Fixed permissions, retrying INSERT operation");
                        
                        // Rebuild the query for retry
                        let mut retry_query_builder = sqlx::query(&query);
                        for col in &columns {
                            if let Some(value) = row.get(col) {
                                retry_query_builder = match value {
                                    serde_json::Value::String(s) => retry_query_builder.bind(s),
                                    serde_json::Value::Number(n) => {
                                        if let Some(int_val) = n.as_i64() {
                                            retry_query_builder.bind(int_val)
                                        } else if let Some(float_val) = n.as_f64() {
                                            retry_query_builder.bind(float_val)
                                        } else {
                                            retry_query_builder.bind(value.to_string())
                                        }
                                    },
                                    serde_json::Value::Bool(b) => retry_query_builder.bind(b),
                                    serde_json::Value::Null => retry_query_builder.bind(None::<String>),
                                    _ => retry_query_builder.bind(value.to_string()),
                                };
                            }
                        }
                        
                        // Retry the operation once
                        match retry_query_builder.execute(&pool).await {
                            Ok(result) => {
                                let row_id = result.last_insert_rowid();
                                log::info!("✅ INSERT retry successful on database '{}': new row ID {}", db_path, row_id);
                                return Ok(DbResponse {
                                    success: true,
                                    data: Some(row_id),
                                    error: None,
                                });
                            }
                            Err(retry_error) => {
                                log::error!("❌ INSERT failed even after permission fix: {}", retry_error);
                                
                                // If still failing, try to reset WAL mode as a last resort
                                if retry_error.to_string().contains("readonly database") {
                                    log::warn!("🔄 Attempting WAL file cleanup as final retry");
                                    match crate::commands::database::helpers::reset_sqlite_wal_mode(&db_path) {
                                        Ok(()) => {
                                            log::info!("✅ WAL files cleared, attempting final retry");
                                            // Rebuild the query for final retry
                                            let mut final_query_builder = sqlx::query(&query);
                                            for col in &columns {
                                                if let Some(value) = row.get(col) {
                                                    final_query_builder = match value {
                                                        serde_json::Value::String(s) => final_query_builder.bind(s),
                                                        serde_json::Value::Number(n) => {
                                                            if let Some(int_val) = n.as_i64() {
                                                                final_query_builder.bind(int_val)
                                                            } else if let Some(float_val) = n.as_f64() {
                                                                final_query_builder.bind(float_val)
                                                            } else {
                                                                final_query_builder.bind(value.to_string())
                                                            }
                                                        },
                                                        serde_json::Value::Bool(b) => final_query_builder.bind(b),
                                                        serde_json::Value::Null => final_query_builder.bind(None::<String>),
                                                        _ => final_query_builder.bind(value.to_string()),
                                                    };
                                                }
                                            }
                                            
                                            match final_query_builder.execute(&pool).await {
                                                Ok(result) => {
                                                    let row_id = result.last_insert_rowid();
                                                    log::info!("✅ INSERT final retry successful on database '{}': new row ID {}", db_path, row_id);
                                                    return Ok(DbResponse {
                                                        success: true,
                                                        data: Some(row_id),
                                                        error: None,
                                                    });
                                                }
                                                Err(final_error) => {
                                                    log::error!("❌ INSERT failed even after WAL cleanup: {}", final_error);
                                                }
                                            }
                                        }
                                        Err(wal_error) => {
                                            log::error!("❌ Failed to clear WAL files: {}", wal_error);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Err(perm_error) => {
                        log::error!("❌ Failed to fix permissions: {}", perm_error);
                    }
                }
            }
            
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
    change_history: State<'_, super::change_history::ChangeHistoryManager>,
    table_name: String,
    current_db_path: Option<String>,
    // Context information for change tracking (optional for backward compatibility)
    device_id: Option<String>,
    device_name: Option<String>,
    device_type: Option<String>,
    package_name: Option<String>,
    app_name: Option<String>,
) -> Result<DbResponse<i64>, String> {
    // Validate that we have a specific database path for write operations
    let db_path = match current_db_path.clone() {
        Some(path) => {
            log::info!("📝 INSERT DEFAULT VALUES operation for table '{}' on database: {}", table_name, path);
            path
        }
        None => {
            log::error!("❌ INSERT DEFAULT VALUES operation requires a specific database path");
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some("INSERT operation requires a specific database path - no database selected".to_string()),
            });
        }
    };

    // Get the current pool using the helper function
    let pool = match get_current_pool(&state, &db_cache, current_db_path.clone()).await {
        Ok(pool) => pool,
        Err(e) => {
            log::error!("❌ Failed to get connection for INSERT DEFAULT VALUES operation: {}", e);
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some(format!("Database connection error: {}", e)),
            });
        }
    };
    
    // Ensure database file permissions are correct before write operation
    if let Err(permission_error) = ensure_database_file_permissions(&db_path) {
        log::error!("❌ Failed to ensure database permissions: {}", permission_error);
        return Ok(DbResponse {
            success: false,
            data: None,
            error: Some(format!("Database permission error: {}", permission_error)),
        });
    }
    
    // Use INSERT with DEFAULT VALUES
    let query = format!("INSERT INTO {} DEFAULT VALUES", table_name);
    
    log::info!("🔧 Executing INSERT DEFAULT VALUES query on database '{}': {}", db_path, query);
    
    match sqlx::query(&query).execute(&pool).await {
        Ok(result) => {
            let row_id = result.last_insert_rowid();
            log::info!("✅ INSERT DEFAULT VALUES successful on database '{}': new row ID {}", db_path, row_id);
            
            // Record change in history (non-fatal if fails)
            log::info!("🔍 Attempting to record change - context params: device_id={:?}, device_name={:?}, device_type={:?}, package_name={:?}, app_name={:?}", 
                       device_id, device_name, device_type, package_name, app_name);
                       
            if let (Some(device_id), Some(device_name), Some(device_type), Some(package_name), Some(app_name)) = 
                (device_id, device_name, device_type, package_name, app_name) {
                log::info!("✅ All context parameters available, creating change event");
                let user_context = extract_context_from_path(
                    &db_path,
                    Some(device_id),
                    Some(device_name),
                    Some(device_type),
                    Some(package_name),
                    Some(app_name),
                );
                
                // For INSERT DEFAULT VALUES, we don't know the exact values inserted
                let _empty_old_values: HashMap<String, serde_json::Value> = HashMap::new();
                let _empty_row: HashMap<String, serde_json::Value> = HashMap::new(); // We'll populate with default indicator
                let field_changes = vec![]; // Empty since we don't know the actual values
                
                if let Ok(change_event) = create_change_event(
                    &db_path,
                    &table_name,
                    OperationType::Insert,
                    user_context,
                    field_changes,
                    Some(row_id.to_string()),
                    Some(query.clone()),
                ) {
                    let _ = record_change_with_safety(&change_history, change_event).await;
                }
            } else {
                log::warn!("⚠️ Cannot record change - missing context parameters");
            }
            
            Ok(DbResponse {
                success: true,
                data: Some(row_id),
                error: None,
            })
        }
        Err(e) => {
            log::error!("❌ INSERT DEFAULT VALUES failed on database '{}': {}", db_path, e);
            
            // If it's a read-only error, try to fix permissions and retry once
            if e.to_string().contains("readonly database") || e.to_string().contains("attempt to write a readonly database") {
                log::warn!("🔄 Detected read-only database error, attempting to fix permissions and retry");
                
                match ensure_database_file_permissions(&db_path) {
                    Ok(()) => {
                        log::info!("✅ Fixed permissions, retrying INSERT DEFAULT VALUES operation");
                        
                        // Retry the operation once
                        match sqlx::query(&query).execute(&pool).await {
                            Ok(result) => {
                                let row_id = result.last_insert_rowid();
                                log::info!("✅ INSERT DEFAULT VALUES retry successful on database '{}': new row ID {}", db_path, row_id);
                                
                                // Record change in history (non-fatal if fails) - retry case
                                log::info!("🔍 Recording change for retry case");
                                if let (Some(device_id), Some(device_name), Some(device_type), Some(package_name), Some(app_name)) = 
                                    (&device_id, &device_name, &device_type, &package_name, &app_name) {
                                    log::info!("✅ Retry case - All context parameters available");
                                    let user_context = extract_context_from_path(
                                        &db_path,
                                        Some(device_id.clone()),
                                        Some(device_name.clone()),
                                        Some(device_type.clone()),
                                        Some(package_name.clone()),
                                        Some(app_name.clone()),
                                    );
                                    
                                    if let Ok(change_event) = create_change_event(
                                        &db_path,
                                        &table_name,
                                        OperationType::Insert,
                                        user_context,
                                        vec![], // Empty since we don't know the actual values
                                        Some(row_id.to_string()),
                                        Some(query.clone()),
                                    ) {
                                        let _ = record_change_with_safety(&change_history, change_event).await;
                                    }
                                }
                                
                                return Ok(DbResponse {
                                    success: true,
                                    data: Some(row_id),
                                    error: None,
                                });
                            }
                            Err(retry_error) => {
                                log::error!("❌ INSERT DEFAULT VALUES failed even after permission fix: {}", retry_error);
                                
                                // If still failing, try to reset WAL mode as a last resort
                                if retry_error.to_string().contains("readonly database") {
                                    log::warn!("🔄 Attempting WAL file cleanup as final retry");
                                    match crate::commands::database::helpers::reset_sqlite_wal_mode(&db_path) {
                                        Ok(()) => {
                                            log::info!("✅ WAL files cleared, attempting final retry");
                                            // Retry the operation once
                                            match sqlx::query(&query).execute(&pool).await {
                                                Ok(result) => {
                                                    let row_id = result.last_insert_rowid();
                                                    log::info!("✅ INSERT DEFAULT VALUES final retry successful on database '{}': new row ID {}", db_path, row_id);
                                                    
                                                    // Record change in history (non-fatal if fails) - final retry case
                                                    log::info!("🔍 Recording change for final retry case");
                                                    if let (Some(device_id), Some(device_name), Some(device_type), Some(package_name), Some(app_name)) = 
                                                        (&device_id, &device_name, &device_type, &package_name, &app_name) {
                                                        log::info!("✅ Final retry case - All context parameters available");
                                                        let user_context = extract_context_from_path(
                                                            &db_path,
                                                            Some(device_id.clone()),
                                                            Some(device_name.clone()),
                                                            Some(device_type.clone()),
                                                            Some(package_name.clone()),
                                                            Some(app_name.clone()),
                                                        );
                                                        
                                                        if let Ok(change_event) = create_change_event(
                                                            &db_path,
                                                            &table_name,
                                                            OperationType::Insert,
                                                            user_context,
                                                            vec![], // Empty since we don't know the actual values
                                                            Some(row_id.to_string()),
                                                            Some(query.clone()),
                                                        ) {
                                                            let _ = record_change_with_safety(&change_history, change_event).await;
                                                        }
                                                    }
                                                    
                                                    return Ok(DbResponse {
                                                        success: true,
                                                        data: Some(row_id),
                                                        error: None,
                                                    });
                                                }
                                                Err(final_error) => {
                                                    log::error!("❌ INSERT DEFAULT VALUES failed even after WAL cleanup: {}", final_error);
                                                }
                                            }
                                        }
                                        Err(wal_error) => {
                                            log::error!("❌ Failed to clear WAL files: {}", wal_error);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Err(perm_error) => {
                        log::error!("❌ Failed to fix permissions: {}", perm_error);
                    }
                }
            }
            
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
    change_history: State<'_, super::change_history::ChangeHistoryManager>,
    table_name: String,
    condition: String,
    current_db_path: Option<String>,
    // Context information for change tracking (optional for backward compatibility)
    device_id: Option<String>,
    device_name: Option<String>,
    device_type: Option<String>,
    package_name: Option<String>,
    app_name: Option<String>,
) -> Result<DbResponse<u64>, String> {
    // Validate that we have a specific database path for write operations
    let db_path = match current_db_path.clone() {
        Some(path) => {
            log::info!("📝 DELETE operation for table '{}' on database: {}", table_name, path);
            path
        }
        None => {
            log::error!("❌ DELETE operation requires a specific database path");
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some("DELETE operation requires a specific database path - no database selected".to_string()),
            });
        }
    };

    // Get the current pool using the helper function
    let pool = match get_current_pool(&state, &db_cache, current_db_path.clone()).await {
        Ok(pool) => pool,
        Err(e) => {
            log::error!("❌ Failed to get connection for DELETE operation: {}", e);
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some(format!("Database connection error: {}", e)),
            });
        }
    };
    
    // Ensure database file permissions are correct before write operation
    if let Err(permission_error) = ensure_database_file_permissions(&db_path) {
        log::error!("❌ Failed to ensure database permissions: {}", permission_error);
        return Ok(DbResponse {
            success: false,
            data: None,
            error: Some(format!("Database permission error: {}", permission_error)),
        });
    }
    
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
    log::info!("🔧 Executing DELETE query on database '{}': {}", db_path, query);
    
    // PHASE 2: Capture old values before deletion for change tracking (non-fatal if fails)
    let old_values = match sqlx::query(&format!("SELECT * FROM {} WHERE {}", table_name, condition))
        .fetch_all(&pool)
        .await 
    {
        Ok(rows) => {
            log::debug!("📝 Captured {} rows for deletion tracking", rows.len());
            Some(rows)
        }
        Err(e) => {
            log::warn!("⚠️ Failed to capture old values for delete tracking (non-fatal): {}", e);
            None
        }
    };
    
    match sqlx::query(&query).execute(&pool).await {
        Ok(result) => {
            let rows_affected = result.rows_affected();
            log::info!("✅ DELETE successful on database '{}': {} rows affected", db_path, rows_affected);
            
            // PHASE 2: Record change in history (non-fatal if fails)
            if let Some(deleted_rows) = old_values {
                let user_context = extract_context_from_path(
                    &db_path,
                    device_id,
                    device_name,
                    device_type,
                    package_name,
                    app_name,
                );
                
                // Record each deleted row as a separate change event
                for (row_index, row) in deleted_rows.iter().enumerate() {
                    let old_row_values = extract_row_values(row);
                    let empty_new_values = std::collections::HashMap::new();
                    
                    let field_changes = create_field_changes_optimized(
                        &OperationType::Delete,
                        &old_row_values,
                        &empty_new_values,
                    );
                    
                    if !field_changes.is_empty() {
                        match create_change_event(
                            &db_path,
                            &table_name,
                            OperationType::Delete,
                            user_context.clone(),
                            field_changes,
                            Some(format!("deleted_row_{}", row_index)),
                            Some(query.clone()),
                        ) {
                            Ok(change_event) => {
                                let _ = record_change_with_safety(&change_history, change_event).await;
                            }
                            Err(e) => {
                                log::warn!("⚠️ Failed to create change event for DELETE (non-fatal): {}", e);
                            }
                        }
                    }
                }
            }
            
            Ok(DbResponse {
                success: true,
                data: Some(rows_affected),
                error: None,
            })
        }
        Err(e) => {
            log::error!("❌ DELETE failed on database '{}': {}", db_path, e);
            
            // If it's a read-only error, try to fix permissions and retry once
            if e.to_string().contains("readonly database") || e.to_string().contains("attempt to write a readonly database") {
                log::warn!("🔄 Detected read-only database error, attempting to fix permissions and retry");
                
                match ensure_database_file_permissions(&db_path) {
                    Ok(()) => {
                        log::info!("✅ Fixed permissions, retrying DELETE operation");
                        
                        // Retry the operation once
                        match sqlx::query(&query).execute(&pool).await {
                            Ok(result) => {
                                let rows_affected = result.rows_affected();
                                log::info!("✅ DELETE retry successful on database '{}': {} rows affected", db_path, rows_affected);
                                return Ok(DbResponse {
                                    success: true,
                                    data: Some(rows_affected),
                                    error: None,
                                });
                            }
                            Err(retry_error) => {
                                log::error!("❌ DELETE failed even after permission fix: {}", retry_error);
                            }
                        }
                    }
                    Err(perm_error) => {
                        log::error!("❌ Failed to fix permissions: {}", perm_error);
                    }
                }
            }
            
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
                                            "TEXT" => {
                                                match row.try_get::<String, _>(i) {
                                                    Ok(val) => serde_json::Value::String(val),
                                                    Err(_) => serde_json::Value::String("".to_string()),
                                                }
                                            },
                                            "INTEGER" => {
                                                match row.try_get::<i64, _>(i) {
                                                    Ok(val) => serde_json::Value::Number(serde_json::Number::from(val)),
                                                    Err(_) => {
                                                        // Try as string first, then convert to number if possible
                                                        match row.try_get::<String, _>(i) {
                                                            Ok(str_val) => {
                                                                if let Ok(int_val) = str_val.parse::<i64>() {
                                                                    serde_json::Value::Number(serde_json::Number::from(int_val))
                                                                } else {
                                                                    serde_json::Value::String(str_val)
                                                                }
                                                            },
                                                            Err(_) => serde_json::Value::Null,
                                                        }
                                                    }
                                                }
                                            },
                                            "REAL" => {
                                                match row.try_get::<f64, _>(i) {
                                                    Ok(val) => serde_json::Value::Number(
                                                        serde_json::Number::from_f64(val).unwrap_or(serde_json::Number::from(0))
                                                    ),
                                                    Err(_) => {
                                                        // Try as string first, then convert to number if possible
                                                        match row.try_get::<String, _>(i) {
                                                            Ok(str_val) => {
                                                                if let Ok(float_val) = str_val.parse::<f64>() {
                                                                    serde_json::Value::Number(
                                                                        serde_json::Number::from_f64(float_val).unwrap_or(serde_json::Number::from(0))
                                                                    )
                                                                } else {
                                                                    serde_json::Value::String(str_val)
                                                                }
                                                            },
                                                            Err(_) => serde_json::Value::Null,
                                                        }
                                                    }
                                                }
                                            },
                                            _ => {
                                                match row.try_get::<String, _>(i) {
                                                    Ok(val) => serde_json::Value::String(val),
                                                    Err(_) => serde_json::Value::String("".to_string()),
                                                }
                                            },
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

#[tauri::command]
pub async fn db_clear_cache_for_path(
    db_cache: State<'_, DbConnectionCache>,
    db_path: String,
) -> Result<DbResponse<String>, String> {
    let normalized_path = match std::fs::canonicalize(&db_path) {
        Ok(absolute_path) => absolute_path.to_string_lossy().to_string(),
        Err(_) => db_path.clone(),
    };
    
    let mut cache_guard = db_cache.write().await;
    if cache_guard.remove(&normalized_path).is_some() {
        log::info!("🧹 Cleared cache for database: {}", normalized_path);
        Ok(DbResponse {
            success: true,
            data: Some("Cache cleared".to_string()),
            error: None,
        })
    } else {
        log::info!("ℹ️ No cache entry found for database: {}", normalized_path);
        Ok(DbResponse {
            success: true,
            data: Some("No cache entry found".to_string()),
            error: None,
        })
    }
}

#[tauri::command]
pub async fn db_clear_all_cache(
    db_cache: State<'_, DbConnectionCache>,
) -> Result<DbResponse<String>, String> {
    let mut cache_guard = db_cache.write().await;
    let count = cache_guard.len();
    cache_guard.clear();
    log::info!("🧹 Cleared all database cache entries: {} removed", count);
    
    Ok(DbResponse {
        success: true,
        data: Some(format!("Cleared {} cache entries", count)),
        error: None,
    })
}

#[tauri::command]
pub async fn db_switch_database(
    db_cache: State<'_, DbConnectionCache>,
    new_db_path: String,
) -> Result<DbResponse<String>, String> {
    log::info!("🔄 Switching to database: {}", new_db_path);
    
    // Clear any potentially stale connections to allow clean switch
    let mut cache_guard = db_cache.write().await;
    let cache_size_before = cache_guard.len();
    
    // Remove any connections that might conflict with the new database
    cache_guard.retain(|path, cached_conn| {
        if cached_conn.should_be_removed(std::time::Duration::from_secs(0)) {
            log::info!("🧹 Removed stale connection during database switch: {}", path);
            false
        } else {
            true
        }
    });
    
    let cache_size_after = cache_guard.len();
    let cleaned_count = cache_size_before - cache_size_after;
    
    if cleaned_count > 0 {
        log::info!("🧹 Cleaned {} stale connections during database switch", cleaned_count);
    }
    
    // Also clear WAL files for the new database in case there are any locks
    if let Err(e) = crate::commands::database::helpers::reset_sqlite_wal_mode(&new_db_path) {
        log::warn!("⚠️ Could not clear WAL files for new database (this is normal if no WAL files exist): {}", e);
    }
    
    log::info!("✅ Database switch prepared: {}", new_db_path);
    Ok(DbResponse {
        success: true,
        data: Some(format!("Switched to database: {}", new_db_path)),
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
            // Check if connection should be removed (time-expired OR pool is closed)
            if !cached_conn.should_be_removed(std::time::Duration::from_secs(300)) {
                cached_conn.update_last_used();
                log::info!("📦 Reusing cached connection for: {}", normalized_path);
                return Ok(cached_conn.pool.clone());
            } else {
                if cached_conn.is_pool_closed() {
                    log::warn!("🚫 Cached connection pool is closed, removing from cache: {}", normalized_path);
                } else {
                    log::info!("⏰ Cached connection expired for: {}", normalized_path);
                }
                // Remove the invalid connection from cache
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
        
        // Implement simple cache size limit (remove oldest if needed)
        const MAX_CACHE_SIZE: usize = 10;
        if cache_guard.len() >= MAX_CACHE_SIZE {
            // Find and remove the oldest entry
            if let Some((oldest_key, _)) = cache_guard
                .iter()
                .min_by_key(|(_, conn)| conn.last_used)
                .map(|(k, v)| (k.clone(), v.clone()))
            {
                log::info!("🧹 Removing oldest cached connection: {}", oldest_key);
                cache_guard.remove(&oldest_key);
                // Don't explicitly close - let it be garbage collected
            }
        }
        
        cache_guard.insert(normalized_path.clone(), CachedConnection::new(pool.clone()));
        log::info!("💾 Cached new connection for: {}", normalized_path);
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
        log::debug!("🔍 Attempting to get connection for specific database: {}", db_path);
        match get_cached_connection(db_cache, &db_path).await {
            Ok(cached_pool) => {
                // Double-check that the pool is actually usable
                if cached_pool.is_closed() {
                    log::error!("🚫 Cached pool is closed even though it was just returned! Path: {}", db_path);
                    // Force remove from cache and try again
                    {
                        let normalized_path = match std::fs::canonicalize(&db_path) {
                            Ok(absolute_path) => absolute_path.to_string_lossy().to_string(),
                            Err(_) => db_path.clone(),
                        };
                        let mut cache_guard = db_cache.write().await;
                        cache_guard.remove(&normalized_path);
                        log::warn!("🧹 Force removed closed pool from cache: {}", normalized_path);
                    }
                    
                    // Try to create a new connection
                    log::info!("🔄 Attempting to create new connection after detecting closed pool");
                    return get_cached_connection(db_cache, &db_path).await;
                } else {
                    log::info!("✅ Using cached connection for specific database: {}", db_path);
                    return Ok(cached_pool);
                }
            }
            Err(e) => {
                log::warn!("⚠️ Failed to get cached connection for specific database: {}", e);
                return Err(e);
            }
        }
    }
    
    // If no specific path provided, try to find any active connection in cache
    // BUT ONLY as a fallback when no specific database is requested
    {
        let cache_guard = db_cache.read().await;
        if let Some((path, cached_conn)) = cache_guard.iter().next() {
            if !cached_conn.should_be_removed(std::time::Duration::from_secs(300)) {
                log::warn!("⚠️ Using fallback cached connection from cache (no specific DB requested): {}", path);
                return Ok(cached_conn.pool.clone());
            }
        }
    }
    
    // Fallback to legacy pool ONLY when no specific database is requested
    let pool_guard = state.read().await;
    match pool_guard.as_ref() {
        Some(pool) => {
            if pool.is_closed() {
                log::error!("🚫 Legacy pool is also closed!");
                Err("All database connections are closed".to_string())
            } else {
                log::warn!("⚠️ Using legacy pool connection (no specific DB requested)");
                Ok(pool.clone())
            }
        }
        None => {
            Err("No database connection available".to_string())
        }
    }
}

#[tauri::command]
pub async fn db_clear_table(
    state: State<'_, DbPool>,
    db_cache: State<'_, DbConnectionCache>,
    change_history: State<'_, super::change_history::ChangeHistoryManager>,
    table_name: String,
    current_db_path: Option<String>,
    // Context information for change tracking (optional for backward compatibility)
    device_id: Option<String>,
    device_name: Option<String>,
    device_type: Option<String>,
    package_name: Option<String>,
    app_name: Option<String>,
) -> Result<DbResponse<u64>, String> {
    // Validate that we have a specific database path for write operations
    let db_path = match current_db_path.clone() {
        Some(path) => {
            log::info!("📝 CLEAR TABLE operation for table '{}' on database: {}", table_name, path);
            path
        }
        None => {
            log::error!("❌ CLEAR TABLE operation requires a specific database path");
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some("CLEAR TABLE operation requires a specific database path - no database selected".to_string()),
            });
        }
    };

    // Get the current pool using the helper function
    let pool = match get_current_pool(&state, &db_cache, current_db_path.clone()).await {
        Ok(pool) => pool,
        Err(e) => {
            log::error!("❌ Failed to get connection for CLEAR TABLE operation: {}", e);
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some(format!("Database connection error: {}", e)),
            });
        }
    };
    
    // Ensure database file permissions are correct before write operation
    if let Err(permission_error) = ensure_database_file_permissions(&db_path) {
        log::error!("❌ Failed to ensure database permissions: {}", permission_error);
        return Ok(DbResponse {
            success: false,
            data: None,
            error: Some(format!("Database permission error: {}", permission_error)),
        });
    }
    
    // Safety checks
    if table_name.trim().is_empty() {
        return Ok(DbResponse {
            success: false,
            data: None,
            error: Some("Table name cannot be empty".to_string()),
        });
    }
    
    // First, count how many rows will be deleted for change tracking
    let row_count = match sqlx::query_scalar::<_, i64>(&format!("SELECT COUNT(*) FROM {}", table_name))
        .fetch_one(&pool)
        .await 
    {
        Ok(count) => count as usize,
        Err(e) => {
            log::warn!("⚠️ Failed to count rows before clear (non-fatal): {}", e);
            0 // Continue with operation even if count fails
        }
    };
    
    let query = format!("DELETE FROM {}", table_name);
    log::info!("🔧 Executing CLEAR TABLE query on database '{}': {}", db_path, query);
    
    match sqlx::query(&query).execute(&pool).await {
        Ok(result) => {
            let rows_affected = result.rows_affected();
            log::info!("✅ CLEAR TABLE successful on database '{}': {} rows deleted", db_path, rows_affected);
            
            // Record change in history (non-fatal if fails)
            let user_context = extract_context_from_path(
                &db_path,
                device_id,
                device_name,
                device_type,
                package_name,
                app_name,
            );
            
            // Create a bulk delete or clear operation type based on count
            let operation_type = if row_count > 0 {
                OperationType::BulkDelete { count: row_count }
            } else {
                OperationType::Clear
            };
            
            // For clear operations, we don't track individual field changes
            let field_changes = vec![];
            
            match create_change_event(
                &db_path,
                &table_name,
                operation_type,
                user_context,
                field_changes,
                None, // No specific row identifier for bulk operations
                Some(query.clone()),
            ) {
                Ok(change_event) => {
                    let _ = record_change_with_safety(&change_history, change_event).await;
                }
                Err(e) => {
                    log::warn!("⚠️ Failed to create change event for CLEAR TABLE (non-fatal): {}", e);
                }
            }
            
            Ok(DbResponse {
                success: true,
                data: Some(rows_affected),
                error: None,
            })
        }
        Err(e) => {
            log::error!("❌ CLEAR TABLE failed on database '{}': {}", db_path, e);
            
            // If it's a read-only error, try to fix permissions and retry once
            if e.to_string().contains("readonly database") || e.to_string().contains("attempt to write a readonly database") {
                log::warn!("🔄 Detected read-only database error, attempting to fix permissions and retry");
                
                match ensure_database_file_permissions(&db_path) {
                    Ok(()) => {
                        log::info!("✅ Fixed permissions, retrying CLEAR TABLE operation");
                        
                        // Retry the operation once
                        match sqlx::query(&query).execute(&pool).await {
                            Ok(result) => {
                                let rows_affected = result.rows_affected();
                                log::info!("✅ CLEAR TABLE retry successful on database '{}': {} rows deleted", db_path, rows_affected);
                                return Ok(DbResponse {
                                    success: true,
                                    data: Some(rows_affected),
                                    error: None,
                                });
                            }
                            Err(retry_error) => {
                                log::error!("❌ CLEAR TABLE retry also failed: {}", retry_error);
                                return Ok(DbResponse {
                                    success: false,
                                    data: None,
                                    error: Some(format!("Clear table operation failed after retry: {}", retry_error)),
                                });
                            }
                        }
                    }
                    Err(permission_retry_error) => {
                        log::error!("❌ Failed to fix permissions for retry: {}", permission_retry_error);
                    }
                }
            }
            
            Ok(DbResponse {
                success: false,
                data: None,
                error: Some(format!("Clear table operation failed: {}", e)),
            })
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct DatabaseDiagnostic {
    pub file_exists: bool,
    pub file_size: u64,
    pub is_readable: bool,
    pub is_writable: bool,
    pub has_sqlite_header: bool,
    pub sqlite_version: Option<String>,
    pub wal_files_present: Vec<String>,
    pub corruption_detected: bool,
    pub integrity_check_passed: bool,
    pub recommendations: Vec<String>,
}

#[tauri::command]
pub async fn db_diagnose_corruption(
    file_path: String,
) -> Result<DbResponse<DatabaseDiagnostic>, String> {
    log::info!("Diagnosing database corruption for: {}", file_path);
    
    let mut diagnostic = DatabaseDiagnostic {
        file_exists: false,
        file_size: 0,
        is_readable: false,
        is_writable: false,
        has_sqlite_header: false,
        sqlite_version: None,
        wal_files_present: Vec::new(),
        corruption_detected: false,
        integrity_check_passed: false,
        recommendations: Vec::new(),
    };
    
    // Check if file exists
    let path = std::path::Path::new(&file_path);
    diagnostic.file_exists = path.exists();
    
    if !diagnostic.file_exists {
        diagnostic.recommendations.push("File does not exist. Verify the file path is correct.".to_string());
        return Ok(DbResponse {
            success: true,
            data: Some(diagnostic),
            error: None,
        });
    }
    
    // Check file size and permissions
    if let Ok(metadata) = std::fs::metadata(&file_path) {
        diagnostic.file_size = metadata.len();
        diagnostic.is_readable = !metadata.permissions().readonly();
        
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = metadata.permissions().mode();
            diagnostic.is_writable = (mode & 0o200) != 0;
        }
        #[cfg(windows)]
        {
            diagnostic.is_writable = !metadata.permissions().readonly();
        }
    }
    
    // Check for SQLite header
    if let Ok(mut file) = std::fs::File::open(&file_path) {
        use std::io::Read;
        let mut header = [0u8; 16];
        if let Ok(_) = file.read_exact(&mut header) {
            let header_str = String::from_utf8_lossy(&header);
            diagnostic.has_sqlite_header = header_str.starts_with("SQLite format");
        }
    }
    
    // Check for WAL files
    if let Some(parent) = path.parent() {
        if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
            for suffix in ["wal", "shm"] {
                let aux_path = parent.join(format!("{}.db-{}", stem, suffix));
                if aux_path.exists() {
                    diagnostic.wal_files_present.push(format!("{}.db-{}", stem, suffix));
                }
            }
        }
    }
    
    // Try to open database and run integrity check
    match SqlitePool::connect(&format!("sqlite://{}", file_path)).await {
        Ok(pool) => {
            // Try to get SQLite version
            if let Ok(row) = sqlx::query("SELECT sqlite_version()").fetch_one(&pool).await {
                if let Ok(version) = row.try_get::<String, _>(0) {
                    diagnostic.sqlite_version = Some(version);
                }
            }
            
            // Run integrity check
            match sqlx::query("PRAGMA integrity_check").fetch_one(&pool).await {
                Ok(row) => {
                    if let Ok(result) = row.try_get::<String, _>(0) {
                        diagnostic.integrity_check_passed = result == "ok";
                        if !diagnostic.integrity_check_passed {
                            diagnostic.corruption_detected = true;
                            diagnostic.recommendations.push(format!("Database integrity check failed: {}", result));
                        }
                    }
                }
                Err(e) => {
                    diagnostic.corruption_detected = true;
                    diagnostic.recommendations.push(format!("Could not run integrity check: {}", e));
                }
            }
            
            pool.close().await;
        }
        Err(e) => {
            diagnostic.corruption_detected = true;
            diagnostic.recommendations.push(format!("Cannot open database: {}", e));
        }
    }
    
    // Generate recommendations
    if diagnostic.file_size == 0 {
        diagnostic.recommendations.push("Database file is empty. This may indicate a failed extraction.".to_string());
    }
    
    if !diagnostic.has_sqlite_header {
        diagnostic.recommendations.push("File does not have a valid SQLite header. This is not a SQLite database.".to_string());
    }
    
    if !diagnostic.is_writable {
        diagnostic.recommendations.push("Database file is read-only. Try setting write permissions.".to_string());
    }
    
    if !diagnostic.wal_files_present.is_empty() {
        diagnostic.recommendations.push("WAL files detected. These may cause locking issues. Consider removing them.".to_string());
    }
    
    if diagnostic.corruption_detected {
        diagnostic.recommendations.push("Database appears to be corrupted. Try:".to_string());
        diagnostic.recommendations.push("1. Re-extract the database from the device".to_string());
        diagnostic.recommendations.push("2. Use SQLite recovery tools (sqlite3 .recover)".to_string());
        diagnostic.recommendations.push("3. Restore from a backup if available".to_string());
    }
    
    Ok(DbResponse {
        success: true,
        data: Some(diagnostic),
        error: None,
    })
}
