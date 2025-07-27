# Flippio Comprehensive Testing Plan

## Overview

This document outlines a comprehensive testing strategy for Flippio's database operations to ensure all critical bugs discovered and fixed are permanently resolved. The testing plan covers both automated tests and manual validation procedures.

## Critical Issues Addressed Today

### 🔥 Major Bugs Fixed
1. **Database Isolation Failure** - Operations used wrong cached database connections
2. **Connection Pool Conflicts** - "attempted to acquire a connection on a closed pool" errors
3. **SQLite WAL Locking** - "readonly database" errors after switching databases
4. **Permission Issues** - Database files from devices had incorrect permissions
5. **Cross-Database Pollution** - Cache contamination between different databases

### 🎯 Key Improvements Implemented
- ✅ Strict database path validation for all write operations
- ✅ Enhanced connection pool health checks and validation
- ✅ Automatic WAL file cleanup and permission fixing
- ✅ Database switch cleanup to prevent stale connections
- ✅ Comprehensive error handling with 3-tier retry logic

---

## Test Database Setup

### Test Databases Created

We have three test databases with different complexity levels:

#### 1. **test_ecommerce.db** (Complex Schema)
- **Tables**: `users`, `products`, `orders`, `payments`
- **Features**: Foreign keys, complex relationships, financial data
- **Use Case**: Tests complex data operations and integrity constraints

#### 2. **test_social.db** (Medium Complexity)
- **Tables**: `profiles`, `posts`, `comments`, `likes`
- **Features**: Many-to-many relationships, social interactions
- **Use Case**: Tests relationship handling and bulk operations

#### 3. **test_notes.db** (Simple Schema)
- **Tables**: `folders`, `notes`, `tags`, `note_tags`
- **Features**: Simple relationships, text data
- **Use Case**: Tests basic CRUD operations and simple workflows

### Generate Test Databases

```bash
# Create test databases
npm install sqlite3  # If not already installed
node scripts/generate-test-databases.js

# Verify creation
ls -la src-tauri/tests/fixtures/databases/
```

---

## Testing Strategy

### 1. **Automated Integration Tests**

#### Database Operations Test Suite
Location: `src-tauri/tests/integration/database_operations_test.rs`

**Test Coverage:**
- ✅ Database connection management
- ✅ Table data retrieval with correct database targeting
- ✅ Insert operations with database path validation
- ✅ Update operations with proper isolation
- ✅ Delete operations with safety checks
- ✅ Database switching without connection conflicts
- ✅ Permission handling for read-only files
- ✅ WAL file cleanup and recovery

#### Connection Pool Test Suite
Location: `src-tauri/tests/integration/connection_pool_test.rs`

**Test Coverage:**
- ✅ Pool health validation
- ✅ Stale connection detection and cleanup
- ✅ Cache invalidation on database switch
- ✅ Concurrent access handling
- ✅ Memory leak prevention

#### Error Recovery Test Suite
Location: `src-tauri/tests/integration/error_recovery_test.rs`

**Test Coverage:**
- ✅ Readonly database error recovery
- ✅ WAL file locking resolution
- ✅ Permission fixing retry logic
- ✅ Connection pool revival after failures

### 2. **Frontend Integration Tests**

#### Database UI Workflow Tests
Location: `src/renderer/src/__tests__/database-workflow.test.tsx`

**Test Coverage:**
- ✅ Device selection flow
- ✅ Package selection and database file retrieval
- ✅ Database file selection and table loading
- ✅ Table data display and operations
- ✅ Database switching without errors

---

## Manual Testing Procedures

### 🧪 **Critical User Flow Testing**

#### **Test Flow 1: Database Isolation Verification**

**Objective**: Ensure operations target the correct database

**Steps:**
1. **Setup**:
   - Load `test_ecommerce.db` 
   - Select `users` table
   - Note: Should show 3 users (john_doe, jane_smith, bob_wilson)

2. **Edit Data**:
   - Add new user: `test_user`, `test@example.com`
   - Verify insertion success
   - Confirm 4 users now visible

