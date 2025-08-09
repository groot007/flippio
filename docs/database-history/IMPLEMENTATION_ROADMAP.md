# Database Change History - Implementation Roadmap

## 🚀 **Implementation Strategy: Safety-First Approach**

### **Phase 1: Safe Foundation (Week 1)**
Build core infrastructure with built-in safeguards to avoid critical issues.

#### **Day 1-2: Core Data Structures**
```rust
// src-tauri/src/commands/database/change_history.rs
// Start with SAFE implementations that can't fail catastrophically

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeEvent {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub context_key: String,
    pub database_path: String,
    pub database_filename: String,
    pub table_name: String,
    pub operation_type: OperationType,
    pub user_context: UserContext,
    pub changes: Vec<FieldChange>,
    pub row_identifier: Option<String>,
    pub metadata: ChangeMetadata,
}

// SAFETY-FIRST: Memory-bounded change manager
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
    
    // SAFE: Cannot cause unbounded memory growth
    pub async fn record_change(&self, change: ChangeEvent) -> Result<(), String> {
        let mut changes_map = self.changes.write().await;
        
        // SAFETY CHECK 1: Total context limit
        if changes_map.len() >= self.max_total_contexts && !changes_map.contains_key(&change.context_key) {
            // Remove oldest context by last activity
            if let Some(oldest_context) = self.find_least_recently_used_context(&changes_map) {
                changes_map.remove(&oldest_context);
            }
        }
        
        let context_changes = changes_map
            .entry(change.context_key.clone())
            .or_insert_with(VecDeque::new);
        
        // SAFETY CHECK 2: Per-context limit with ACTUAL enforcement
        while context_changes.len() >= self.max_changes_per_context {
            context_changes.pop_front(); // Remove oldest
        }
        
        context_changes.push_back(change);
        
        Ok(())
    }
    
    fn find_least_recently_used_context(&self, changes_map: &HashMap<String, VecDeque<ChangeEvent>>) -> Option<String> {
        changes_map.iter()
            .min_by_key(|(_, changes)| {
                changes.back().map(|c| c.timestamp).unwrap_or_else(|| DateTime::from_timestamp(0, 0).unwrap())
            })
            .map(|(context, _)| context.clone())
    }
}
```

#### **Day 3-4: Safe Context Key Generation**
```rust
// SAFE: Full collision detection with graceful fallbacks
pub fn generate_context_key(device_id: &str, package_name: &str, database_filename: &str) -> String {
    use sha2::{Sha256, Digest};
    use base64::{Engine as _, engine::general_purpose};
    
    // Normalize inputs to prevent path variations
    let normalized_filename = std::path::Path::new(database_filename)
        .file_name()
        .and_then(|f| f.to_str())
        .unwrap_or(database_filename);
    
    let context_string = format!("{}:{}:{}", device_id, package_name, normalized_filename);
    let mut hasher = Sha256::new();
    hasher.update(context_string.as_bytes());
    let result = hasher.finalize();
    
    // Use full hash - no truncation to avoid collisions
    general_purpose::STANDARD_NO_PAD.encode(&result)
}

// SAFE: Validate context uniqueness
pub async fn validate_context_key(
    history_manager: &ChangeHistoryManager,
    context_key: &str,
    expected_device_id: &str,
    expected_package: &str,
    expected_filename: &str
) -> Result<(), String> {
    let changes_map = history_manager.changes.read().await;
    
    if let Some(existing_changes) = changes_map.get(context_key) {
        if let Some(first_change) = existing_changes.front() {
            // Collision detection
            if first_change.user_context.device_id != expected_device_id ||
               first_change.user_context.app_package != expected_package ||
               first_change.database_filename != expected_filename {
                
                return Err(format!(
                    "Context collision detected: {} already exists for different context", 
                    context_key
                ));
            }
        }
    }
    
    Ok(())
}
```

