# Database Change History Implementation Plan

## Overview

This document outlines the implementation of a comprehensive database change history system for Flippio, providing users with granular tracking of database modifications and the ability to revert changes with a git-like diff experience.

## Architecture Decisions

### Storage Strategy
- **Memory-based with optional persistence**: Changes stored in memory during app session
- **Per-database limit**: Maximum 100 changes per database file
- **Session-based**: History cleared on app close (with room for future persistence)
- **Change log structure**: Event sourcing pattern with field-level diffs

### UI Integration
- **Existing Modal**: Use `src/renderer/src/components/common/FLModal.tsx`
- **TableFooter integration**: Add change indicator showing time since last change
- **Expandable items**: Git-like diff viewer for each change
- **Force revert**: Allow users to override conflict warnings

## Implementation Structure

### 1. Backend (Rust) - Change Tracking System

#### Core Data Structures
```rust
// src-tauri/src/commands/database/change_history.rs

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

// Context key generation for unique history per device-package-database
pub fn generate_context_key(device_id: &str, package_name: &str, database_filename: &str) -> String {
    use sha2::{Sha256, Digest};
    
    let context_string = format!("{}:{}:{}", device_id, package_name, database_filename);
    let mut hasher = Sha256::new();
    hasher.update(context_string.as_bytes());
    let result = hasher.finalize();
    format!("{:x}", result)[..16].to_string() // Use first 16 chars of hash
}

// Helper to extract context from current app state
pub fn get_current_context_key(
    device_id: &str,
    package_name: &str, 
    database_file: &DatabaseFile
) -> String {
    generate_context_key(device_id, package_name, &database_file.filename)
}
```

#### Change History Manager
```rust
// In-memory storage with per-context limits (device-package-database combination)
pub struct ChangeHistoryManager {
    changes: Arc<RwLock<HashMap<String, VecDeque<ChangeEvent>>>>, // context_key -> changes
    max_changes_per_context: usize, // Default: 100
}

impl ChangeHistoryManager {
    pub fn new() -> Self {
        Self {
            changes: Arc::new(RwLock::new(HashMap::new())),
            max_changes_per_context: 100,
        }
    }
    
    pub async fn record_change(&self, change: ChangeEvent) -> Result<(), String> {
        let mut changes_map = self.changes.write().await;
        let context_changes = changes_map
            .entry(change.context_key.clone())
            .or_insert_with(VecDeque::new);
        
        // Add new change to front (most recent first)
        context_changes.push_front(change);
        
        // Maintain size limit per context
        while context_changes.len() > self.max_changes_per_context {
            context_changes.pop_back();
        }
        
        log::info!("Recorded change for context: {} (total: {})", 
                   change.context_key, context_changes.len());
        
        Ok(())
    }
    
    pub async fn get_changes(&self, context_key: &str) -> Vec<ChangeEvent> {
        let changes_map = self.changes.read().await;
        changes_map
            .get(context_key)
            .map(|changes| changes.iter().cloned().collect())
            .unwrap_or_default()
    }
    
    pub async fn get_changes_for_table(&self, context_key: &str, table_name: &str) -> Vec<ChangeEvent> {
        let changes_map = self.changes.read().await;
        changes_map
            .get(context_key)
            .map(|changes| {
                changes.iter()
                    .filter(|change| change.table_name == table_name)
                    .cloned()
                    .collect()
            })
            .unwrap_or_default()
    }
    
    pub async fn clear_changes(&self, context_key: &str) {
        let mut changes_map = self.changes.write().await;
        changes_map.remove(context_key);
        log::info!("Cleared changes for context: {}", context_key);
    }
    
    pub async fn get_last_change_time(&self, context_key: &str, table_name: &str) -> Option<DateTime<Utc>> {
        let changes_map = self.changes.read().await;
        changes_map.get(context_key)?
            .iter()
            .find(|change| change.table_name == table_name)
            .map(|change| change.timestamp)
    }
    
    // Get all contexts (for debugging/admin purposes)
    pub async fn get_active_contexts(&self) -> Vec<String> {
        let changes_map = self.changes.read().await;
        changes_map.keys().cloned().collect()
    }
    
    // Get context summary for UI display
    pub async fn get_context_summary(&self, context_key: &str) -> Option<ContextSummary> {
        let changes_map = self.changes.read().await;
        let changes = changes_map.get(context_key)?;
        
        if changes.is_empty() {
            return None;
        }
        
        let first_change = changes.front()?;
        Some(ContextSummary {
            context_key: context_key.to_string(),
            device_name: first_change.user_context.device_name.clone(),
            app_name: first_change.user_context.app_name.clone(),
            database_filename: first_change.database_filename.clone(),
            total_changes: changes.len(),
            last_change_time: changes.front().map(|c| c.timestamp),
        })
    }
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
```

#### Tauri Commands
```rust
// Database change history commands with context-aware operations
#[tauri::command]
pub async fn get_database_change_history(
    context_key: String,
    table_name: Option<String>,
    history_manager: State<'_, ChangeHistoryManager>,
) -> Result<DbResponse<Vec<ChangeEvent>>, String> {
    let changes = if let Some(table) = table_name {
        history_manager.get_changes_for_table(&context_key, &table).await
    } else {
        history_manager.get_changes(&context_key).await
    };
    
    Ok(DbResponse {
        success: true,
        data: Some(changes),
        error: None,
    })
}

#[tauri::command]
pub async fn get_last_change_time(
    context_key: String,
    table_name: String,
    history_manager: State<'_, ChangeHistoryManager>,
) -> Result<DbResponse<Option<String>>, String> {
    let last_time = history_manager.get_last_change_time(&context_key, &table_name).await;
    
    Ok(DbResponse {
        success: true,
        data: Some(last_time.map(|t| t.to_rfc3339())),
        error: None,
    })
}

#[tauri::command]
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

#[tauri::command]
pub async fn get_all_active_contexts(
    history_manager: State<'_, ChangeHistoryManager>,
) -> Result<DbResponse<Vec<ContextSummary>>, String> {
    let context_keys = history_manager.get_active_contexts().await;
    let mut summaries = Vec::new();
    
    for context_key in context_keys {
        if let Some(summary) = history_manager.get_context_summary(&context_key).await {
            summaries.push(summary);
        }
    }
    
    // Sort by last change time (most recent first)
    summaries.sort_by(|a, b| {
        b.last_change_time
            .unwrap_or_else(|| DateTime::from_timestamp(0, 0).unwrap())
            .cmp(&a.last_change_time.unwrap_or_else(|| DateTime::from_timestamp(0, 0).unwrap()))
    });
    
    Ok(DbResponse {
        success: true,
        data: Some(summaries),
        error: None,
    })
}

## Advanced Revert Strategy & Edge Cases

### **Revert Chain Logic**

When reverting a change that has subsequent changes, we need to handle the **dependency chain**:

#### Scenario: Revert Change #1 (oldest) when Changes #2, #3, #4, #5 exist

```
Timeline:
Change #1: UPDATE users SET name='Alice' WHERE id=1 (name: 'Bob' → 'Alice')
Change #2: UPDATE users SET age=30 WHERE id=1 (age: 25 → 30)  
Change #3: UPDATE users SET name='Alice Smith' WHERE id=1 (name: 'Alice' → 'Alice Smith')
Change #4: INSERT users (id=2, name='John', age=28)
Change #5: UPDATE users SET age=31 WHERE id=1 (age: 30 → 31)