3. **Switch Database**:
   - Switch to `test_social.db`
   - Select `profiles` table  
   - Note: Should show 3 profiles (@tech_guru, @photo_lover, @foodie_mike)

4. **Return to Original**:
   - Switch back to `test_ecommerce.db`
   - Select `users` table
   - **CRITICAL**: Should still show 4 users including test_user

5. **Cross-Contamination Check**:
   - Verify `test_social.db` still has only 3 profiles
   - Verify no data leaked between databases

**Expected Result**: ✅ Each database maintains its own data without cross-contamination

#### **Test Flow 2: Connection Pool Stability**

**Objective**: Ensure stable connections after multiple database switches

**Steps:**
1. **Rapid Database Switching**:
   - Switch between all 3 databases 5 times quickly
   - Perform table selection for each switch
   - Monitor logs for connection errors

2. **Operations After Switching**:
   - Perform CRUD operations in each database
   - Verify all operations complete successfully
   - Check for "closed pool" errors

3. **Memory Stability**:
   - Check connection cache size doesn't grow indefinitely
   - Verify old connections are properly cleaned up

**Expected Result**: ✅ No connection pool errors, stable performance

#### **Test Flow 3: WAL File Recovery**

**Objective**: Test recovery from SQLite WAL file conflicts

**Steps:**
1. **Create WAL Files**:
   - Open `test_notes.db`
   - Add several notes to create WAL files
   - Verify `.db-wal` and `.db-shm` files exist

2. **Simulate Lock Conflict**:
   - Switch to another database
   - Return to `test_notes.db`
   - Attempt write operations

3. **Verify Recovery**:
   - Operations should succeed after automatic WAL cleanup
   - Check logs for WAL file removal messages
   - Confirm no "readonly database" errors

**Expected Result**: ✅ Automatic recovery from WAL conflicts

#### **Test Flow 4: Permission Handling**

**Objective**: Test handling of read-only database files

**Steps:**
1. **Create Read-Only Database**:
   ```bash
   # Make test database read-only
   chmod 444 src-tauri/tests/fixtures/databases/test_ecommerce.db
   ```

2. **Test Operations**:
   - Open read-only database
   - Attempt write operations
   - Verify automatic permission fixing

3. **Verify Recovery**:
   - Operations should succeed after permission fix
   - Check logs for permission fix messages

**Expected Result**: ✅ Automatic permission correction and successful operations

---

## Automated Test Implementation

### Integration Test Structure

```rust
// src-tauri/tests/integration/database_isolation_test.rs

#[tokio::test]
async fn test_database_isolation_between_operations() {
    // Setup: Create temporary databases
    let db1_path = create_temp_database("isolation_test_1.db").await;
    let db2_path = create_temp_database("isolation_test_2.db").await;
    
    // Test 1: Insert into database 1
    let result1 = insert_test_data(&db1_path, "test_table", test_data_1()).await;
    assert!(result1.success);
    
    // Test 2: Insert into database 2
    let result2 = insert_test_data(&db2_path, "test_table", test_data_2()).await;
    assert!(result2.success);
    
    // Test 3: Verify isolation - data should be separate
    let db1_data = get_table_data(&db1_path, "test_table").await;
    let db2_data = get_table_data(&db2_path, "test_table").await;
    
    assert_ne!(db1_data.rows, db2_data.rows);
    assert_eq!(db1_data.rows.len(), 1);
    assert_eq!(db2_data.rows.len(), 1);
}

#[tokio::test] 
async fn test_connection_pool_health_after_database_switch() {
    // Setup multiple databases
    let databases = setup_test_databases().await;
    
    // Rapidly switch between databases
    for _ in 0..10 {
        for db_path in &databases {
            let result = switch_database_and_operate(db_path).await;
            assert!(result.success, "Failed operation after switch to {}", db_path);
        }
    }
    
    // Verify no connection leaks
    let connection_stats = get_connection_stats().await;
    assert!(connection_stats.active_connections <= databases.len());
}

#[tokio::test]
async fn test_wal_file_recovery() {
    let db_path = create_database_with_wal_files().await;
    
    // Simulate WAL file conflict
    create_artificial_wal_lock(&db_path).await;
    
    // Attempt write operation
    let result = insert_test_data(&db_path, "test_table", test_data()).await;
    
    // Should succeed after automatic WAL cleanup
    assert!(result.success);
    
    // Verify WAL files were cleaned up
    assert!(!wal_files_exist(&db_path));
}
```

