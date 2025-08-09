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
    generate_custom_file_context_key,
    is_custom_file_context_key,
    get_session_id,
};

pub use manager::ChangeHistoryManager;

pub use integration::{
    capture_old_values_for_update,
    create_field_changes,
    extract_context_from_path,
    record_change_with_safety,
    create_change_event,
};
