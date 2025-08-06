// src-tauri/src/commands/database/change_history/types.rs
// Safe data structures for change tracking system
// Following CHANGE_HISTORY_IMPLEMENTATION.md with critical issue fixes

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeEvent {
    pub id: String,                           // UUID for the change
    pub timestamp: DateTime<Utc>,             // When the change occurred
    pub context_key: String,                  // Unique context identifier (device-package-db)
    pub database_path: String,                // Local database file path
    pub database_filename: String,            // Original database filename
    pub table_name: String,                   // Which table was modified
    pub operation_type: OperationType,        // INSERT/UPDATE/DELETE/CLEAR
    pub user_context: UserContext,            // Device/app context
    pub changes: Vec<FieldChange>,            // Detailed field-level changes
    pub row_identifier: Option<String>,       // Primary key or unique identifier
    pub metadata: ChangeMetadata,             // Additional context
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OperationType {
    Insert,
    Update,
    Delete,
    Clear,        // Entire table cleared
    BulkInsert { count: usize },
    BulkUpdate { count: usize },
    BulkDelete { count: usize },
    Revert {      // Added from our implementation docs
        original_change_id: String,
        cascade_reverted_ids: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldChange {
    pub field_name: String,
    pub old_value: Option<serde_json::Value>,
    pub new_value: Option<serde_json::Value>,
    pub data_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserContext {
    pub device_id: String,
    pub device_name: String,
    pub device_type: String,                  // "android", "iphone-device", "simulator"
    pub app_package: String,
    pub app_name: String,
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeMetadata {
    pub affected_rows: usize,
    pub execution_time_ms: u64,
    pub sql_statement: Option<String>,        // For debugging/audit
    pub original_remote_path: Option<String>, // Original path on device
    pub pull_timestamp: DateTime<Utc>,       // When database was pulled from device
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextSummary {
    pub context_key: String,
    pub device_name: String,
    pub app_name: String,
    pub database_filename: String,
    pub total_changes: usize,
    pub last_change_time: Option<DateTime<Utc>>,
}

// SAFE: Context key generation with full collision detection (Issue #5 fix)
pub fn generate_context_key(device_id: &str, package_name: &str, database_filename: &str) -> String {
    use sha2::{Sha256, Digest};
    use base64::{Engine as _, engine::general_purpose};
    
    // Normalize filename to handle path variations (Issue #10 fix)
    // Handle both Unix and Windows path separators
    let normalized_filename = database_filename
        .split(['/', '\\']) // Split on both separators
        .last() // Get the last component (filename)
        .unwrap_or(database_filename);
    
    let context_string = format!("{}:{}:{}", device_id, package_name, normalized_filename);
    let mut hasher = Sha256::new();
    hasher.update(context_string.as_bytes());
    let result = hasher.finalize();
    
    // Use full hash - no truncation to avoid collisions (Critical Issue #5 fix)
    general_purpose::STANDARD_NO_PAD.encode(&result)
}

// SAFE: Validate context uniqueness to prevent collisions
pub async fn validate_context_key(
    context_key: &str,
    expected_device_id: &str,
    expected_package: &str,
    expected_filename: &str,
    existing_change: Option<&ChangeEvent>
) -> Result<(), String> {
    if let Some(change) = existing_change {
        // Collision detection
        if change.user_context.device_id != expected_device_id ||
           change.user_context.app_package != expected_package ||
           change.database_filename != expected_filename {
            
            return Err(format!(
                "Context collision detected: {} already exists for different context", 
                context_key
            ));
        }
    }
    
    Ok(())
}

// Helper to get session ID safely
pub fn get_session_id() -> String {
    use uuid::Uuid;
    Uuid::new_v4().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_context_key_generation() {
        let key1 = generate_context_key("device1", "com.app1", "db.sqlite");
        let key2 = generate_context_key("device1", "com.app1", "db.sqlite");
        let key3 = generate_context_key("device2", "com.app1", "db.sqlite");
        
        // Same inputs should generate same key
        assert_eq!(key1, key2);
        
        // Different inputs should generate different keys
        assert_ne!(key1, key3);
        
        // Keys should be reasonable length (base64 encoded SHA256)
        assert!(key1.len() > 40);
    }
    
    #[test]
    fn test_path_normalization() {
        let key1 = generate_context_key("device1", "app1", "db.sqlite");
        let key2 = generate_context_key("device1", "app1", "/path/to/db.sqlite");
        let key3 = generate_context_key("device1", "app1", "C:\\path\\to\\db.sqlite");
        
        // All should generate same key regardless of path format
        // since we extract just the filename using string splitting
        assert_eq!(key1, key2, "Unix path should match filename");
        assert_eq!(key1, key3, "Windows path should match filename");
        
        // Test our filename extraction logic directly
        let test_cases = vec![
            ("db.sqlite", "db.sqlite"),
            ("/path/to/db.sqlite", "db.sqlite"),
            ("C:\\path\\to\\db.sqlite", "db.sqlite"),
            ("\\network\\path\\to\\db.sqlite", "db.sqlite"),
        ];
        
        for (input, expected) in test_cases {
            let normalized = input.split(['/', '\\']).last().unwrap_or(input);
            assert_eq!(normalized, expected, "Failed to normalize: {}", input);
        }
    }
}
