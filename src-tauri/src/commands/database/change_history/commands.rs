// src-tauri/src/commands/database/change_history/commands.rs
// Safe Tauri commands for change history - NO REVERT functionality yet
// Following IMPLEMENTATION_ROADMAP.md Phase 1 approach

use tauri::{command, State};
use uuid::Uuid;
use chrono::Utc;

use crate::commands::database::change_history::{
    manager::ChangeHistoryManager,
    types::{ChangeEvent, OperationType, UserContext, ChangeMetadata, ContextSummary, generate_context_key, validate_context_key}
};
use crate::commands::database::DbResponse;

// SAFE: All parameters required, no unwrap() calls (Critical Issue #2 fix)
#[command]
pub async fn record_database_change_safe(
    history_manager: State<'_, ChangeHistoryManager>,
    table_name: String,
    operation_type: String, // "insert", "update", "delete"
    // Context parameters - all REQUIRED to avoid unwrap() panics
    device_id: String,
    device_name: String,
    device_type: String,
    app_package: String,
    app_name: String,
    database_filename: String,
    current_db_path: String,
) -> Result<DbResponse<String>, String> {
    // Validate operation type
    let operation = match operation_type.to_lowercase().as_str() {
        "insert" => OperationType::Insert,
        "update" => OperationType::Update,
        "delete" => OperationType::Delete,
        "clear" => OperationType::Clear,
        _ => {
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some(format!("Invalid operation type: {}", operation_type)),
            });
        }
    };
    
    // SAFE: Generate context key with collision detection
    let context_key = generate_context_key(&device_id, &app_package, &database_filename);
    
    // Check for existing changes to validate context uniqueness
    let existing_changes = history_manager.get_changes(&context_key).await;
    if let Some(first_change) = existing_changes.first() {
        if let Err(collision_error) = validate_context_key(
            &context_key,
            &device_id,
            &app_package,
            &database_filename,
            Some(first_change)
        ).await {
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some(collision_error),
            });
        }
    }
    
    let change_event = ChangeEvent {
        id: Uuid::new_v4().to_string(),
        timestamp: Utc::now(),
        context_key: context_key.clone(),
        database_path: current_db_path,
        database_filename,
        table_name,
        operation_type: operation,
        user_context: UserContext {
            device_id,
            device_name,
            device_type,
            app_package,
            app_name,
            session_id: crate::commands::database::change_history::types::get_session_id(),
        },
        changes: vec![], // Will be populated by field diff logic in Phase 2
        row_identifier: None, // Will be populated by row identification logic in Phase 2
        metadata: ChangeMetadata {
            affected_rows: 1,
            execution_time_ms: 0, // Will be measured in Phase 2
            sql_statement: None,
            original_remote_path: None,
            pull_timestamp: Utc::now(),
        },
    };
    
    // SAFETY: Cannot fail due to memory bounds (Critical Issue #1 fix)
    match history_manager.record_change(change_event).await {
        Ok(()) => Ok(DbResponse {
            success: true,
            data: Some(context_key),
            error: None,
        }),
        Err(error) => Ok(DbResponse {
            success: false,
            data: None,
            error: Some(error),
        }),
    }
}

// SAFE: Read-only operation, cannot crash
#[command]
pub async fn get_database_change_history(
    context_key: String,
    table_name: Option<String>,
    history_manager: State<'_, ChangeHistoryManager>,
) -> Result<DbResponse<Vec<ChangeEvent>>, String> {
    let changes = if let Some(table) = table_name.as_ref() {
        history_manager.get_changes_for_table(&context_key, table).await
    } else {
        history_manager.get_changes(&context_key).await
    };
    
    Ok(DbResponse {
        success: true,
        data: Some(changes),
        error: None,
    })
}

// SAFE: Read-only operation for last change time
#[command]
pub async fn get_last_change_time(
    context_key: String,
    table_name: String,
    history_manager: State<'_, ChangeHistoryManager>,
) -> Result<DbResponse<Option<String>>, String> {
    let last_time = history_manager
        .get_last_change_time(&context_key, &table_name)
        .await
        .map(|time| time.to_rfc3339());
    
    Ok(DbResponse {
        success: true,
        data: Some(last_time),
        error: None,
    })
}

// SAFE: Get context summary for UI display
#[command]
pub async fn get_context_summary(
    context_key: String,
    history_manager: State<'_, ChangeHistoryManager>,
) -> Result<DbResponse<Option<ContextSummary>>, String> {
    let summary = history_manager.get_context_summary(&context_key).await;
    
    Ok(DbResponse {
        success: true,
        data: Some(summary),
        error: None,
    })
}

// SAFE: Get all context summaries for admin/debug view
#[command]
pub async fn get_all_context_summaries(
    history_manager: State<'_, ChangeHistoryManager>,
) -> Result<DbResponse<Vec<ContextSummary>>, String> {
    let summaries = history_manager.get_all_context_summaries().await;
    
    Ok(DbResponse {
        success: true,
        data: Some(summaries),
        error: None,
    })
}

// SAFE: Clear changes for context (cleanup operation)
#[command]
pub async fn clear_context_changes(
    context_key: String,
    history_manager: State<'_, ChangeHistoryManager>,
) -> Result<DbResponse<bool>, String> {
    history_manager.clear_changes(&context_key).await;
    
    Ok(DbResponse {
        success: true,
        data: Some(true),
        error: None,
    })
}

// SAFE: Diagnostic operation to check memory usage
#[command]
pub async fn get_change_history_diagnostics(
    history_manager: State<'_, ChangeHistoryManager>,
) -> Result<DbResponse<serde_json::Value>, String> {
    let active_contexts = history_manager.get_active_contexts().await;
    let memory_usage_mb = history_manager.get_memory_usage_mb();
    
    let diagnostics = serde_json::json!({
        "active_contexts": active_contexts.len(),
        "memory_usage_mb": memory_usage_mb,
        "max_contexts": 50,
        "max_changes_per_context": 100,
        "contexts": active_contexts
    });
    
    Ok(DbResponse {
        success: true,
        data: Some(diagnostics),
        error: None,
    })
}

// Helper function to generate context key from current app state
// Will be used in Phase 2 integration
pub fn generate_context_from_app_state(
    device_id: &str,
    app_package: &str,
    database_filename: &str,
) -> String {
    generate_context_key(device_id, app_package, database_filename)
}