User wants to revert Change #1 (Alice → Bob)
But Change #3 modified the same field (name) afterwards!
```

#### **Solution: Smart Cascade Revert with User Confirmation**

#[tauri::command]
pub async fn revert_database_change(
    change_id: String,
    context_key: String,
    force_revert: bool,
    state: State<'_, DbPool>,
    db_cache: State<'_, DbConnectionCache>,
    history_manager: State<'_, ChangeHistoryManager>,
) -> Result<DbResponse<RevertResult>, String> {
    // Step 1: Find the target change and all subsequent changes
    let all_changes = history_manager.get_changes(&context_key).await;
    let target_change_index = all_changes
        .iter()
        .position(|c| c.id == change_id)
        .ok_or_else(|| format!("Change with ID {} not found", change_id))?;
    
    let target_change = &all_changes[target_change_index];
    let subsequent_changes: Vec<_> = all_changes[0..target_change_index].to_vec(); // More recent changes
    
    // Step 2: Analyze conflicts and dependencies
    let conflict_analysis = analyze_revert_conflicts(target_change, &subsequent_changes).await?;
    
    if !conflict_analysis.conflicts.is_empty() && !force_revert {
        return Ok(DbResponse {
            success: false,
            data: Some(RevertResult::ConflictsDetected {
                conflicts: conflict_analysis.conflicts,
                affected_changes: conflict_analysis.affected_changes,
                revert_strategy: conflict_analysis.recommended_strategy,
            }),
            error: Some("Conflicts detected. Use force_revert or resolve manually.".to_string()),
        });
    }
    
    // Step 3: Execute cascade revert (newest to oldest)
    let pool = get_current_pool(&state, &db_cache, Some(target_change.database_path.clone())).await?;
    let mut transaction = pool.begin().await?;
    let mut reverted_changes = Vec::new();
    
    // Revert in reverse order (most recent first)
    match conflict_analysis.recommended_strategy {
        RevertStrategy::CascadeAll => {
            // Revert all subsequent changes first, then the target
            for change in &subsequent_changes {
                if affects_same_data(target_change, change) {
                    execute_single_revert(&mut transaction, change).await?;
                    reverted_changes.push(change.id.clone());
                }
            }
            execute_single_revert(&mut transaction, target_change).await?;
            reverted_changes.push(target_change.id.clone());
        },
        RevertStrategy::SmartMerge => {
            // Try to revert only the target change, merging conflicts intelligently
            execute_smart_revert(&mut transaction, target_change, &subsequent_changes).await?;
            reverted_changes.push(target_change.id.clone());
        },
        RevertStrategy::FieldLevel => {
            // Revert only non-conflicting fields
            execute_field_level_revert(&mut transaction, target_change, &conflict_analysis).await?;
            reverted_changes.push(target_change.id.clone());
        }
    }
    
    // Step 4: Record the revert operation as a new change
    let revert_event = ChangeEvent {
        id: Uuid::new_v4().to_string(),
        timestamp: Utc::now(),
        context_key: context_key.clone(),
        database_path: target_change.database_path.clone(),
        database_filename: target_change.database_filename.clone(),
        table_name: target_change.table_name.clone(),
        operation_type: OperationType::Revert { 
            original_change_id: change_id,
            cascade_reverted_ids: reverted_changes.clone(),
        },
        user_context: get_current_user_context()?,
        changes: vec![], // Revert changes computed during execution
        row_identifier: target_change.row_identifier.clone(),
        metadata: ChangeMetadata {
            affected_rows: reverted_changes.len(),
            execution_time_ms: 0, // Will be set
            sql_statement: Some("REVERT OPERATION".to_string()),
            original_remote_path: target_change.metadata.original_remote_path.clone(),
            pull_timestamp: Utc::now(),
        },
    };
    
    record_change_event(&mut transaction, revert_event).await?;
    transaction.commit().await?;
    
    Ok(DbResponse {
        success: true,
        data: Some(RevertResult::Success {
            reverted_change_ids: reverted_changes,
            strategy_used: conflict_analysis.recommended_strategy,
        }),
        error: None,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RevertStrategy {
    CascadeAll,      // Revert all subsequent conflicting changes
    SmartMerge,      // Merge changes intelligently  
    FieldLevel,      // Revert only non-conflicting fields
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictAnalysis {
    pub conflicts: Vec<FieldConflict>,
    pub affected_changes: Vec<String>, // Change IDs that would be affected
    pub recommended_strategy: RevertStrategy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldConflict {
    pub field_name: String,
    pub target_change_value: Option<serde_json::Value>,
    pub conflicting_changes: Vec<ConflictingChange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictingChange {
    pub change_id: String,
    pub timestamp: DateTime<Utc>,
    pub new_value: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RevertResult {
    Success {
        reverted_change_ids: Vec<String>,
        strategy_used: RevertStrategy,
    },
    ConflictsDetected {
        conflicts: Vec<FieldConflict>,
        affected_changes: Vec<String>,
        revert_strategy: RevertStrategy,
    },
}

// Conflict analysis implementation
async fn analyze_revert_conflicts(
    target_change: &ChangeEvent,
    subsequent_changes: &[ChangeEvent],
) -> Result<ConflictAnalysis, String> {
    let mut conflicts = Vec::new();
    let mut affected_changes = Vec::new();
    
    // Check each field in the target change
    for target_field_change in &target_change.changes {
        let field_name = &target_field_change.field_name;
        let mut conflicting_changes = Vec::new();
        
        // Find subsequent changes to the same field on the same row
        for subsequent in subsequent_changes {
            if affects_same_row(target_change, subsequent) {
                for subsequent_field in &subsequent.changes {
                    if subsequent_field.field_name == *field_name {
                        conflicting_changes.push(ConflictingChange {
                            change_id: subsequent.id.clone(),
                            timestamp: subsequent.timestamp,
                            new_value: subsequent_field.new_value.clone(),
                        });
                        
                        if !affected_changes.contains(&subsequent.id) {
                            affected_changes.push(subsequent.id.clone());
                        }
                    }
                }
            }
        }
        
        if !conflicting_changes.is_empty() {
            conflicts.push(FieldConflict {
                field_name: field_name.clone(),
                target_change_value: target_field_change.old_value.clone(),
                conflicting_changes,
            });
        }
    }
    
    // Determine recommended strategy based on conflict complexity
    let recommended_strategy = if conflicts.is_empty() {
        RevertStrategy::SmartMerge // No conflicts, safe to revert
    } else if conflicts.len() == 1 && affected_changes.len() <= 2 {
        RevertStrategy::FieldLevel // Few conflicts, can revert field by field
    } else {
        RevertStrategy::CascadeAll // Complex conflicts, safer to cascade
    };
    
    Ok(ConflictAnalysis {
        conflicts,
        affected_changes,
        recommended_strategy,
    })
}

// Helper functions
fn affects_same_row(change1: &ChangeEvent, change2: &ChangeEvent) -> bool {
    change1.table_name == change2.table_name &&
    change1.row_identifier == change2.row_identifier
}

fn affects_same_data(target: &ChangeEvent, other: &ChangeEvent) -> bool {
    if target.table_name != other.table_name {
        return false;
    }
    
    // Check if they affect the same row
    if let (Some(target_row), Some(other_row)) = (&target.row_identifier, &other.row_identifier) {
        return target_row == other_row;
    }
    
    // Check if they affect the same fields
    let target_fields: std::collections::HashSet<_> = target.changes.iter()
        .map(|c| &c.field_name)
        .collect();
    let other_fields: std::collections::HashSet<_> = other.changes.iter()
        .map(|c| &c.field_name)
        .collect();
    
    !target_fields.is_disjoint(&other_fields)
}

### **Clear Table Diff Handling**

When a user clears an entire table, we need to show meaningful diff information:

#### **Clear Table Change Event Structure**
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClearTableSnapshot {
    pub table_name: String,
    pub row_count: usize,
    pub sample_rows: Vec<HashMap<String, serde_json::Value>>, // First 5 rows as sample
    pub table_schema: Vec<ColumnInfo>,
    pub full_data_compressed: Option<Vec<u8>>, // Compressed full table data (optional)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    pub default_value: Option<String>,
}

// Enhanced clear table command with snapshot
#[tauri::command]
pub async fn db_clear_table(
    state: State<'_, DbPool>,
    db_cache: State<'_, DbConnectionCache>,
    history_manager: State<'_, ChangeHistoryManager>,
    table_name: String,
    current_db_path: Option<String>,
    // Context parameters
    device_id: Option<String>,
    device_name: Option<String>,
    device_type: Option<String>,
    app_package: Option<String>,
    app_name: Option<String>,
    database_filename: Option<String>,
) -> Result<DbResponse<u64>, String> {
    let start_time = std::time::Instant::now();
    let context_key = generate_context_key(
        &device_id.unwrap_or_default(),
        &app_package.unwrap_or_default(),
        &database_filename.unwrap_or_default()
    );
    
    let pool = get_current_pool(&state, &db_cache, current_db_path.clone()).await?;
    
    // Step 1: Create snapshot before clearing
    let snapshot = create_table_snapshot(&pool, &table_name).await?;
    
    // Step 2: Execute clear operation
    let delete_query = format!("DELETE FROM {}", table_name);
    let result = sqlx::query(&delete_query).execute(&pool).await?;
    let affected_rows = result.rows_affected();
    
    // Step 3: Record as special Clear operation with snapshot
    let clear_event = ChangeEvent {
        id: Uuid::new_v4().to_string(),
        timestamp: Utc::now(),
        context_key: context_key.clone(),
        database_path: current_db_path.clone().unwrap(),
        database_filename: database_filename.unwrap_or_else(|| "unknown.db".to_string()),
        table_name: table_name.clone(),
        operation_type: OperationType::Clear { 
            snapshot: snapshot.clone(),
        },
        user_context: UserContext {
            device_id: device_id.unwrap_or_default(),
            device_name: device_name.unwrap_or_else(|| "Unknown Device".to_string()),
            device_type: device_type.unwrap_or_default(),
            app_package: app_package.unwrap_or_default(),
            app_name: app_name.unwrap_or_else(|| "Unknown App".to_string()),
            session_id: get_session_id(),
        },
        changes: vec![], // No individual field changes for clear operation
        row_identifier: None, // Affects all rows
        metadata: ChangeMetadata {
            affected_rows: affected_rows as usize,
            execution_time_ms: start_time.elapsed().as_millis() as u64,
            sql_statement: Some(delete_query),
            original_remote_path: None,
            pull_timestamp: Utc::now(),
        },
    };
    
    history_manager.record_change(clear_event).await?;
    
    Ok(DbResponse {
        success: true,
        data: Some(affected_rows),
        error: None,
    })
}

async fn create_table_snapshot(
    pool: &Pool<Sqlite>,
    table_name: &str,
) -> Result<ClearTableSnapshot, sqlx::Error> {
    // Get table schema
    let schema_query = format!("PRAGMA table_info({})", table_name);
    let schema_rows = sqlx::query(&schema_query).fetch_all(pool).await?;
    
    let mut table_schema = Vec::new();
    for row in schema_rows {
        let column_info = ColumnInfo {
            name: row.get::<String, _>("name"),
            data_type: row.get::<String, _>("type"),
            nullable: row.get::<i32, _>("notnull") == 0,
            default_value: row.try_get::<Option<String>, _>("dflt_value").ok().flatten(),
        };
        table_schema.push(column_info);
    }
    
    // Get row count
    let count_query = format!("SELECT COUNT(*) as count FROM {}", table_name);
    let count_result = sqlx::query(&count_query).fetch_one(pool).await?;
    let row_count: i64 = count_result.get("count");
    
    // Get sample rows (first 5)
    let sample_query = format!("SELECT * FROM {} LIMIT 5", table_name);
    let sample_rows_result = sqlx::query(&sample_query).fetch_all(pool).await?;
    
    let mut sample_rows = Vec::new();
    for row in sample_rows_result {
        let mut row_data = HashMap::new();
        for column in &table_schema {
            let value: Option<String> = row.try_get(&column.name).ok();
            row_data.insert(
                column.name.clone(),
                value.map(serde_json::Value::String).unwrap_or(serde_json::Value::Null)
            );
        }
        sample_rows.push(row_data);
    }
    
    // Optionally compress full table data for large tables
    let full_data_compressed = if row_count <= 1000 {
        // For small tables, store full data
        let full_query = format!("SELECT * FROM {}", table_name);
        let full_rows = sqlx::query(&full_query).fetch_all(pool).await?;
        
        let mut all_rows = Vec::new();
        for row in full_rows {
            let mut row_data = HashMap::new();
            for column in &table_schema {
                let value: Option<String> = row.try_get(&column.name).ok();
                row_data.insert(
                    column.name.clone(),
                    value.map(serde_json::Value::String).unwrap_or(serde_json::Value::Null)
                );
            }
            all_rows.push(row_data);
        }
        
        // Compress the data using gzip
        let json_data = serde_json::to_string(&all_rows).unwrap();
        let compressed = compress_data(json_data.as_bytes())?;
        Some(compressed)
    } else {
        None // Too large, don't store full data
    };
    
    Ok(ClearTableSnapshot {
        table_name: table_name.to_string(),
        row_count: row_count as usize,
        sample_rows,
        table_schema,
        full_data_compressed,
    })
}

#[tauri::command]
pub async fn export_change_history(
    context_key: String,
    table_name: Option<String>,
    history_manager: State<'_, ChangeHistoryManager>,
) -> Result<DbResponse<String>, String> {
    let changes = if let Some(table) = table_name.as_ref() {
        history_manager.get_changes_for_table(&context_key, table).await
    } else {
        history_manager.get_changes(&context_key).await
    };
    
    let context_summary = history_manager.get_context_summary(&context_key).await;
    
    // Export as JSON diff format with context information
    let export_data = ExportedChangeHistory {
        context_key: context_key.clone(),
        context_summary,
        table_name,
        exported_at: Utc::now(),
        changes,
    };
    
    let json_string = serde_json::to_string_pretty(&export_data)
        .map_err(|e| format!("Failed to serialize changes: {}", e))?;
    
    Ok(DbResponse {
        success: true,
        data: Some(json_string),
        error: None,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportedChangeHistory {
    pub context_key: String,
    pub context_summary: Option<ContextSummary>,
    pub table_name: Option<String>,
    pub exported_at: DateTime<Utc>,
    pub changes: Vec<ChangeEvent>,
}
```

