use crate::commands::database::connection_access::{
    get_cached_connection, get_current_pool, validate_pool_health,
};
use crate::commands::database::helpers::get_default_value_for_type;
use crate::commands::database::types::*;
use base64::{engine::general_purpose, Engine as _};
use sqlx::{sqlite::SqlitePool, Column, Row, TypeInfo, ValueRef};
use std::collections::HashMap;
use tauri::State;

const FLIPPIO_ROWID_COLUMN: &str = "__flippio_rowid";

#[tauri::command]
pub async fn db_open(
    state: State<'_, DbPool>,
    db_cache: State<'_, DbConnectionCache>,
    file_path: String,
) -> Result<DbResponse<String>, String> {
    log::info!("Opening database with caching: {}", file_path);

    match get_cached_connection(&db_cache, &file_path).await {
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

    let table_exists_query = "SELECT name FROM sqlite_master WHERE type='table' AND name = ?";
    match sqlx::query(table_exists_query)
        .bind(&table_name)
        .fetch_optional(&pool)
        .await
    {
        Ok(Some(_)) => log::info!("✅ Table '{}' exists", table_name),
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

    log::info!(
        "📊 Reading table data from database: {}",
        current_db_path.as_deref().unwrap_or("unknown")
    );

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

    let data_query_with_rowid = format!("SELECT rowid AS {}, * FROM {}", FLIPPIO_ROWID_COLUMN, table_name);
    let data_query_without_rowid = format!("SELECT * FROM {}", table_name);
    let data_rows = match sqlx::query(&data_query_with_rowid).fetch_all(&pool).await {
        Ok(rows) => {
            log::info!("✅ Retrieved {} rows from table '{}' with rowid metadata", rows.len(), table_name);
            rows
        }
        Err(rowid_error) => {
            log::warn!(
                "⚠️ Failed to read rowid metadata for table '{}', falling back to plain SELECT: {}",
                table_name,
                rowid_error
            );

            match sqlx::query(&data_query_without_rowid).fetch_all(&pool).await {
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
            }
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
                            "TEXT" => match row.try_get::<String, _>(i) {
                                Ok(val) => serde_json::Value::String(val),
                                Err(_) => serde_json::Value::String("".to_string()),
                            },
                            "INTEGER" => match row.try_get::<i64, _>(i) {
                                Ok(val) => serde_json::Value::Number(serde_json::Number::from(val)),
                                Err(_) => match row.try_get::<String, _>(i) {
                                    Ok(str_val) => {
                                        if let Ok(int_val) = str_val.parse::<i64>() {
                                            serde_json::Value::Number(serde_json::Number::from(int_val))
                                        } else {
                                            serde_json::Value::String(str_val)
                                        }
                                    }
                                    Err(_) => serde_json::Value::Null,
                                },
                            },
                            "REAL" => match row.try_get::<f64, _>(i) {
                                Ok(val) => serde_json::Value::Number(
                                    serde_json::Number::from_f64(val)
                                        .unwrap_or(serde_json::Number::from(0)),
                                ),
                                Err(_) => match row.try_get::<String, _>(i) {
                                    Ok(str_val) => {
                                        if let Ok(float_val) = str_val.parse::<f64>() {
                                            serde_json::Value::Number(
                                                serde_json::Number::from_f64(float_val)
                                                    .unwrap_or(serde_json::Number::from(0)),
                                            )
                                        } else {
                                            serde_json::Value::String(str_val)
                                        }
                                    }
                                    Err(_) => serde_json::Value::Null,
                                },
                            },
                            "BLOB" => match row.try_get::<Vec<u8>, _>(i) {
                                Ok(blob_data) => {
                                    serde_json::Value::String(general_purpose::STANDARD.encode(blob_data))
                                }
                                Err(_) => serde_json::Value::String("".to_string()),
                            },
                            _ => match row.try_get::<String, _>(i) {
                                Ok(val) => serde_json::Value::String(val),
                                Err(_) => serde_json::Value::String("Unknown type".to_string()),
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

    log::info!(
        "✅ Successfully processed table data for '{}' from database '{}': {} columns, {} rows",
        table_name,
        current_db_path.as_deref().unwrap_or("unknown"),
        columns.len(),
        rows.len()
    );

    Ok(DbResponse {
        success: true,
        data: Some(TableData { columns, rows }),
        error: None,
    })
}

#[tauri::command]
pub async fn db_get_info(file_path: String) -> Result<DbResponse<DbInfo>, String> {
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

            let tables_result = sqlx::query(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
            )
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
                }),
            }
        }
        Err(e) => Ok(DbResponse {
            success: false,
            data: None,
            error: Some(format!("Error reading file: {}", e)),
        }),
    }
}
