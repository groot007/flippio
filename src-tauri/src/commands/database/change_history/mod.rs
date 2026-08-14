// src-tauri/src/commands/database/change_history/mod.rs
// Change history module exports
// Following CHANGE_HISTORY_IMPLEMENTATION.md structure

pub mod commands;
pub mod integration;
pub mod manager;
pub mod types;

// Re-export commonly used types
pub use types::{
    generate_context_key, generate_custom_file_context_key, get_session_id,
    is_custom_file_context_key, ChangeEvent, ChangeMetadata, ContextSummary, FieldChange,
    OperationType, UserContext,
};

pub use manager::ChangeHistoryManager;

pub use integration::{
    capture_old_values_for_update, create_change_event, create_field_changes,
    extract_context_from_path, record_change_with_safety,
};