#### Integration with Existing Database Commands

Modify existing database commands to record changes with proper context:

```rust
// Enhanced db_update_table_row with context-aware change tracking
#[tauri::command]
pub async fn db_update_table_row(
    state: State<'_, DbPool>,
    db_cache: State<'_, DbConnectionCache>,
    history_manager: State<'_, ChangeHistoryManager>,
    table_name: String,
    row: HashMap<String, serde_json::Value>,
    condition: String,
    current_db_path: Option<String>,
    // NEW: Context parameters for unique history tracking
    device_id: Option<String>,
    device_name: Option<String>,
    device_type: Option<String>,
    app_package: Option<String>,
    app_name: Option<String>,
    database_filename: Option<String>,
) -> Result<DbResponse<u64>, String> {
    let start_time = std::time::Instant::now();
    
    // Generate context key for this specific device-package-database combination
    let context_key = if let (Some(device), Some(package), Some(filename)) = 
        (&device_id, &app_package, &database_filename) {
        generate_context_key(device, package, filename)
    } else {
        // Fallback to database path if context is not available
        current_db_path.clone().unwrap_or_else(|| "unknown".to_string())
    };
    
    // Validate that we have a specific database path for write operations
    let db_path = match current_db_path.clone() {
        Some(path) => {
            log::info!("📝 UPDATE operation for table '{}' on database: {} (context: {})", 
                      table_name, path, context_key);
            path
        }
        None => {
            log::error!("❌ UPDATE operation requires a specific database path");
            return Ok(DbResponse {
                success: false,
                data: None,
                error: Some("UPDATE operation requires a specific database path".to_string()),
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
    
    // Step 1: Capture old values before update
    let old_values = match capture_row_values(&pool, &table_name, &condition).await {
        Ok(values) => values,
        Err(e) => {
            log::warn!("⚠️ Could not capture old values for change tracking: {}", e);
            HashMap::new() // Continue without old values
        }
    };
    
    // Step 2: Execute the update (existing logic)
    let update_result = execute_update_query(&pool, &table_name, &row, &condition).await?;
    
    // Step 3: Record the change with context
    if update_result > 0 {
        let user_context = UserContext {
            device_id: device_id.unwrap_or_else(|| "unknown".to_string()),
            device_name: device_name.unwrap_or_else(|| "Unknown Device".to_string()),
            device_type: device_type.unwrap_or_else(|| "unknown".to_string()),
            app_package: app_package.unwrap_or_else(|| "unknown".to_string()),
            app_name: app_name.unwrap_or_else(|| "Unknown App".to_string()),
            session_id: get_session_id(), // Get from app state
        };
        
        let change_event = ChangeEvent {
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            context_key: context_key.clone(),
            database_path: db_path,
            database_filename: database_filename.unwrap_or_else(|| "unknown.db".to_string()),
            table_name: table_name.clone(),
            operation_type: OperationType::Update,
            user_context,
            changes: compute_field_changes(&old_values, &row),
            row_identifier: extract_row_identifier(&condition),
            metadata: ChangeMetadata {
                affected_rows: update_result as usize,
                execution_time_ms: start_time.elapsed().as_millis() as u64,
                sql_statement: Some(format!("UPDATE {} SET ... WHERE {}", table_name, condition)),
                original_remote_path: None, // Could be passed from frontend
                pull_timestamp: Utc::now(), // When this database was last pulled
            },
        };
        
        if let Err(e) = history_manager.record_change(change_event).await {
            log::error!("❌ Failed to record change: {}", e);
            // Don't fail the main operation, just log the error
        }
    }
    
    Ok(DbResponse {
        success: true,
        data: Some(update_result),
        error: None,
    })
}

// Helper functions for context management
fn get_session_id() -> String {
    // Generate or get session ID from app state
    // This could be stored in a global state or generated per app launch
    use uuid::Uuid;
    Uuid::new_v4().to_string()[..8].to_string()
}

async fn capture_row_values(
    pool: &Pool<Sqlite>,
    table_name: &str,
    condition: &str,
) -> Result<HashMap<String, serde_json::Value>, sqlx::Error> {
    let query = format!("SELECT * FROM {} WHERE {}", table_name, condition);
    let row = sqlx::query(&query).fetch_optional(pool).await?;
    
    if let Some(row) = row {
        let mut values = HashMap::new();
        for (i, column) in row.columns().iter().enumerate() {
            let value: Option<String> = row.try_get(i).ok();
            values.insert(
                column.name().to_string(),
                value.map(|v| serde_json::Value::String(v))
                     .unwrap_or(serde_json::Value::Null)
            );
        }
        Ok(values)
    } else {
        Ok(HashMap::new())
    }
}

fn compute_field_changes(
    old_values: &HashMap<String, serde_json::Value>,
    new_values: &HashMap<String, serde_json::Value>,
) -> Vec<FieldChange> {
    let mut changes = Vec::new();
    
    // Get all field names from both old and new values
    let mut all_fields: std::collections::HashSet<_> = old_values.keys().collect();
    all_fields.extend(new_values.keys());
    
    for field_name in all_fields {
        let old_value = old_values.get(field_name).cloned();
        let new_value = new_values.get(field_name).cloned();
        
        // Only record if values are different
        if old_value != new_value {
            changes.push(FieldChange {
                field_name: field_name.clone(),
                old_value,
                new_value,
                data_type: infer_data_type(&new_value.or_else(|| old_value.clone())),
            });
        }
    }
    
    changes
}

fn infer_data_type(value: &Option<serde_json::Value>) -> String {
    match value {
        Some(serde_json::Value::String(_)) => "TEXT".to_string(),
        Some(serde_json::Value::Number(n)) => {
            if n.is_i64() { "INTEGER".to_string() }
            else { "REAL".to_string() }
        },
        Some(serde_json::Value::Bool(_)) => "BOOLEAN".to_string(),
        Some(serde_json::Value::Null) => "NULL".to_string(),
        _ => "UNKNOWN".to_string(),
    }
}

fn extract_row_identifier(condition: &str) -> Option<String> {
    // Simple parser to extract primary key from WHERE clause
    // This is a basic implementation - could be more sophisticated
    if let Some(equals_pos) = condition.find('=') {
        let parts: Vec<&str> = condition[..equals_pos].trim().split_whitespace().collect();
        if let Some(field) = parts.last() {
            let value = condition[equals_pos + 1..].trim().trim_matches('\'').trim_matches('"');
            return Some(format!("{}={}", field, value));
        }
    }
    None
}

// Similar modifications needed for:
// - db_insert_table_row
// - db_delete_table_row  
// - db_add_new_row_with_defaults
// - Any bulk operations
```

