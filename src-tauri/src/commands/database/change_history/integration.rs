use super::types::{UserContext, ChangeEvent, OperationType, FieldChange, ChangeMetadata};
use super::ChangeHistoryManager;
use serde_json::Value;
use sqlx::{Pool, Sqlite, Row};
use std::collections::HashMap;
use tauri::State;
use chrono::Utc;
use uuid::Uuid;

pub async fn capture_old_values_for_update(
    pool: &Pool<Sqlite>,
    table_name: &str,
    condition: &str,
    columns: &[String],
) -> Result<HashMap<String, Value>, sqlx::Error> {
    let column_list = columns.join(", ");
    let query = format!("SELECT {} FROM {} WHERE {}", column_list, table_name, condition);
    
    let row = sqlx::query(&query).fetch_one(pool).await?;
    
    let mut old_values = HashMap::new();
    for column in columns {
        let value: Value = match row.try_get::<Option<String>, &str>(column) {
            Ok(Some(s)) => Value::String(s),
            Ok(None) => Value::Null,
            Err(_) => {
                if let Ok(Some(i)) = row.try_get::<Option<i64>, &str>(column) {
                    Value::Number(i.into())
                } else if let Ok(Some(f)) = row.try_get::<Option<f64>, &str>(column) {
                    if let Some(num) = serde_json::Number::from_f64(f) {
                        Value::Number(num)
                    } else {
                        Value::String(f.to_string())
                    }
                } else if let Ok(Some(b)) = row.try_get::<Option<bool>, &str>(column) {
                    Value::Bool(b)
                } else {
                    Value::Null
                }
            }
        };
        old_values.insert(column.clone(), value);
    }
    
    Ok(old_values)
}

pub fn create_field_changes(
    old_values: &HashMap<String, Value>,
    new_values: &HashMap<String, Value>,
) -> Vec<FieldChange> {
    let mut changes = Vec::new();
    
    // Handle regular updates/inserts by iterating over new_values
    for (field_name, new_value) in new_values {
        let old_value = old_values.get(field_name);
        
        let old_val_opt = match old_value {
            Some(v) if v != &Value::Null => Some(v.clone()),
            _ => None,
        };
        
        let new_val_opt = match new_value {
            v if v != &Value::Null => Some(v.clone()),
            _ => None,
        };
        
        // Only record if there's actually a change
        if old_val_opt != new_val_opt {
            let data_type = match new_value {
                Value::String(_) => "TEXT".to_string(),
                Value::Number(_) => "NUMERIC".to_string(),
                Value::Bool(_) => "BOOLEAN".to_string(),
                Value::Null => "NULL".to_string(),
                _ => "TEXT".to_string(),
            };
            
            changes.push(FieldChange {
                field_name: field_name.clone(),
                old_value: old_val_opt,
                new_value: new_val_opt,
                data_type,
            });
        }
    }
    
    // Handle delete operations: if new_values is empty but old_values has data,
    // create field changes for all old values (showing they were deleted)
    if new_values.is_empty() && !old_values.is_empty() {
        for (field_name, old_value) in old_values {
            let old_val_opt = match old_value {
                v if v != &Value::Null => Some(v.clone()),
                _ => None,
            };
            
            if old_val_opt.is_some() {
                let data_type = match old_value {
                    Value::String(_) => "TEXT".to_string(),
                    Value::Number(_) => "NUMERIC".to_string(),
                    Value::Bool(_) => "BOOLEAN".to_string(),
                    Value::Null => "NULL".to_string(),
                    _ => "TEXT".to_string(),
                };
                
                changes.push(FieldChange {
                    field_name: field_name.clone(),
                    old_value: old_val_opt,
                    new_value: None, // Deleted, so no new value
                    data_type,
                });
            }
        }
    }
    
    changes
}

pub fn extract_context_from_path(
    db_path: &str,
    device_id: Option<String>,
    device_name: Option<String>,
    device_type: Option<String>,
    package_name: Option<String>,
    app_name: Option<String>,
) -> UserContext {
    let normalized_path = std::path::Path::new(db_path)
        .canonicalize()
        .unwrap_or_else(|_| std::path::PathBuf::from(db_path))
        .to_string_lossy()
        .to_string();

    let default_package = if let Some(filename) = std::path::Path::new(&normalized_path).file_name() {
        filename.to_string_lossy().to_string()
    } else {
        "unknown".to_string()
    };

    UserContext {
        device_id: device_id.unwrap_or_else(|| "unknown".to_string()),
        device_name: device_name.unwrap_or_else(|| "Unknown Device".to_string()),
        device_type: device_type.unwrap_or_else(|| "unknown".to_string()),
        app_package: package_name.unwrap_or(default_package),
        app_name: app_name.unwrap_or_else(|| "Unknown App".to_string()),
        session_id: super::get_session_id(),
    }
}

pub async fn record_change_with_safety(
    change_manager: &State<'_, ChangeHistoryManager>,
    change_event: ChangeEvent,
) -> Result<(), String> {
    let manager = change_manager.inner();
    
    match manager.record_change(change_event).await {
        Ok(_) => {
            log::debug!("📝 Change recorded successfully");
            Ok(())
        }
        Err(e) => {
            log::warn!("⚠️ Failed to record change (non-fatal): {}", e);
            Ok(())
        }
    }
}

pub fn create_change_event(
    db_path: &str,
    table_name: &str,
    operation_type: OperationType,
    user_context: UserContext,
    changes: Vec<FieldChange>,
    row_identifier: Option<String>,
    sql_statement: Option<String>,
) -> Result<ChangeEvent, String> {
    let database_filename = std::path::Path::new(db_path)
        .file_name()
        .ok_or("Invalid database path")?
        .to_string_lossy()
        .to_string();
    
    // Check if this is a custom file by detecting if both device_id and app_package 
    // were defaulted to "unknown" (indicating None was passed for both device_id and package_name)
    let is_custom_file = user_context.device_id == "unknown" && 
                        user_context.app_package == database_filename;
    
    // For custom files, use custom file context key, otherwise use regular context key
    let context_key = if is_custom_file {
        super::generate_custom_file_context_key(db_path)
    } else {
        super::generate_context_key(
            &user_context.device_id,
            &user_context.app_package,
            &database_filename,
        )
    };
    
    // Debug logging for context key generation
    log::info!("🔍 [record_change] Context key generation:");
    log::info!("🔍 [record_change] Device ID: {}", user_context.device_id);
    log::info!("🔍 [record_change] App package: {}", user_context.app_package);
    log::info!("🔍 [record_change] Database filename: {}", database_filename);
    log::info!("🔍 [record_change] Database path: {}", db_path);
    log::info!("🔍 [record_change] Is custom file: {}", is_custom_file);
    log::info!("🔍 [record_change] Generated context key: {}", context_key);
    
    let metadata = ChangeMetadata {
        affected_rows: match &operation_type {
            OperationType::BulkInsert { count } |
            OperationType::BulkUpdate { count } |
            OperationType::BulkDelete { count } => *count,
            _ => if changes.is_empty() { 0 } else { 1 },
        },
        execution_time_ms: 0, // This could be measured by the caller
        sql_statement,
        original_remote_path: None, // Could be added by caller if available
        pull_timestamp: Utc::now(),
    };
    
    Ok(ChangeEvent {
        id: Uuid::new_v4().to_string(),
        timestamp: Utc::now(),
        context_key,
        database_path: db_path.to_string(),
        database_filename,
        table_name: table_name.to_string(),
        operation_type,
        user_context,
        changes,
        row_identifier,
        metadata,
    })
}