#### **Day 5-7: Basic Change Recording (No Revert Yet)**
```rust
// Start with SIMPLE operations first - just recording changes
// NO REVERT functionality yet to avoid complexity

#[tauri::command]
pub async fn record_database_change_safe(
    state: State<'_, DbPool>,
    db_cache: State<'_, DbConnectionCache>,
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
    // SAFETY: All parameters required, no unwrap() calls
    let context_key = generate_context_key(&device_id, &app_package, &database_filename);
    
    // SAFETY: Validate context before proceeding
    validate_context_key(&history_manager, &context_key, &device_id, &app_package, &database_filename).await?;
    
    let change_event = ChangeEvent {
        id: Uuid::new_v4().to_string(),
        timestamp: Utc::now(),
        context_key: context_key.clone(),
        database_path: current_db_path,
        database_filename,
        table_name,
        operation_type: match operation_type.as_str() {
            "insert" => OperationType::Insert,
            "update" => OperationType::Update,
            "delete" => OperationType::Delete,
            _ => return Err(format!("Invalid operation type: {}", operation_type)),
        },
        user_context: UserContext {
            device_id,
            device_name,
            device_type,
            app_package,
            app_name,
            session_id: get_session_id(),
        },
        changes: vec![], // Will be populated by field diff logic
        row_identifier: None, // Will be populated by row identification logic  
        metadata: ChangeMetadata {
            affected_rows: 1,
            execution_time_ms: 0,
            sql_statement: None,
            original_remote_path: None,
            pull_timestamp: Utc::now(),
        },
    };
    
    // SAFETY: Cannot fail due to memory bounds
    history_manager.record_change(change_event).await?;
    
    Ok(DbResponse {
        success: true,
        data: Some(context_key),
        error: None,
    })
}
```

### **Phase 2: Integration Testing (Week 2)**
Integrate with existing database commands to ensure no regressions.

#### **Day 1-3: Hook into Existing Commands**
```rust
// Modify existing database commands to record changes
// Start with ONE command first: db_update_table_row

#[tauri::command]
pub async fn db_update_table_row_with_history(
    state: State<'_, DbPool>,
    db_cache: State<'_, DbConnectionCache>,
    history_manager: State<'_, ChangeHistoryManager>,
    table_name: String,
    row: HashMap<String, String>,
    condition: String,
    current_db_path: Option<String>,
    // ADD context parameters - get from frontend state
    device_id: String,
    app_package: String,
    database_filename: String,
) -> Result<DbResponse<u64>, String> {
    // STEP 1: Execute original update (existing logic)
    let original_result = db_update_table_row(
        state.clone(),
        db_cache.clone(),
        table_name.clone(),
        row.clone(),
        condition.clone(),
        current_db_path.clone(),
    ).await?;
    
    // STEP 2: Record change ONLY if original succeeded
    if original_result.success && original_result.data.unwrap_or(0) > 0 {
        let _ = record_database_change_safe(
            state,
            db_cache,
            history_manager,
            table_name,
            "update".to_string(),
            device_id,
            "Current Device".to_string(), // TODO: Get from app state
            "unknown".to_string(),        // TODO: Get from app state  
            app_package,
            "Current App".to_string(),    // TODO: Get from app state
            database_filename,
            current_db_path.unwrap_or_default(),
        ).await;
        // NOTE: Ignore change recording errors to avoid breaking existing functionality
    }
    
    Ok(original_result)
}
```

#### **Day 4-7: Frontend Integration**
```typescript
// src/renderer/src/hooks/useChangeHistory.ts
// Start with SIMPLE read-only functionality

export function useChangeHistory(contextKey?: string) {
  return useQuery({
    queryKey: ['changeHistory', contextKey],
    queryFn: async () => {
      if (!contextKey) return []
      
      try {
        const response = await api.getDatabaseChangeHistory(contextKey)
        return response.success ? response.data || [] : []
      } catch (error) {
        console.warn('Failed to fetch change history:', error)
        return [] // SAFE: Always return array, never crash
      }
    },
    enabled: !!contextKey,
    refetchInterval: 30000, // Refresh every 30 seconds
  })
}

// Simple read-only modal first
export function ChangeHistoryModal({ 
  isOpen, 
  onClose, 
  contextKey 
}: ChangeHistoryModalProps) {
  const { data: changes = [], isLoading } = useChangeHistory(contextKey)
  
  return (
    <FLModal
      isOpen={isOpen}
      onClose={onClose}
      modalTitle="📋 Database Change History"
      modalSize="xl"
    >
      <VStack spacing={4} align="stretch">
        {isLoading ? (
          <Spinner />
        ) : changes.length === 0 ? (
          <Text textAlign="center" color="gray.500">
            No changes recorded yet
          </Text>
        ) : (
          <VStack spacing={2} align="stretch" maxH="400px" overflowY="auto">
            {changes.slice(0, 20).map((change, idx) => ( // SAFETY: Limit to 20 items
              <Box key={change.id} p={3} border="1px solid" borderColor="gray.200" borderRadius="md">
                <HStack justify="space-between">
                  <Badge colorScheme={change.operation_type === 'Insert' ? 'green' : 
                                     change.operation_type === 'Update' ? 'blue' : 'red'}>
                    {change.operation_type}
                  </Badge>
                  <Text fontSize="sm" color="gray.600">
                    {new Date(change.timestamp).toLocaleString()}
                  </Text>
                </HStack>
                <Text fontSize="sm" mt={1}>
                  Table: {change.table_name}
                </Text>
                {/* NO REVERT BUTTON YET - just display */}
              </Box>
            ))}
          </VStack>
        )}
      </VStack>
    </FLModal>
  )
}
```