### 2. Frontend (React/TypeScript) - UI Components

#### Change History Hook
```typescript
// src/renderer/src/hooks/useChangeHistory.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../tauri-api'

export interface ChangeEvent {
  id: string
  timestamp: string
  context_key: string
  database_path: string
  database_filename: string
  table_name: string
  operation_type: 'Insert' | 'Update' | 'Delete' | 'Clear' | { BulkInsert: { count: number } } | { BulkUpdate: { count: number } } | { BulkDelete: { count: number } }
  user_context: {
    device_id: string
    device_name: string
    device_type: string
    app_package: string
    app_name: string
    session_id: string
  }
  changes: Array<{
    field_name: string
    old_value: any
    new_value: any
    data_type: string
  }>
  row_identifier?: string
  metadata: {
    affected_rows: number
    execution_time_ms: number
    sql_statement?: string
    original_remote_path?: string
    pull_timestamp: string
  }
}

export interface ContextSummary {
  context_key: string
  device_name: string
  app_name: string
  database_filename: string
  total_changes: number
  last_change_time?: string
}

// Helper to generate context key on frontend (must match backend)
export function generateContextKey(deviceId: string, packageName: string, databaseFilename: string): string {
  // Use a simple hash for frontend - backend uses SHA256
  const contextString = `${deviceId}:${packageName}:${databaseFilename}`
  let hash = 0
  for (let i = 0; i < contextString.length; i++) {
    const char = contextString.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

// Get context key from current app state
export function useCurrentContextKey() {
  const { selectedDevice } = useCurrentDeviceSelection()
  const { selectedApplication } = useCurrentDeviceSelection()
  const { selectedDatabaseFile } = useCurrentDatabaseSelection()
  
  return useMemo(() => {
    if (!selectedDevice?.id || !selectedApplication?.bundleId || !selectedDatabaseFile?.filename) {
      return null
    }
    
    return generateContextKey(
      selectedDevice.id,
      selectedApplication.bundleId,
      selectedDatabaseFile.filename
    )
  }, [selectedDevice?.id, selectedApplication?.bundleId, selectedDatabaseFile?.filename])
}

export function useChangeHistory(contextKey?: string | null, tableName?: string) {
  return useQuery({
    queryKey: ['changeHistory', contextKey, tableName],
    queryFn: async () => {
      if (!contextKey) return []
      const response = await api.getDatabaseChangeHistory(contextKey, tableName)
      return response.success ? response.data || [] : []
    },
    enabled: !!contextKey,
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  })
}

export function useLastChangeTime(contextKey?: string | null, tableName?: string) {
  return useQuery({
    queryKey: ['lastChangeTime', contextKey, tableName],
    queryFn: async () => {
      if (!contextKey || !tableName) return null
      const response = await api.getLastChangeTime(contextKey, tableName)
      return response.success && response.data ? new Date(response.data) : null
    },
    enabled: !!contextKey && !!tableName,
    refetchInterval: 10000, // Check every 10 seconds
  })
}

export function useContextSummary(contextKey?: string | null) {
  return useQuery({
    queryKey: ['contextSummary', contextKey],
    queryFn: async () => {
      if (!contextKey) return null
      const response = await api.getContextSummary(contextKey)
      return response.success ? response.data : null
    },
    enabled: !!contextKey,
  })
}

export function useAllActiveContexts() {
  return useQuery({
    queryKey: ['allActiveContexts'],
    queryFn: async () => {
      const response = await api.getAllActiveContexts()
      return response.success ? response.data || [] : []
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })
}

export function useRevertChange() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ changeId, contextKey, forceRevert }: { 
      changeId: string
      contextKey: string 
      forceRevert: boolean 
    }) => {
      return await api.revertDatabaseChange(changeId, contextKey, forceRevert)
    },
    onSuccess: (_, variables) => {
      // Invalidate queries related to this context
      queryClient.invalidateQueries({ queryKey: ['changeHistory', variables.contextKey] })
      queryClient.invalidateQueries({ queryKey: ['lastChangeTime', variables.contextKey] })
      queryClient.invalidateQueries({ queryKey: ['contextSummary', variables.contextKey] })
      queryClient.invalidateQueries({ queryKey: ['tableData'] })
      queryClient.invalidateQueries({ queryKey: ['allActiveContexts'] })
    },
  })
}

export function useExportChangeHistory() {
  return useMutation({
    mutationFn: async ({ contextKey, tableName }: { 
      contextKey: string
      tableName?: string 
    }) => {
      return await api.exportChangeHistory(contextKey, tableName)
    },
  })
}
```

#### Enhanced TableFooter Component
```typescript
// Modify src/renderer/src/components/data/TableFooter.tsx
import { ChangeHistoryIndicator } from './ChangeHistoryIndicator'
import { ChangeHistoryModal } from './ChangeHistoryModal'

export function TableFooter({ gridRef, totalRows, onPageSizeChange }: TableFooterProps) {
  // ... existing code ...
  
  const [isChangeHistoryModalOpen, setIsChangeHistoryModalOpen] = useState(false)
  
  return (
    <Box>
      {/* ... existing pagination controls ... */}
      
      {/* Left side controls */}
      <Flex alignItems="center" gap={2}>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleOpenClearTableDialog}
          title="Clear table"
          disabled={!selectedDatabaseTable?.name || isLoading}
        >
          <LuTrash2 color="flipioAccent.purple" />
        </Button>
        
        {/* NEW: Change History Indicator */}
        <ChangeHistoryIndicator
          dbPath={selectedDatabaseFile?.path}
          tableName={selectedDatabaseTable?.name}
          onOpenHistory={() => setIsChangeHistoryModalOpen(true)}
        />
      </Flex>
      
      {/* ... rest of existing code ... */}
      
      {/* NEW: Change History Modal */}
      <ChangeHistoryModal
        isOpen={isChangeHistoryModalOpen}
        onClose={() => setIsChangeHistoryModalOpen(false)}
        dbPath={selectedDatabaseFile?.path}
        tableName={selectedDatabaseTable?.name}
      />
    </Box>
  )
}
```

#### Change History Indicator Component
```typescript
// src/renderer/src/components/data/ChangeHistoryIndicator.tsx
import { Button, Text, HStack } from '@chakra-ui/react'
import { LuClock } from 'react-icons/lu'
import { formatDistanceToNow } from 'date-fns'
import { useCurrentContextKey, useLastChangeTime } from '@renderer/hooks/useChangeHistory'
import { useColorMode } from '@renderer/ui/color-mode'

interface ChangeHistoryIndicatorProps {
  tableName?: string
  onOpenHistory: () => void
}

export function ChangeHistoryIndicator({ 
  tableName, 
  onOpenHistory 
}: ChangeHistoryIndicatorProps) {
  const { colorMode } = useColorMode()
  const contextKey = useCurrentContextKey()
  const { data: lastChangeTime, isLoading } = useLastChangeTime(contextKey, tableName)
  
  const timeDisplay = useMemo(() => {
    if (isLoading) return "Loading..."
    if (!lastChangeTime) return "No changes"
    return formatDistanceToNow(lastChangeTime, { addSuffix: true })
  }, [lastChangeTime, isLoading])
  
  const hasChanges = !!lastChangeTime
  
  if (!contextKey || !tableName) {
    return null // Don't show if we can't determine context
  }
  
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={onOpenHistory}
      opacity={hasChanges ? 1 : 0.6}
      _hover={{ bg: colorMode === 'dark' ? 'gray.700' : 'gray.100' }}
      title={hasChanges ? `Last changed ${timeDisplay}` : 'No changes recorded'}
    >
      <HStack spacing={2}>
        <LuClock size={14} />
        <Text fontSize="xs" fontWeight="medium">
          {timeDisplay}
        </Text>
      </HStack>
    </Button>
  )
}
```

