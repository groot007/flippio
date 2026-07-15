use crate::commands::database::change_history::{OperationType, FieldChange, UserContext};
use serde_json::Value;
use sqlx::{Row, Column};
use std::collections::HashMap as StdHashMap;

/// Configuration for recording database changes
pub struct ChangeRecordingConfig {
    pub operation_type: OperationType,
    pub table_name: String,
    pub db_path: String,
    pub sql_statement: String,
    pub user_context: UserContext,
    pub row_identifier: Option<String>,
}

/// Result of a database operation with change tracking
pub struct DatabaseOperationResult<T> {
    pub data: T,
    pub changes_recorded: bool,
    pub change_count: usize,
}

/// Trait for database operations that can record changes
pub trait ChangeTrackable<T> {
    async fn execute_with_tracking(
        &self,
        config: ChangeRecordingConfig,
    ) -> Result<DatabaseOperationResult<T>, String>;
}

/// Optimized field change creation for different operation types
pub fn create_field_changes_optimized(
    operation_type: &OperationType,
    old_values: &StdHashMap<String, Value>,
    new_values: &StdHashMap<String, Value>,
) -> Vec<FieldChange> {
    match operation_type {
        OperationType::Insert => create_insert_changes(new_values),
        OperationType::Update => create_update_changes(old_values, new_values),
        OperationType::Delete => create_delete_changes(old_values),
        _ => create_field_changes_fallback(old_values, new_values),
    }
}

/// Create field changes for INSERT operations
fn create_insert_changes(new_values: &StdHashMap<String, Value>) -> Vec<FieldChange> {
    new_values
        .iter()
        .filter_map(|(field_name, new_value)| {
            if new_value != &Value::Null {
                Some(FieldChange {
                    field_name: field_name.clone(),
                    old_value: None,
                    new_value: Some(new_value.clone()),
                    data_type: get_value_type(new_value),
                })
            } else {
                None
            }
        })
        .collect()
}

/// Create field changes for UPDATE operations
fn create_update_changes(
    old_values: &StdHashMap<String, Value>,
    new_values: &StdHashMap<String, Value>,
) -> Vec<FieldChange> {
    new_values
        .iter()
        .filter_map(|(field_name, new_value)| {
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
                Some(FieldChange {
                    field_name: field_name.clone(),
                    old_value: old_val_opt,
                    new_value: new_val_opt,
                    data_type: get_value_type(new_value),
                })
            } else {
                None
            }
        })
        .collect()
}

/// Create field changes for DELETE operations
fn create_delete_changes(old_values: &StdHashMap<String, Value>) -> Vec<FieldChange> {
    old_values
        .iter()
        .filter_map(|(field_name, old_value)| {
            if old_value != &Value::Null {
                Some(FieldChange {
                    field_name: field_name.clone(),
                    old_value: Some(old_value.clone()),
                    new_value: None,
                    data_type: get_value_type(old_value),
                })
            } else {
                None
            }
        })
        .collect()
}

/// Fallback implementation for complex operation types
fn create_field_changes_fallback(
    old_values: &StdHashMap<String, Value>,
    new_values: &StdHashMap<String, Value>,
) -> Vec<FieldChange> {
    // Use the existing implementation for backward compatibility
    crate::commands::database::change_history::create_field_changes(old_values, new_values)
}

/// Get data type string from serde_json::Value
fn get_value_type(value: &Value) -> String {
    match value {
        Value::String(_) => "TEXT".to_string(),
        Value::Number(_) => "NUMERIC".to_string(),
        Value::Bool(_) => "BOOLEAN".to_string(),
        Value::Null => "NULL".to_string(),
        _ => "TEXT".to_string(),
    }
}

/// Extract row values from SQLx row into HashMap
pub fn extract_row_values(row: &sqlx::sqlite::SqliteRow) -> StdHashMap<String, Value> {
    let mut values = StdHashMap::new();
    
    for (col_index, column) in row.columns().iter().enumerate() {
        let col_name = column.name();
        let value = match row.try_get::<Option<String>, usize>(col_index) {
            Ok(Some(s)) => Value::String(s),
            Ok(None) => Value::Null,
            Err(_) => {
                if let Ok(Some(i)) = row.try_get::<Option<i64>, usize>(col_index) {
                    Value::Number(i.into())
                } else if let Ok(Some(f)) = row.try_get::<Option<f64>, usize>(col_index) {
                    if let Some(num) = serde_json::Number::from_f64(f) {
                        Value::Number(num)
                    } else {
                        Value::String(f.to_string())
                    }
                } else if let Ok(Some(b)) = row.try_get::<Option<bool>, usize>(col_index) {
                    Value::Bool(b)
                } else {
                    Value::Null
                }
            }
        };
        values.insert(col_name.to_string(), value);
    }
    
    values
}
