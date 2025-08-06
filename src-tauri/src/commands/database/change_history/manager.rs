// src-tauri/src/commands/database/change_history/manager.rs
// Memory-bounded change history manager with all safety checks
// Following IMPLEMENTATION_ROADMAP.md safety-first approach

use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, atomic::{AtomicUsize, Ordering}};
use chrono::{DateTime, Utc};
use tokio::sync::RwLock;

use crate::commands::database::change_history::types::{ChangeEvent, ContextSummary};

// SAFETY-FIRST: Memory-bounded change manager (Critical Issue #1 fix)
pub struct ChangeHistoryManager {
    changes: Arc<RwLock<HashMap<String, VecDeque<ChangeEvent>>>>,
    max_changes_per_context: usize,  // HARD LIMIT: 100
    max_total_contexts: usize,       // HARD LIMIT: 50  
    memory_usage_mb: Arc<AtomicUsize>, // Track memory usage
}

impl ChangeHistoryManager {
    pub fn new() -> Self {
        Self {
            changes: Arc::new(RwLock::new(HashMap::new())),
            max_changes_per_context: 100,
            max_total_contexts: 50,
            memory_usage_mb: Arc::new(AtomicUsize::new(0)),
        }
    }
    
    // For testing: create with custom limits
    #[cfg(test)]
    pub fn new_with_limits(max_changes_per_context: usize, max_total_contexts: usize) -> Self {
        Self {
            changes: Arc::new(RwLock::new(HashMap::new())),
            max_changes_per_context,
            max_total_contexts,
            memory_usage_mb: Arc::new(AtomicUsize::new(0)),
        }
    }
    
