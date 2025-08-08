// src-tauri/src/commands/database/change_history/mod.rs
// Change history module exports
// Following CHANGE_HISTORY_IMPLEMENTATION.md structure

pub mod types;
pub mod manager;
pub mod commands;
pub mod integration;

// Re-export commonly used types
pub use types::{
    ChangeEvent,
    OperationType,
    FieldChange,
    UserContext,
    ChangeMetadata,
    ContextSummary,
    generate_context_key,
    validate_context_key,
    get_session_id,
};

pub use manager::ChangeHistoryManager;

pub use commands::{
    record_database_change_safe,
    get_database_change_history,
    get_last_change_time,
    get_context_summary,
    get_all_context_summaries,
    clear_context_changes,
    get_change_history_diagnostics,
    generate_context_from_app_state,
};

pub use integration::{
    capture_old_values_for_update,
    create_field_changes,
    extract_context_from_path,
    record_change_with_safety,
    create_change_event,
};