#### Change History Modal Component
```typescript
// src/renderer/src/components/data/ChangeHistoryModal.tsx
import { useState, useMemo } from 'react'
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Flex,
  Badge,
  Collapse,
  Code,
  Divider,
  useToast,
} from '@chakra-ui/react'
import { LuChevronDown, LuChevronUp, LuRotateCcw, LuDownload } from 'react-icons/lu'
import { formatDistanceToNow } from 'date-fns'
import FLModal from '../common/FLModal'
import { useChangeHistory, useRevertChange, useExportChangeHistory, ChangeEvent } from '@renderer/hooks/useChangeHistory'
import { useColorMode } from '@renderer/ui/color-mode'

interface ChangeHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  dbPath?: string
  tableName?: string
}

export function ChangeHistoryModal({ 
  isOpen, 
  onClose, 
  dbPath, 
  tableName 
}: ChangeHistoryModalProps) {
  const { data: changes = [], isLoading, error } = useChangeHistory(dbPath, tableName)
  const exportMutation = useExportChangeHistory()
  const toast = useToast()
  
  const handleExport = async () => {
    if (!dbPath) return
    
    try {
      const result = await exportMutation.mutateAsync({ dbPath, tableName })
      if (result.success && result.data) {
        // Create and download file
        const blob = new Blob([result.data], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${tableName || 'database'}_change_history_${new Date().toISOString().split('T')[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
        
        toast({
          title: 'Export successful',
          description: 'Change history exported as JSON file',
          status: 'success',
          duration: 3000,
        })
      }
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
      })
    }
  }
  
  const modalBody = (
    <VStack spacing={0} align="stretch" maxH="60vh" overflowY="auto">
      {/* Header with export button */}
      <Flex justify="space-between" align="center" mb={4}>
        <Text fontSize="sm" color="gray.600">
          Showing {changes.length} recent changes {tableName && `for table "${tableName}"`}
        </Text>
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<LuDownload size={14} />}
          onClick={handleExport}
          isLoading={exportMutation.isPending}
        >
          Export JSON
        </Button>
      </Flex>
      
      {isLoading ? (
        <Text textAlign="center" py={8} color="gray.500">
          Loading change history...
        </Text>
      ) : changes.length === 0 ? (
        <Text textAlign="center" py={8} color="gray.500">
          No changes recorded yet
        </Text>
      ) : (
        changes.map((change, index) => (
          <ChangeEventItem
            key={change.id}
            change={change}
            isLast={index === changes.length - 1}
          />
        ))
      )}
    </VStack>
  )
  
  return (
    <FLModal
      isOpen={isOpen}
      title={`Change History${tableName ? ` - ${tableName}` : ''}`}
      body={modalBody}
      acceptBtn="Close"
      onAccept={onClose}
      rejectBtn=""
      onReject={() => {}}
    />
  )
}

// Individual change event item
interface ChangeEventItemProps {
  change: ChangeEvent
  isLast: boolean
}

function ChangeEventItem({ change, isLast }: ChangeEventItemProps) {
  const { colorMode } = useColorMode()
  const [isExpanded, setIsExpanded] = useState(false)
  const revertMutation = useRevertChange()
  const toast = useToast()
  
  const operationDisplay = useMemo(() => {
    const type = change.operation_type
    if (typeof type === 'string') {
      return {
        text: type,
        color: type === 'Insert' ? 'green' : type === 'Update' ? 'blue' : type === 'Delete' ? 'red' : 'purple'
      }
    } else {
      const bulkType = Object.keys(type)[0]
      const count = Object.values(type)[0].count
      return {
        text: `${bulkType} (${count})`,
        color: bulkType.includes('Insert') ? 'green' : bulkType.includes('Update') ? 'blue' : 'red'
      }
    }
  }, [change.operation_type])
  
  const handleRevert = async (forceRevert = false) => {
    try {
      const result = await revertMutation.mutateAsync({
        changeId: change.id,
        dbPath: change.database_path,
        forceRevert,
      })
      
      if (result.success) {
        toast({
          title: 'Change reverted',
          description: 'The database change has been successfully reverted',
          status: 'success',
          duration: 3000,
        })
      } else if (result.error?.includes('conflict')) {
        // Show conflict dialog
        const shouldForceRevert = window.confirm(
          `Conflicts detected: ${result.error}\n\nForce revert anyway? This may cause data inconsistency.`
        )
        if (shouldForceRevert) {
          handleRevert(true)
        }
      } else {
        throw new Error(result.error || 'Revert failed')
      }
    } catch (error) {
      toast({
        title: 'Revert failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
      })
    }
  }
  
  return (
    <Box>
      <Flex 
        p={4} 
        align="center" 
        justify="space-between"
        _hover={{ bg: colorMode === 'dark' ? 'gray.700' : 'gray.50' }}
        cursor="pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Flex align="center" gap={3} flex={1}>
          <Badge colorScheme={operationDisplay.color} variant="subtle">
            {operationDisplay.text}
          </Badge>
          
          <VStack align="start" spacing={1} flex={1}>
            <Text fontSize="sm" fontWeight="medium">
              {change.table_name} 
              {change.row_identifier && (
                <Text as="span" ml={2} fontSize="xs" color="gray.500">
                  ID: {change.row_identifier}
                </Text>
              )}
            </Text>
            <Text fontSize="xs" color="gray.600">
              {formatDistanceToNow(new Date(change.timestamp))} ago
              {' • '}
              {change.user_context.device_name}
              {' • '}
              {change.metadata.affected_rows} row{change.metadata.affected_rows !== 1 ? 's' : ''}
            </Text>
          </VStack>
        </Flex>
        
        <HStack spacing={2} onClick={(e) => e.stopPropagation()}>
          <Button
            size="xs"
            variant="ghost"
            colorScheme="red"
            leftIcon={<LuRotateCcw size={12} />}
            onClick={() => handleRevert()}
            isLoading={revertMutation.isPending}
            title="Revert this change"
          >
            Revert
          </Button>
          <Button size="xs" variant="ghost">
            {isExpanded ? <LuChevronUp /> : <LuChevronDown />}
          </Button>
        </HStack>
      </Flex>
      
      <Collapse in={isExpanded}>
        <Box px={4} pb={4}>
          <Divider mb={4} />
          <FieldChangesViewer changes={change.changes} />
          
          {change.metadata.sql_statement && (
            <Box mt={4}>
              <Text fontSize="xs" fontWeight="medium" mb={2}>SQL Statement:</Text>
              <Code fontSize="xs" p={2} borderRadius="md" display="block" whiteSpace="pre-wrap">
                {change.metadata.sql_statement}
              </Code>
            </Box>
          )}
        </Box>
      </Collapse>
      
      {!isLast && <Divider />}
    </Box>
  )
}

// Git-like diff viewer
interface FieldChangesViewerProps {
  changes: ChangeEvent['changes']
}

function FieldChangesViewer({ changes }: FieldChangesViewerProps) {
  const { colorMode } = useColorMode()
  
  if (changes.length === 0) {
    return (
      <Text fontSize="sm" color="gray.500" textAlign="center" py={4}>
        No field changes recorded
      </Text>
    )
  }
  
  return (
    <VStack align="stretch" spacing={3}>
      {changes.map((change, idx) => (
        <Box key={idx} border="1px solid" borderColor="gray.200" borderRadius="md" overflow="hidden">
          <Box bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'} px={3} py={2}>
            <Text fontSize="sm" fontWeight="medium">
              {change.field_name}
              <Badge ml={2} size="sm" variant="outline">
                {change.data_type}
              </Badge>
            </Text>
          </Box>
          
          <HStack align="stretch" spacing={0}>
            {/* Old value */}
            <Box flex={1} bg="red.50" borderRight="1px solid" borderColor="red.200">
              <Box bg="red.100" px={3} py={1}>
                <Text fontSize="xs" color="red.700" fontWeight="medium">
                  - Before
                </Text>
              </Box>
              <Box p={3}>
                <Code fontSize="sm" whiteSpace="pre-wrap" bg="transparent">
                  {change.old_value !== null 
                    ? JSON.stringify(change.old_value, null, 2) 
                    : 'null'
                  }
                </Code>
              </Box>
            </Box>
            
            {/* New value */}
            <Box flex={1} bg="green.50">
              <Box bg="green.100" px={3} py={1}>
                <Text fontSize="xs" color="green.700" fontWeight="medium">
                  + After
                </Text>
              </Box>
              <Box p={3}>
                <Code fontSize="sm" whiteSpace="pre-wrap" bg="transparent">
                  {change.new_value !== null 
                    ? JSON.stringify(change.new_value, null, 2) 
                    : 'null'
                  }
                </Code>
              </Box>
            </Box>
          </HStack>
        </Box>
      ))}
    </VStack>
  )
}
```

#### Update Tauri API
```typescript
// Add to src/renderer/src/tauri-api.ts

export const api = {
  // ... existing methods ...
  
  // Context-aware change history methods
  getDatabaseChangeHistory: async (contextKey: string, tableName?: string) => {
    try {
      const response = await invoke<any>('get_database_change_history', { 
        contextKey, 
        tableName 
      })
      return response
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  },

  getLastChangeTime: async (contextKey: string, tableName: string) => {
    try {
      const response = await invoke<any>('get_last_change_time', { 
        contextKey, 
        tableName 
      })
      return response
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  },

  getContextSummary: async (contextKey: string) => {
    try {
      const response = await invoke<any>('get_context_summary', { 
        contextKey 
      })
      return response
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  },

  getAllActiveContexts: async () => {
    try {
      const response = await invoke<any>('get_all_active_contexts')
      return response
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  },

  revertDatabaseChange: async (changeId: string, contextKey: string, forceRevert: boolean) => {
    try {
      const response = await invoke<any>('revert_database_change', { 
        changeId, 
        contextKey, 
        forceRevert 
      })
      return response
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  },

  exportChangeHistory: async (contextKey: string, tableName?: string) => {
    try {
      const response = await invoke<any>('export_change_history', { 
        contextKey, 
        tableName 
      })
      return response
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  },
}

// Enhanced database operation methods with context parameters
const enhancedDatabaseMethods = {
  updateTableRow: async (tableName: string, row: any, condition: any, dbPath?: string) => {
    // Get current context from app state
    const { selectedDevice } = useCurrentDeviceSelection.getState()
    const { selectedApplication } = useCurrentDeviceSelection.getState()  
    const { selectedDatabaseFile } = useCurrentDatabaseSelection.getState()
    
    try {
      const response = await invoke<any>('db_update_table_row', {
        tableName,
        row,
        condition,
        currentDbPath: dbPath,
        // Context parameters for change tracking
        deviceId: selectedDevice?.id,
        deviceName: selectedDevice?.name,
        deviceType: selectedDevice?.deviceType || selectedDevice?.description,
        appPackage: selectedApplication?.bundleId,
        appName: selectedApplication?.name,
        databaseFilename: selectedDatabaseFile?.filename,
      })
      return response
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  },
  
  // Similar enhancements needed for:
  // insertTableRow, deleteTableRow, addNewRowWithDefaults, etc.
}

// Merge enhanced methods with existing API
Object.assign(api, enhancedDatabaseMethods)
```