    // SAFE: Cannot cause unbounded memory growth (Critical Issue #1 fix)
    pub async fn record_change(&self, change: ChangeEvent) -> Result<(), String> {
        let mut changes_map = self.changes.write().await;
        
        // SAFETY CHECK 1: Total context limit
        if changes_map.len() >= self.max_total_contexts && !changes_map.contains_key(&change.context_key) {
            // Remove oldest context by last activity
            if let Some(oldest_context) = self.find_least_recently_used_context(&changes_map) {
                log::info!("Removing oldest context due to limit: {}", oldest_context);
                changes_map.remove(&oldest_context);
            }
        }
        
        let context_changes = changes_map
            .entry(change.context_key.clone())
            .or_insert_with(VecDeque::new);
        
        // SAFETY CHECK 2: Per-context limit with ACTUAL enforcement
        while context_changes.len() >= self.max_changes_per_context {
            let removed = context_changes.pop_front();
            if let Some(removed_change) = removed {
                log::debug!("Removed oldest change: {} from context: {}", 
                           removed_change.id, change.context_key);
            }
        }
        
        context_changes.push_back(change);
        
        // Update memory usage estimate (rough calculation)
        let estimated_size = std::mem::size_of::<ChangeEvent>() / (1024 * 1024); // Convert to MB
        self.memory_usage_mb.store(
            changes_map.len() * self.max_changes_per_context * estimated_size,
            Ordering::Relaxed
        );
        
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
    
    pub async fn get_last_change_time(&self, context_key: &str, table_name: &str) -> Option<DateTime<Utc>> {
        let changes_map = self.changes.read().await;
        changes_map
            .get(context_key)?
            .iter()
            .filter(|change| change.table_name == table_name)
            .map(|change| change.timestamp)
            .max()
    }
    
    // Clear all changes for a specific context
    pub async fn clear_changes(&self, context_key: &str) {
        let mut changes_map = self.changes.write().await;
        changes_map.remove(context_key);
    }
    
    // Get all active contexts (for debugging/admin purposes)
    pub async fn get_active_contexts(&self) -> Vec<String> {
        let changes_map = self.changes.read().await;
        changes_map.keys().cloned().collect()
    }
    
    pub async fn get_context_summary(&self, context_key: &str) -> Option<ContextSummary> {
        let changes_map = self.changes.read().await;
        let changes = changes_map.get(context_key)?;
        
        if changes.is_empty() {
            return None;
        }
        
        let first_change = changes.front()?;
        let last_change_time = changes.back().map(|c| c.timestamp);
        
        Some(ContextSummary {
            context_key: context_key.to_string(),
            device_name: first_change.user_context.device_name.clone(),
            app_name: first_change.user_context.app_name.clone(),
            database_filename: first_change.database_filename.clone(),
            total_changes: changes.len(),
            last_change_time,
        })
    }
    
    // Get all context summaries sorted by last activity
    pub async fn get_all_context_summaries(&self) -> Vec<ContextSummary> {
        let changes_map = self.changes.read().await;
        let mut summaries: Vec<ContextSummary> = changes_map
            .keys()
            .filter_map(|context_key| {
                let changes = changes_map.get(context_key)?;
                if changes.is_empty() {
                    return None;
                }
                
                let first_change = changes.front()?;
                let last_change_time = changes.back().map(|c| c.timestamp);
                
                Some(ContextSummary {
                    context_key: context_key.clone(),
                    device_name: first_change.user_context.device_name.clone(),
                    app_name: first_change.user_context.app_name.clone(),
                    database_filename: first_change.database_filename.clone(),
                    total_changes: changes.len(),
                    last_change_time,
                })
            })
            .collect();
        
        // Sort by last change time (newest first)
        summaries.sort_by(|a, b| {
            b.last_change_time.unwrap_or_else(|| DateTime::from_timestamp(0, 0).unwrap())
                .cmp(&a.last_change_time.unwrap_or_else(|| DateTime::from_timestamp(0, 0).unwrap()))
        });
        
        summaries
    }
    
    // Memory usage diagnostic
    pub fn get_memory_usage_mb(&self) -> usize {
        self.memory_usage_mb.load(Ordering::Relaxed)
    }
    
    // Find LRU context for eviction
    fn find_least_recently_used_context(&self, changes_map: &HashMap<String, VecDeque<ChangeEvent>>) -> Option<String> {
        changes_map.iter()
            .min_by_key(|(_, changes)| {
                changes.back()
                    .map(|c| c.timestamp)
                    .unwrap_or_else(|| DateTime::from_timestamp(0, 0).unwrap())
            })
            .map(|(context, _)| context.clone())
    }
}

impl Default for ChangeHistoryManager {
    fn default() -> Self {
        Self::new()
    }
}

// Thread-safe singleton access for Tauri state
impl Clone for ChangeHistoryManager {
    fn clone(&self) -> Self {
        Self {
            changes: Arc::clone(&self.changes),
            max_changes_per_context: self.max_changes_per_context,
            max_total_contexts: self.max_total_contexts,
            memory_usage_mb: Arc::clone(&self.memory_usage_mb),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::database::change_history::types::{OperationType, UserContext, ChangeMetadata};
    use uuid::Uuid;

    fn create_test_change(context_key: &str, table_name: &str, operation: OperationType) -> ChangeEvent {
        ChangeEvent {
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            context_key: context_key.to_string(),
            database_path: "/test/path.db".to_string(),
            database_filename: "test.db".to_string(),
            table_name: table_name.to_string(),
            operation_type: operation,
            user_context: UserContext {
                device_id: "test_device".to_string(),
                device_name: "Test Device".to_string(),
                device_type: "test".to_string(),
                app_package: "com.test.app".to_string(),
                app_name: "Test App".to_string(),
                session_id: Uuid::new_v4().to_string(),
            },
            changes: vec![],
            row_identifier: None,
            metadata: ChangeMetadata {
                affected_rows: 1,
                execution_time_ms: 10,
                sql_statement: None,
                original_remote_path: None,
                pull_timestamp: Utc::now(),
            },
        }
    }

    #[tokio::test]
    async fn test_memory_bounds_enforcement() {
        let manager = ChangeHistoryManager::new_with_limits(5, 3);
        let context_key = "test_context";
        
        // Test per-context limit
        for _i in 0..10 {
            let change = create_test_change(context_key, "table1", OperationType::Insert);
            manager.record_change(change).await.unwrap();
        }
        
        let changes = manager.get_changes(context_key).await;
        assert!(changes.len() <= 5, "Per-context limit not enforced: got {} changes", changes.len());
        
        // Test total context limit
        for i in 0..5 {
            let context = format!("context_{}", i);
            let change = create_test_change(&context, "table1", OperationType::Insert);
            manager.record_change(change).await.unwrap();
        }
        
        let contexts = manager.get_active_contexts().await;
        assert!(contexts.len() <= 3, "Total context limit not enforced: got {} contexts", contexts.len());
    }

    #[tokio::test]
    async fn test_changes_retrieval() {
        let manager = ChangeHistoryManager::new();
        let context_key = "test_context";
        
        // Add changes to different tables
        let change1 = create_test_change(context_key, "users", OperationType::Insert);
        let change2 = create_test_change(context_key, "posts", OperationType::Update);
        let change3 = create_test_change(context_key, "users", OperationType::Delete);
        
        manager.record_change(change1).await.unwrap();
        manager.record_change(change2).await.unwrap();
        manager.record_change(change3).await.unwrap();
        
        // Test get all changes
        let all_changes = manager.get_changes(context_key).await;
        assert_eq!(all_changes.len(), 3);
        
        // Test get changes for specific table
        let users_changes = manager.get_changes_for_table(context_key, "users").await;
        assert_eq!(users_changes.len(), 2);
        
        let posts_changes = manager.get_changes_for_table(context_key, "posts").await;
        assert_eq!(posts_changes.len(), 1);
    }

    #[tokio::test]
    async fn test_context_summary() {
        let manager = ChangeHistoryManager::new();
        let context_key = "test_context";
        
        let change = create_test_change(context_key, "users", OperationType::Insert);
        manager.record_change(change).await.unwrap();
        
        let summary = manager.get_context_summary(context_key).await;
        assert!(summary.is_some());
        
        let summary = summary.unwrap();
        assert_eq!(summary.context_key, context_key);
        assert_eq!(summary.total_changes, 1);
        assert!(summary.last_change_time.is_some());
    }
}
