//! Database Tauri Commands
//! 
//! This module contains only the Tauri command wrappers that delegate to the
//! business logic implementations in the domain-specific modules.
//! 
//! All business logic has been extracted to:
//! - queries/ - Read-only operations (get_tables, get_table_data, execute_query, get_info)
//! - mutations/ - Data modifications (insert, update, delete, add_with_defaults)
//! - management/ - Connection management (open, stats, cache, switch)

use crate::commands::database::types::*;
use crate::commands::database::{
    // Query operations
    get_tables_impl, get_table_data_impl, get_database_info_impl, execute_query_impl,
    // Mutation operations  
    insert_table_row_impl, update_table_row_impl, delete_table_row_impl, add_new_row_with_defaults_impl,
    // Management operations
    db_open_impl, get_connection_stats_impl, clear_cache_for_path_impl, clear_all_cache_impl, switch_database_impl,
    // Internal utilities
    get_current_pool, validate_pool_health,
};
use crate::commands::database::connection_manager::DatabaseConnectionManager;
use crate::commands::common::DbResponse;
use tauri::State;
use serde_json;
use std::collections::HashMap;

// ===== DATABASE CONNECTION MANAGEMENT =====

#[tauri::command]
pub async fn db_open(
    state: State<'_, DbPool>,
    db_cache: State<'_, DbConnectionCache>,
    file_path: String,
) -> Result<DbResponse<String>, String> {
    Ok(db_open_impl(&state, &db_cache, &file_path).await)
}

#[tauri::command]
pub async fn db_get_connection_stats(
    connection_manager: State<'_, DatabaseConnectionManager>,
) -> Result<DbResponse<HashMap<String, serde_json::Value>>, String> {
    Ok(get_connection_stats_impl(&connection_manager).await)
}

#[tauri::command]
pub async fn db_clear_cache_for_path(
    connection_manager: State<'_, DatabaseConnectionManager>,
    db_path: String,
) -> Result<DbResponse<String>, String> {
    Ok(clear_cache_for_path_impl(&connection_manager, &db_path).await)
}

#[tauri::command]
pub async fn db_clear_all_cache(
    connection_manager: State<'_, DatabaseConnectionManager>,
) -> Result<DbResponse<String>, String> {
    Ok(clear_all_cache_impl(&connection_manager).await)
}

#[tauri::command]
pub async fn db_switch_database(
    state: State<'_, DbPool>,
    db_cache: State<'_, DbConnectionCache>,
    new_db_path: String,
) -> Result<DbResponse<String>, String> {
    Ok(switch_database_impl(&state, &db_cache, &new_db_path).await)
}

// ===== QUERY OPERATIONS (READ-ONLY) =====

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
    
    Ok(get_tables_impl(&pool).await)
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
    
    Ok(get_table_data_impl(&pool, &table_name).await)
}

#[tauri::command]
pub async fn db_get_info(
    file_path: String,
) -> Result<DbResponse<DbInfo>, String> {
    Ok(get_database_info_impl(&file_path).await)
}

#[tauri::command]
pub async fn db_execute_query(
    state: State<'_, DbPool>,
    db_cache: State<'_, DbConnectionCache>,
    query: String,
    _db_path: Option<String>,
    _params: Option<Vec<serde_json::Value>>,
) -> Result<DbResponse<serde_json::Value>, String> {
    // Get the current pool
    let pool = match get_current_pool(&state, &db_cache, _db_path).await {
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
    
    let params = _params.unwrap_or_default();
    Ok(execute_query_impl(&pool, &query, &params).await)
}

// ===== MUTATION OPERATIONS (DATA MODIFICATION) =====

#[tauri::command]
pub async fn db_insert_table_row(
    state: State<'_, DbPool>,
    db_cache: State<'_, DbConnectionCache>,
    table_name: String,
    values: HashMap<String, serde_json::Value>,
    current_db_path: Option<String>,
) -> Result<DbResponse<String>, String> {
    // Get the current pool
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
    
    Ok(insert_table_row_impl(&pool, &table_name, &values).await)
}

#[tauri::command]
pub async fn db_update_table_row(
    state: State<'_, DbPool>,
    db_cache: State<'_, DbConnectionCache>,
    table_name: String,
    row_id: serde_json::Value,
    new_values: HashMap<String, serde_json::Value>,
    current_db_path: Option<String>,
) -> Result<DbResponse<String>, String> {
    // Get the current pool
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
    
    Ok(update_table_row_impl(&pool, &table_name, &row_id, &new_values).await)
}

#[tauri::command]
pub async fn db_delete_table_row(
    state: State<'_, DbPool>,
    db_cache: State<'_, DbConnectionCache>,
    table_name: String,
    row_id: serde_json::Value,
    current_db_path: Option<String>,
) -> Result<DbResponse<String>, String> {
    // Get the current pool
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
    
    Ok(delete_table_row_impl(&pool, &table_name, &row_id).await)
}

#[tauri::command]
pub async fn db_add_new_row_with_defaults(
    state: State<'_, DbPool>,
    db_cache: State<'_, DbConnectionCache>,
    table_name: String,
    current_db_path: Option<String>,
) -> Result<DbResponse<HashMap<String, serde_json::Value>>, String> {
    // Get the current pool
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
    
    Ok(add_new_row_with_defaults_impl(&pool, &table_name).await)
}