## Benefits of Context-Aware Change Tracking

### **Problem Solved**:
Your concern about database uniqueness across devices/packages is now handled by using a **composite context key** that combines:

- **Device ID**: Unique identifier for each device/simulator
- **Package Name**: App bundle identifier (e.g., com.example.myapp)  
- **Database Filename**: Original database filename (e.g., userdata.db)

### **Context Key Generation**:
```typescript
// Example context keys for different scenarios:

// iPhone Device + WhatsApp + ChatStorage.sqlite
"abc123def456:net.whatsapp.WhatsApp:ChatStorage.sqlite" → "a1b2c3d4e5f67890"

// Android Device + WhatsApp + msgstore.db  
"emulator-5554:com.whatsapp:msgstore.db" → "f9e8d7c6b5a43210"

// Same app, different devices = separate histories
"iPhone-A:com.myapp:data.db" → "11111111"
"iPhone-B:com.myapp:data.db" → "22222222"

// Same device, different apps = separate histories  
"iPhone-A:com.app1:cache.db" → "33333333"
"iPhone-A:com.app2:cache.db" → "44444444"
```

### **Key Benefits**:

1. **True Isolation**: Changes for `userdata.db` from iPhone A won't mix with `userdata.db` from iPhone B
2. **Cross-App Safety**: `cache.db` changes from different apps remain separate
3. **Session Clarity**: Users see exactly which device/app context they're working with
4. **Export Precision**: Exported history includes full context information
5. **Revert Accuracy**: Reverts apply to the exact device-app-database combination

### **UI Improvements**:

The modal will now show context information:
```
Change History - userdata.db
📱 iPhone 13 Pro • MyApp • Pulled 2 hours ago
```

Instead of just:
```
Change History - userdata.db  
```

### **Future-Proof Design**:
- **Scalable**: Handles any number of device/app/database combinations
- **Persistent-Ready**: Context keys will work seamlessly when we add persistence
- **Multi-User Ready**: Can extend to include user context in the future
- **Audit-Friendly**: Full traceability of which device/app generated each change

### **Frontend: Clear Table Diff Display**

```typescript
// Special handling for clear table operations in the UI
function ClearTableDiffViewer({ clearOperation }: { clearOperation: ChangeEvent }) {
  const snapshot = clearOperation.operation_type.Clear?.snapshot
  
  if (!snapshot) {
    return (
      <Box p={4} bg="red.50" borderRadius="md">
        <Text fontSize="sm" color="red.700">
          ⚠️ Table cleared but no snapshot available
        </Text>
        <Text fontSize="xs" color="red.600" mt={1}>
          {clearOperation.metadata.affected_rows} rows were deleted
        </Text>
      </Box>
    )
  }
  
  return (
    <VStack align="stretch" spacing={4}>
      {/* Summary */}
      <Box p={4} bg="red.50" border="1px solid" borderColor="red.200" borderRadius="md">
        <HStack justify="space-between">
          <VStack align="start" spacing={1}>
            <Text fontSize="sm" fontWeight="bold" color="red.700">
              🗑️ Table Cleared
            </Text>
            <Text fontSize="xs" color="red.600">
              {snapshot.row_count} rows deleted from {snapshot.table_name}
            </Text>
          </VStack>
          <Badge colorScheme="red" variant="solid">
            DESTRUCTIVE
          </Badge>
        </HStack>
      </Box>
      
      {/* Schema Information */}
      <Box>
        <Text fontSize="sm" fontWeight="medium" mb={2}>
          📋 Table Schema ({snapshot.table_schema.length} columns)
        </Text>
        <Box bg="gray.50" borderRadius="md" p={3}>
          <HStack wrap="wrap" spacing={2}>
            {snapshot.table_schema.map((column, idx) => (
              <Badge key={idx} variant="outline" fontSize="xs">
                {column.name} ({column.data_type})
              </Badge>
            ))}
          </HStack>
        </Box>
      </Box>
      
      {/* Sample Data Preview */}
      {snapshot.sample_rows.length > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="medium" mb={2}>
            📊 Deleted Data Preview (first {snapshot.sample_rows.length} rows)
          </Text>
          <Box bg="red.25" border="1px solid" borderColor="red.200" borderRadius="md" overflow="hidden">
            <Table size="sm">
              <Thead bg="red.100">
                <Tr>
                  {snapshot.table_schema.slice(0, 4).map((column) => (
                    <Th key={column.name} fontSize="xs" color="red.700">
                      {column.name}
                    </Th>
                  ))}
                  {snapshot.table_schema.length > 4 && (
                    <Th fontSize="xs" color="red.700">...</Th>
                  )}
                </Tr>
              </Thead>
              <Tbody>
                {snapshot.sample_rows.map((row, idx) => (
                  <Tr key={idx}>
                    {snapshot.table_schema.slice(0, 4).map((column) => (
                      <Td key={column.name} fontSize="xs" color="red.600">
                        {row[column.name] ? String(row[column.name]) : 'null'}
                      </Td>
                    ))}
                    {snapshot.table_schema.length > 4 && (
                      <Td fontSize="xs" color="red.600">...</Td>
                    )}
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        </Box>
      )}
      
      {/* Recovery Information */}
      <Box p={3} bg="blue.50" border="1px solid" borderColor="blue.200" borderRadius="md">
        <Text fontSize="sm" color="blue.700" fontWeight="medium" mb={1}>
          💡 Recovery Options
        </Text>
        <VStack align="start" spacing={1}>
          <Text fontSize="xs" color="blue.600">
            • Use "Revert" to restore all {snapshot.row_count} deleted rows
          </Text>
          {snapshot.full_data_compressed ? (
            <Text fontSize="xs" color="blue.600">
              • Full table data is preserved and can be restored completely
            </Text>
          ) : (
            <Text fontSize="xs" color="blue.600">
              • Large table - only sample data shown, but full restore is still possible
            </Text>
          )}
        </VStack>
      </Box>
    </VStack>
  )
}
```

**Integration with Existing Diff Viewer**:

```typescript
// Updated FieldChangesDiffViewer to handle Clear operations
function FieldChangesDiffViewer({ change }: { change: ChangeEvent }) {
  // Handle Clear operations specially
  if (change.operation_type === 'Clear') {
    return <ClearTableDiffViewer clearOperation={change} />
  }
  
  // Handle bulk operations
  if (typeof change.operation_type === 'object') {
    return <BulkOperationDiffViewer change={change} />
  }
  
  // Standard field-by-field diff for Insert/Update/Delete
  const { changes } = change
  // ... existing implementation
}
```

## Implementation Timeline

### ⚠️ **CRITICAL ISSUES IDENTIFIED & SOLUTIONS**

#### **1. Memory Leaks & Unbounded Growth**
**Issue**: `VecDeque<ChangeEvent>` could grow indefinitely if user makes many changes
```rust
// PROBLEM: No actual cleanup mechanism implemented
if context_changes.len() > MAX_CHANGES_PER_CONTEXT {
    context_changes.pop_front(); // This is mentioned but never implemented
}
```

**Solution**: Implement proper LRU eviction
```rust
impl ChangeHistoryManager {
    pub async fn record_change(&self, change: ChangeEvent) -> Result<(), String> {
        let mut changes_map = self.changes.write().await;
        let context_changes = changes_map
            .entry(change.context_key.clone())
            .or_insert_with(VecDeque::new);
        
        // FIXED: Actually implement the limit
        if context_changes.len() >= MAX_CHANGES_PER_CONTEXT {
            // Remove oldest changes, keep newest
            while context_changes.len() >= MAX_CHANGES_PER_CONTEXT {
                context_changes.pop_front();
            }
        }
        
        context_changes.push_back(change);
        Ok(())
    }
}
```

#### **2. SQLite WAL Mode Conflicts**
**Issue**: Database may be in WAL mode with `wal-index` files causing revert failures
```rust
// PROBLEM: current_db_path.clone().unwrap() - panic risk!
database_path: current_db_path.clone().unwrap(),
```

**Solution**: Safe path handling + WAL mode detection
```rust
pub async fn db_clear_table(
    // ... parameters
) -> Result<DbResponse<u64>, String> {
    let db_path = current_db_path.ok_or("Database path is required")?;
    let pool = get_current_pool(&state, &db_cache, Some(db_path.clone())).await?;
    
    // Check if database is in WAL mode
    let wal_mode: String = sqlx::query_scalar("PRAGMA journal_mode")
        .fetch_one(&pool)
        .await
        .unwrap_or_else(|_| "delete".to_string());
    
    if wal_mode.to_lowercase() == "wal" {
        // Ensure WAL checkpoint before snapshot
        let _ = sqlx::query("PRAGMA wal_checkpoint(FULL)")
            .execute(&pool)
            .await;
    }
    
    // ... rest of implementation
}
```

#### **3. Revert Cascade Race Conditions**
**Issue**: Multiple users reverting same change simultaneously
```rust
// PROBLEM: No atomic check-and-revert
let target_change_index = all_changes
    .iter()
    .position(|c| c.id == change_id)
    .ok_or_else(|| format!("Change with ID {} not found", change_id))?;
```