### Frontend Test Structure

```typescript
// src/renderer/src/__tests__/database-workflow.test.tsx

describe('Database Workflow Integration', () => {
  beforeEach(() => {
    // Setup mock databases and API
    setupMockDatabases();
  });

  test('complete user workflow without errors', async () => {
    render(<App />);
    
    // Step 1: Select device
    await selectDevice('test-device-1');
    
    // Step 2: Select package
    await selectPackage('com.example.ecommerce');
    
    // Step 3: Select database file
    await selectDatabaseFile('test_ecommerce.db');
    
    // Step 4: Select table
    await selectTable('users');
    
    // Step 5: Verify table data loads
    expect(screen.getByText('john_doe')).toBeInTheDocument();
    
    // Step 6: Add new row
    await addNewRow({ username: 'test_user', email: 'test@example.com' });
    
    // Step 7: Switch database
    await selectDatabaseFile('test_social.db');
    await selectTable('profiles');
    
    // Step 8: Verify different data
    expect(screen.getByText('@tech_guru')).toBeInTheDocument();
    expect(screen.queryByText('john_doe')).not.toBeInTheDocument();
    
    // Step 9: Return to original database
    await selectDatabaseFile('test_ecommerce.db');
    await selectTable('users');
    
    // Step 10: Verify data persistence
    expect(screen.getByText('john_doe')).toBeInTheDocument();
    expect(screen.getByText('test_user')).toBeInTheDocument();
  });

  test('database switching without connection errors', async () => {
    render(<App />);
    
    // Rapidly switch between databases
    for (let i = 0; i < 5; i++) {
      await selectDatabaseFile('test_ecommerce.db');
      await selectTable('users');
      
      await selectDatabaseFile('test_social.db'); 
      await selectTable('profiles');
      
      await selectDatabaseFile('test_notes.db');
      await selectTable('notes');
    }
    
    // Verify no error messages
    expect(screen.queryByText(/connection.*closed.*pool/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/readonly.*database/i)).not.toBeInTheDocument();
  });
});
```

---

## Continuous Integration Setup

### GitHub Actions Workflow

```yaml
# .github/workflows/database-tests.yml
name: Database Integration Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  database-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
    
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
        
      - name: Setup Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
        
      - name: Install dependencies
        run: |
          npm install
          npm install sqlite3
        
      - name: Generate test databases
        run: node scripts/generate-test-databases.js
      
      - name: Run backend tests
        run: cd src-tauri && cargo test
      
      - name: Run frontend tests
        run: npm test
      
      - name: Integration test report
        run: |
          echo "✅ Database isolation tests passed"
          echo "✅ Connection pool tests passed" 
          echo "✅ WAL file recovery tests passed"
          echo "✅ Permission handling tests passed"
```

---

## Performance Testing

### Load Testing Scenarios

#### **Scenario 1: Rapid Database Switching**
- Switch between 3 databases 100 times
- Measure connection creation/cleanup time
- Monitor memory usage trends

#### **Scenario 2: Concurrent Operations**
- Simulate 10 concurrent database operations
- Verify connection pool handles concurrency
- Check for deadlocks or resource conflicts

#### **Scenario 3: Large Dataset Operations**
- Test with databases containing 10,000+ rows
- Measure query performance and memory usage
- Verify pagination and data loading efficiency

### Performance Benchmarks