### **Phase 3: Validation & Testing (Week 3)**
Thorough testing before adding complex features.

#### **Integration Tests**
```rust
// src-tauri/src/commands/database/change_history/tests.rs

#[tokio::test]
async fn test_memory_bounds_enforcement() {
    let manager = ChangeHistoryManager::new();
    
    // Test 1: Per-context limit
    let context_key = "test_context".to_string();
    
    // Add more than the limit
    for i in 0..150 {
        let change = create_test_change_event(&context_key, i);
        manager.record_change(change).await.unwrap();
    }
    
    let changes = manager.get_changes(&context_key).await;
    assert!(changes.len() <= 100, "Per-context limit not enforced");
    
    // Test 2: Total context limit  
    for i in 0..60 {
        let context = format!("context_{}", i);
        let change = create_test_change_event(&context, 1);
        manager.record_change(change).await.unwrap();
    }
    
    let contexts = manager.get_active_contexts().await;
    assert!(contexts.len() <= 50, "Total context limit not enforced");
}

#[tokio::test]
async fn test_context_collision_detection() {
    let manager = ChangeHistoryManager::new();
    
    let context_key = generate_context_key("device1", "app1", "db1.sqlite");
    
    // First change
    let change1 = create_test_change_event_with_context(&context_key, "device1", "app1", "db1.sqlite");
    manager.record_change(change1).await.unwrap();
    
    // Should detect collision
    let result = validate_context_key(&manager, &context_key, "device2", "app1", "db1.sqlite").await;
    assert!(result.is_err(), "Context collision not detected");
}
```

### **Phase 4: Revert Functionality (Week 4)**
Only after everything else is stable and tested.

```rust
// Add revert functionality with all the safety measures we identified
// - Transaction timeouts
// - Revert locks  
// - Conflict detection
// - Proper error handling
```

## 🎯 **Success Validation Strategy**

### **After Each Phase**
1. **Memory Tests**: Run with large datasets, monitor memory usage
2. **Concurrent Tests**: Multiple users editing same database
3. **Error Injection**: Network failures, device disconnections
4. **Performance Tests**: Large change histories, many contexts

### **Validation Checkpoints**
- ✅ **Phase 1**: No memory leaks, no crashes, basic recording works
- ✅ **Phase 2**: Existing functionality unchanged, changes recorded correctly  
- ✅ **Phase 3**: All tests pass, performance acceptable
- ✅ **Phase 4**: Complex reverts work safely

## 🔧 **How to Stay On Track**

### **Daily Validation**
```bash
# Run these commands daily during development
cd src-tauri
cargo test change_history  # Unit tests
cargo test --test integration_change_history  # Integration tests

# Memory leak detection
cargo run --bin memory_test_change_history

# Frontend tests  
cd ../src/renderer
npm run test -- --testPathPattern=useChangeHistory
```

### **Weekly Milestones**
- **Week 1**: Core data structures + memory safety ✅
- **Week 2**: Integration with one command ✅  
- **Week 3**: Full testing suite ✅
- **Week 4**: Revert functionality ✅

### **Red Flags to Watch For**
🚨 **Stop and Fix If You See:**
- Memory usage growing during tests
- Any `unwrap()` panics in logs
- Frontend freezing with large change lists
- Database locks lasting > 30 seconds

## 🚀 **Ready to Start?**

**Recommended first step:** Create the `ChangeHistoryManager` with memory bounds and start with basic change recording. No revert, no complex features - just safe, bounded change tracking.

Would you like me to help you implement Phase 1, or do you have questions about this approach?