**Solution**: Atomic revert with optimistic locking
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeEvent {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub revert_lock: Option<String>, // Add revert lock
    // ... other fields
}

pub async fn revert_database_change(
    change_id: String,
    context_key: String,
    force_revert: bool,
    // ... other params
) -> Result<DbResponse<RevertResult>, String> {
    // Step 1: Acquire revert lock
    let revert_session = Uuid::new_v4().to_string();
    
    let mut history_lock = history_manager.changes.write().await;
    let changes = history_lock.get_mut(&context_key)
        .ok_or("Context not found")?;
    
    let target_change = changes.iter_mut()
        .find(|c| c.id == change_id)
        .ok_or("Change not found")?;
    
    if target_change.revert_lock.is_some() && !force_revert {
        return Ok(DbResponse {
            success: false,
            data: Some(RevertResult::AlreadyReverting),
            error: Some("Change is being reverted by another operation".to_string()),
        });
    }
    
    target_change.revert_lock = Some(revert_session.clone());
    drop(history_lock); // Release lock during database operations
    
    // ... execute revert with proper cleanup
}
```

#### **4. Large Data Snapshot Memory Issues**
**Issue**: `create_table_snapshot` could consume excessive memory for large tables
```rust
// PROBLEM: Loading all data into memory
let full_rows = sqlx::query(&full_query).fetch_all(pool).await?;
```

**Solution**: Streaming + size limits
```rust
async fn create_table_snapshot(
    pool: &Pool<Sqlite>,
    table_name: &str,
) -> Result<ClearTableSnapshot, sqlx::Error> {
    // ... schema and count logic
    
    // FIXED: Add memory protection
    const MAX_SNAPSHOT_SIZE_MB: usize = 50; // 50MB limit
    const ESTIMATED_ROW_SIZE: usize = 1024; // 1KB per row estimate
    
    let estimated_size_mb = (row_count as usize * ESTIMATED_ROW_SIZE) / (1024 * 1024);
    
    let full_data_compressed = if row_count <= 1000 && estimated_size_mb <= MAX_SNAPSHOT_SIZE_MB {
        // Safe to snapshot
        let full_query = format!("SELECT * FROM {} LIMIT 1000", table_name);
        // ... implementation
        Some(compressed)
    } else {
        log::warn!("Table {} too large for full snapshot: {} rows (~{}MB)", 
                  table_name, row_count, estimated_size_mb);
        None
    };
    
    Ok(ClearTableSnapshot {
        // ... fields
        full_data_compressed,
    })
}
```

#### **5. Context Key Collision Risk**
**Issue**: SHA256 truncated to 16 chars could cause collisions
```rust
// PROBLEM: Only using first 16 chars
format!("{:x}", result)[..16].to_string()
```

**Solution**: Use full hash with collision detection
```rust
pub fn generate_context_key(device_id: &str, package_name: &str, database_filename: &str) -> String {
    use sha2::{Sha256, Digest};
    
    let context_string = format!("{}:{}:{}", device_id, package_name, database_filename);
    let mut hasher = Sha256::new();
    hasher.update(context_string.as_bytes());
    let result = hasher.finalize();
    
    // Use base64 encoding of full hash instead of truncated hex
    use base64::{Engine as _, engine::general_purpose};
    general_purpose::STANDARD_NO_PAD.encode(&result[..])
}

impl ChangeHistoryManager {
    pub async fn record_change(&self, mut change: ChangeEvent) -> Result<(), String> {
        // Collision detection
        let mut changes_map = self.changes.write().await;
        
        if let Some(existing_changes) = changes_map.get(&change.context_key) {
            if let Some(first_change) = existing_changes.front() {
                // Verify context matches
                if first_change.user_context.device_id != change.user_context.device_id ||
                   first_change.user_context.app_package != change.user_context.app_package ||
                   first_change.database_filename != change.database_filename {
                    
                    return Err(format!("Context key collision detected: {}", change.context_key));
                }
            }
        }
        
        // ... rest of implementation
    }
}
```

#### **6. Database Connection Pool Exhaustion**
**Issue**: Revert operations don't properly handle connection limits
```rust
// PROBLEM: No connection pool size validation
let pool = get_current_pool(&state, &db_cache, Some(target_change.database_path.clone())).await?;
```

**Solution**: Connection pool management
```rust
async fn execute_revert_with_retries(
    state: &State<'_, DbPool>,
    db_cache: &State<'_, DbConnectionCache>, 
    db_path: &str,
    revert_operations: Vec<RevertOperation>
) -> Result<(), String> {
    const MAX_RETRIES: u32 = 3;
    const RETRY_DELAY_MS: u64 = 1000;
    
    for attempt in 1..=MAX_RETRIES {
        match get_current_pool(state, db_cache, Some(db_path.to_string())).await {
            Ok(pool) => {
                // Check available connections
                if pool.size() >= pool.max_connections() - 1 {
                    log::warn!("Connection pool near capacity, waiting...");
                    tokio::time::sleep(Duration::from_millis(RETRY_DELAY_MS)).await;
                    continue;
                }
                
                return execute_revert_operations(&pool, revert_operations).await;
            }
            Err(e) if attempt < MAX_RETRIES => {
                log::warn!("Pool acquisition failed (attempt {}): {}", attempt, e);
                tokio::time::sleep(Duration::from_millis(RETRY_DELAY_MS * attempt as u64)).await;
            }
            Err(e) => return Err(format!("Failed to acquire connection pool: {}", e))
        }
    }
    
    Err("Max retries exceeded".to_string())
}
```

#### **7. Transaction Deadlock Prevention**
**Issue**: Long transactions during revert can cause deadlocks
```rust
// PROBLEM: No transaction timeout
let mut transaction = pool.begin().await?;
```

**Solution**: Transaction timeout + chunked operations
```rust
pub async fn revert_database_change(
    // ... parameters
) -> Result<DbResponse<RevertResult>, String> {
    const TRANSACTION_TIMEOUT_SECONDS: u64 = 30;
    
    let pool = get_current_pool(&state, &db_cache, Some(target_change.database_path.clone())).await?;
    
    // Set transaction timeout
    let timeout_duration = Duration::from_secs(TRANSACTION_TIMEOUT_SECONDS);
    
    let revert_result = tokio::time::timeout(timeout_duration, async {
        let mut transaction = pool.begin().await?;
        
        // Set SQLite busy timeout
        sqlx::query("PRAGMA busy_timeout = 10000") // 10 seconds
            .execute(&mut *transaction)
            .await?;
        
        // Execute revert operations
        match conflict_analysis.recommended_strategy {
            RevertStrategy::CascadeAll => {
                // Process in batches to avoid long-running transactions
                for chunk in subsequent_changes.chunks(10) {
                    for change in chunk {
                        if affects_same_data(target_change, change) {
                            execute_single_revert(&mut transaction, change).await?;
                            reverted_changes.push(change.id.clone());
                        }
                    }
                    // Intermediate commit to prevent deadlocks
                    if reverted_changes.len() % 10 == 0 {
                        transaction.commit().await?;
                        transaction = pool.begin().await?;
                    }
                }
            },
            // ... other strategies
        }
        
        transaction.commit().await?;
        Ok::<Vec<String>, String>(reverted_changes)
    }).await;
    
    match revert_result {
        Ok(Ok(reverted_changes)) => Ok(DbResponse {
            success: true,
            data: Some(RevertResult::Success {
                reverted_change_ids: reverted_changes,
                strategy_used: conflict_analysis.recommended_strategy,
            }),
            error: None,
        }),
        Ok(Err(e)) => Ok(DbResponse {
            success: false,
            data: None,
            error: Some(e),
        }),
        Err(_) => Ok(DbResponse {
            success: false,
            data: None,
            error: Some("Transaction timeout - operation too complex".to_string()),
        })
    }
}
```

```

#### **8. Frontend Performance Issues**
**Issue**: Large change histories causing React component re-render lag
```typescript
// PROBLEM: No virtualization for large lists
{changes.map((change, idx) => (
  <ChangeEventItem key={idx} change={change} isLast={idx === changes.length - 1} />
))}
```

**Solution**: Virtual scrolling + pagination
```typescript
import { FixedSizeList as List } from 'react-window'

function ChangeHistoryViewer({ contextKey }: { contextKey: string }) {
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50
  
  const { data: allChanges, isLoading } = useChangeHistory(contextKey)
  const paginatedChanges = useMemo(() => {
    if (!allChanges) return []
    return allChanges.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  }, [allChanges, page])
  
  const ChangeRow = ({ index, style }: { index: number, style: React.CSSProperties }) => (
    <div style={style}>
      <ChangeEventItem 
        change={paginatedChanges[index]} 
        isLast={index === paginatedChanges.length - 1} 
      />
    </div>
  )
  
  if (isLoading) return <Spinner />
  
  return (
    <VStack spacing={4}>
      <List
        height={400}
        itemCount={paginatedChanges.length}
        itemSize={120}
        width="100%"
      >
        {ChangeRow}
      </List>
      
      {allChanges && allChanges.length > PAGE_SIZE && (
        <HStack>
          <Button 
            size="sm" 
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
          >
            Previous
          </Button>
          <Text fontSize="sm">
            Page {page + 1} of {Math.ceil(allChanges.length / PAGE_SIZE)}
          </Text>
          <Button 
            size="sm" 
            disabled={(page + 1) * PAGE_SIZE >= allChanges.length}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </HStack>
      )}
    </VStack>
  )
}
```