```rust
#[cfg(test)]
mod performance_tests {
    use std::time::Instant;
    
    #[tokio::test]
    async fn benchmark_database_switching() {
        let start = Instant::now();
        
        for _ in 0..100 {
            switch_database("test_ecommerce.db").await;
            switch_database("test_social.db").await;
            switch_database("test_notes.db").await;
        }
        
        let duration = start.elapsed();
        println!("100 database switches took: {:?}", duration);
        
        // Should complete in under 10 seconds
        assert!(duration.as_secs() < 10);
    }
    
    #[tokio::test]
    async fn benchmark_concurrent_operations() {
        let start = Instant::now();
        
        let tasks = (0..10).map(|i| {
            tokio::spawn(async move {
                perform_database_operations(&format!("test_db_{}.db", i)).await
            })
        });
        
        futures::future::join_all(tasks).await;
        
        let duration = start.elapsed();
        println!("10 concurrent operations took: {:?}", duration);
        
        // Should complete in under 30 seconds
        assert!(duration.as_secs() < 30);
    }
}
```

---

## Test Execution Schedule

### **Pre-Commit Testing**
- Run database isolation tests
- Verify connection pool health
- Quick smoke tests for all operations

### **Daily CI Testing**
- Full integration test suite
- Performance benchmarks
- Memory leak detection

### **Pre-Release Testing**
- Complete manual testing procedures
- Load testing scenarios
- Cross-platform compatibility checks

### **Post-Release Monitoring**
- Monitor error rates in production logs
- Track connection pool metrics
- User-reported database issues

---

## Debugging and Diagnostics

### **Log Analysis**

Key log patterns to monitor:

```bash
# Successful operations
grep "✅.*successful.*database" flippio.log

# Database switching
grep "🔄 Switching to database" flippio.log

# Connection pool health
grep "Pool health check" flippio.log

# WAL file cleanup
grep "🗑️ Removing SQLite.*file" flippio.log

# Permission fixes
grep "🔧 Ensuring write permissions" flippio.log

# Error patterns to watch for
grep -E "(closed pool|readonly database|permission denied)" flippio.log
```

### **Diagnostic Commands**

Add these diagnostic commands for troubleshooting:

```rust
#[tauri::command]
pub async fn db_get_diagnostic_info(
    db_cache: State<'_, DbConnectionCache>,
) -> Result<DbResponse<DiagnosticInfo>, String> {
    let cache_guard = db_cache.read().await;
    
    let diagnostic_info = DiagnosticInfo {
        active_connections: cache_guard.len(),
        connection_details: cache_guard.iter().map(|(path, conn)| {
            ConnectionInfo {
                path: path.clone(),
                is_closed: conn.is_pool_closed(),
                created_at: conn.created_at,
                last_used: conn.last_used,
            }
        }).collect(),
        system_info: SystemInfo::current(),
    };
    
    Ok(DbResponse {
        success: true,
        data: Some(diagnostic_info),
        error: None,
    })
}
```

---

## Success Metrics

### **Zero Tolerance Issues**
- ❌ No "attempted to acquire a connection on a closed pool" errors
- ❌ No "readonly database" errors after WAL cleanup
- ❌ No cross-database data contamination
- ❌ No memory leaks in connection pools

### **Performance Targets**
- ✅ Database switching completes in < 100ms
- ✅ Connection pool size stays bounded (< 10 active connections)
- ✅ Memory usage remains stable during extended testing
- ✅ 99.9% success rate for database operations

### **User Experience Goals**
- ✅ Seamless database switching without visible errors
- ✅ Consistent data integrity across all operations
- ✅ Reliable performance under normal usage patterns
- ✅ Clear error messages for any issues that do occur

---

## Conclusion

This comprehensive testing plan ensures that all critical database issues discovered today remain permanently fixed. By combining automated tests, manual validation procedures, and continuous monitoring, we can maintain high reliability and prevent regressions as new features are added.

The testing strategy covers the complete user workflow from device selection through database operations, with special attention to the isolation, connection management, and error recovery improvements implemented today.

**Execute this plan regularly to ensure Flippio's database operations remain robust and reliable! 🚀** 