#### **9. Data Type Handling Edge Cases**
**Issue**: SQLite BLOB and NULL handling in field diffs
```rust
// PROBLEM: All values converted to String, losing type information
let value: Option<String> = row.try_get(&column.name).ok();
row_data.insert(
    column.name.clone(),
    value.map(serde_json::Value::String).unwrap_or(serde_json::Value::Null)
);
```

**Solution**: Type-aware value extraction
```rust
async fn extract_typed_value(
    row: &SqliteRow, 
    column_name: &str, 
    column_type: &str
) -> Result<serde_json::Value, sqlx::Error> {
    match column_type.to_uppercase().as_str() {
        "INTEGER" | "INT" => {
            match row.try_get::<Option<i64>, _>(column_name)? {
                Some(val) => Ok(serde_json::Value::Number(val.into())),
                None => Ok(serde_json::Value::Null),
            }
        },
        "REAL" | "FLOAT" | "DOUBLE" => {
            match row.try_get::<Option<f64>, _>(column_name)? {
                Some(val) => Ok(serde_json::Number::from_f64(val)
                    .map(serde_json::Value::Number)
                    .unwrap_or(serde_json::Value::String(val.to_string()))),
                None => Ok(serde_json::Value::Null),
            }
        },
        "BLOB" => {
            match row.try_get::<Option<Vec<u8>>, _>(column_name)? {
                Some(blob) => {
                    // Encode as base64 for JSON serialization
                    use base64::{Engine as _, engine::general_purpose};
                    Ok(serde_json::Value::String(format!(
                        "BLOB({})",
                        general_purpose::STANDARD.encode(&blob)
                    )))
                },
                None => Ok(serde_json::Value::Null),
            }
        },
        _ => {
            // Default to string
            match row.try_get::<Option<String>, _>(column_name)? {
                Some(val) => Ok(serde_json::Value::String(val)),
                None => Ok(serde_json::Value::Null),
            }
        }
    }
}
```

#### **10. Cross-Platform File Path Issues**
**Issue**: Database paths may differ between platforms
```rust
// PROBLEM: Hardcoded path separators
database_path: current_db_path.clone().unwrap(),
```

**Solution**: Path normalization
```rust
use std::path::{Path, PathBuf};

fn normalize_database_path(path: &str) -> String {
    PathBuf::from(path)
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(path))
        .to_string_lossy()
        .to_string()
}

pub fn generate_context_key(device_id: &str, package_name: &str, database_filename: &str) -> String {
    // Normalize filename to handle path variations
    let normalized_filename = Path::new(database_filename)
        .file_name()
        .and_then(|f| f.to_str())
        .unwrap_or(database_filename);
    
    let context_string = format!("{}:{}:{}", device_id, package_name, normalized_filename);
    // ... rest of implementation
}
```

#### **11. Revert Conflict UI/UX Issues**  
**Issue**: Complex conflict resolution interface overwhelming users
```typescript
// PROBLEM: Too technical for average users
if (result.data?.ConflictsDetected) {
  const shouldForceRevert = window.confirm(
    `Conflicts detected with ${result.data.affected_changes.length} other changes. Force revert anyway?`
  )
}
```

**Solution**: User-friendly conflict resolution wizard
```typescript
function ConflictResolutionModal({ 
  conflicts, 
  affectedChanges, 
  onResolve, 
  onCancel 
}: ConflictResolutionModalProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<RevertStrategy>('CascadeAll')
  const [showDetails, setShowDetails] = useState(false)
  
  return (
    <Modal isOpen onClose={onCancel} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>⚠️ Revert Conflicts Detected</ModalHeader>
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Alert status="warning" borderRadius="md">
              <AlertIcon />
              <VStack align="start" spacing={1}>
                <Text fontWeight="medium">
                  This change conflicts with {affectedChanges.length} newer changes
                </Text>
                <Text fontSize="sm" color="gray.600">
                  Choose how to handle the conflicts:
                </Text>
              </VStack>
            </Alert>
            
            <RadioGroup value={selectedStrategy} onChange={setSelectedStrategy}>
              <VStack align="stretch" spacing={3}>
                <Radio value="CascadeAll">
                  <VStack align="start" spacing={1}>
                    <Text fontWeight="medium">Revert all conflicting changes (Recommended)</Text>
                    <Text fontSize="sm" color="gray.600">
                      This will also revert the {affectedChanges.length} newer changes that conflict
                    </Text>
                  </VStack>
                </Radio>
                
                <Radio value="FieldLevel">
                  <VStack align="start" spacing={1}>
                    <Text fontWeight="medium">Revert only non-conflicting parts</Text>
                    <Text fontSize="sm" color="gray.600">
                      Keep conflicting changes, only revert fields that weren't modified later
                    </Text>
                  </VStack>
                </Radio>
                
                <Radio value="Cancel">
                  <VStack align="start" spacing={1}>
                    <Text fontWeight="medium">Cancel revert</Text>
                    <Text fontSize="sm" color="gray.600">
                      Don't revert anything - keep current state
                    </Text>
                  </VStack>
                </Radio>
              </VStack>
            </RadioGroup>
            
            <Button
              variant="ghost" 
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? 'Hide' : 'Show'} Technical Details
            </Button>
            
            {showDetails && (
              <Box bg="gray.50" p={3} borderRadius="md" fontSize="sm">
                <Text fontWeight="medium" mb={2}>Affected Fields:</Text>
                {conflicts.map((conflict, idx) => (
                  <Text key={idx}>• {conflict.field_name}</Text>
                ))}
              </Box>
            )}
          </VStack>
        </ModalBody>
        
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            colorScheme="orange" 
            onClick={() => onResolve(selectedStrategy)}
            disabled={selectedStrategy === 'Cancel'}
          >
            Proceed with Revert
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
```

#### **12. Device Disconnection During Operations**
**Issue**: Device disconnects while database operations are in progress
```rust
// PROBLEM: No device connectivity check before operations
let pool = get_current_pool(&state, &db_cache, current_db_path.clone()).await?;
```

**Solution**: Device connectivity validation
```rust
async fn validate_device_connectivity(
    device_id: &str,
    device_type: &str
) -> Result<bool, String> {
    match device_type {
        "android" => {
            // Check ADB connection
            let output = tokio::process::Command::new("adb")
                .args(["-s", device_id, "get-state"])
                .output()
                .await
                .map_err(|e| format!("ADB check failed: {}", e))?;
            
            Ok(String::from_utf8_lossy(&output.stdout).trim() == "device")
        },
        "iphone-device" => {
            // Check iOS device connection
            let output = tokio::process::Command::new("idevice_id")
                .args(["-l"])
                .output()
                .await
                .map_err(|e| format!("iOS device check failed: {}", e))?;
            
            let device_list = String::from_utf8_lossy(&output.stdout);
            Ok(device_list.contains(device_id))
        },
        "simulator" => {
            // iOS simulator - check if running
            let output = tokio::process::Command::new("xcrun")
                .args(["simctl", "list", "devices", "booted"])
                .output()
                .await
                .map_err(|e| format!("Simulator check failed: {}", e))?;
            
            let device_list = String::from_utf8_lossy(&output.stdout);
            Ok(device_list.contains(device_id))
        },
        _ => Ok(true) // Unknown device type, assume connected
    }
}

pub async fn revert_database_change(
    change_id: String,
    context_key: String,
    force_revert: bool,
    // ... other parameters
) -> Result<DbResponse<RevertResult>, String> {
    // Validate device connectivity before proceeding
    let target_change = // ... get change
    
    if let Err(connectivity_error) = validate_device_connectivity(
        &target_change.user_context.device_id,
        &target_change.user_context.device_type
    ).await {
        return Ok(DbResponse {
            success: false,
            data: None,
            error: Some(format!("Device connectivity issue: {}", connectivity_error)),
        });
    }
    
    // ... rest of revert logic
}
```

### Phase 1: Core Infrastructure (Week 1-2)
1. Create Rust change history manager and data structures
2. Integrate with existing database commands
3. Add Tauri commands for change history operations

### Phase 2: Basic UI Components (Week 2-3)
1. Create change history hooks
2. Add change indicator to TableFooter
3. Implement basic change history modal using FLModal

### Phase 3: Advanced Features (Week 3-4)
1. Implement revert functionality with conflict detection
2. Add expandable diff viewer
3. Add export functionality
4. Optimize for bulk operations

### Phase 4: Polish & Testing (Week 4-5)
1. Add comprehensive error handling
2. Implement loading states and optimistic updates
3. Add unit and integration tests
4. Performance optimization for large change sets

## Testing Strategy

### Unit Tests
- Change history manager operations
- Field change computation logic
- Revert conflict detection
- Export/import functionality

### Integration Tests
- End-to-end change recording and retrieval
- Revert operations across different scenarios
- UI interaction testing with React Testing Library

### Performance Tests
- Large change set handling (100+ changes)
- Bulk operation change recording
- Memory usage with maximum changes per database

## Future Enhancements (Out of Scope)

1. **Persistence**: Option to persist change history to disk
2. **Cross-table Dependencies**: Handle foreign key relationships in reverts
3. **Branching**: Support for change branches and merging
4. **Collaborative Features**: Multi-user change tracking
5. **Advanced Filtering**: Filter changes by date, operation type, user
6. **Change Squashing**: Compress related changes for cleaner history

This implementation provides a solid foundation for database change tracking while maintaining the session-based, lightweight approach you requested. The system can easily be extended with persistence and more advanced features in the future.
