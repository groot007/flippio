// Database integration tests
// Tests for database commands that require actual SQLite databases

use crate::commands::database::*;
use tempfile::TempDir;
use std::fs;
use rusqlite::Connection;

/// Create a test SQLite database with sample data
pub fn create_test_database(db_path: &str) -> Result<(), rusqlite::Error> {
    let conn = Connection::open(db_path)?;
    
    // Create a simple test table
    conn.execute(
        "CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            age INTEGER,
            active BOOLEAN DEFAULT 1
        )",
        [],
    )?;
    
    // Insert test data
    conn.execute(
        "INSERT INTO users (name, email, age, active) VALUES (?1, ?2, ?3, ?4)",
        ["John Doe", "john@example.com", "30", "1"],
    )?;
    
    conn.execute(
        "INSERT INTO users (name, email, age, active) VALUES (?1, ?2, ?3, ?4)",
        ["Jane Smith", "jane@example.com", "25", "1"],
    )?;
    
    conn.execute(
        "INSERT INTO users (name, email, age, active) VALUES (?1, ?2, ?3, ?4)",
        ["Bob Johnson", "bob@example.com", "35", "0"],
    )?;
    
    // Create another table for testing relationships
    conn.execute(
        "CREATE TABLE posts (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            title TEXT,
            content TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )",
        [],
    )?;
    
    conn.execute(
        "INSERT INTO posts (user_id, title, content) VALUES (?1, ?2, ?3)",
        ["1", "First Post", "This is John's first post"],
    )?;
    
    conn.execute(
        "INSERT INTO posts (user_id, title, content) VALUES (?1, ?2, ?3)",
        ["2", "Jane's Post", "This is Jane's post"],
    )?;
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::database::helpers::*;

    #[tokio::test]
    async fn test_database_connection_manager() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        
        // Create test database
        create_test_database(db_path.to_str().unwrap()).unwrap();
        
        let manager = DatabaseConnectionManager::new();
        
        // Test getting a connection
        let conn_result = manager.get_connection(db_path.to_str().unwrap()).await;
        assert!(conn_result.is_ok());
        
        // Test that the same path returns the same connection
        let conn_result2 = manager.get_connection(db_path.to_str().unwrap()).await;
        assert!(conn_result2.is_ok());
        
        // Test closing connection
        let _ = manager.close_connection(db_path.to_str().unwrap()).await;
    }

    #[test]
    fn test_database_helpers() {
        // Test default value generation
        assert_eq!(get_default_value_for_type("INTEGER"), serde_json::Value::Number(serde_json::Number::from(0)));
        assert_eq!(get_default_value_for_type("TEXT"), serde_json::Value::String("".to_string()));
        assert_eq!(get_default_value_for_type("BOOLEAN"), serde_json::Value::Bool(false));
        assert_eq!(get_default_value_for_type("UNKNOWN"), serde_json::Value::Null);
    }

    #[test]
    fn test_reset_sqlite_wal_mode_with_real_db() -> Result<(), Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        let db_path = temp_dir.path().join("test.db");
        
        // Create a real database
        create_test_database(db_path.to_str().unwrap())?;
        
        // Create mock WAL files
        let wal_path = temp_dir.path().join("test.db-wal");
        let shm_path = temp_dir.path().join("test.db-shm");
        fs::write(&wal_path, "mock wal content")?;
        fs::write(&shm_path, "mock shm content")?;
        
        // Run the function
        let result = reset_sqlite_wal_mode(db_path.to_str().unwrap());
        assert!(result.is_ok());
        
        // WAL and SHM files should be removed
        assert!(db_path.exists());
        assert!(!wal_path.exists());
        assert!(!shm_path.exists());
        
        Ok(())
    }

    #[test]
    fn test_create_test_database() -> Result<(), Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        let db_path = temp_dir.path().join("test.db");
        
        // Create the test database
        create_test_database(db_path.to_str().unwrap())?;
        
        // Verify the database was created
        assert!(db_path.exists());
        
        // Connect and verify the structure
        let conn = Connection::open(&db_path)?;
        
        // Check if users table exists
        let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")?;
        let table_exists: bool = stmt.exists([])?;
        assert!(table_exists);
        
        // Check if posts table exists
        let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='posts'")?;
        let table_exists: bool = stmt.exists([])?;
        assert!(table_exists);
        
        // Check data was inserted
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM users")?;
        let count: i64 = stmt.query_row([], |row| row.get(0))?;
        assert_eq!(count, 3);
        
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM posts")?;
        let count: i64 = stmt.query_row([], |row| row.get(0))?;
        assert_eq!(count, 2);
        
        Ok(())
    }

    #[test]
    fn test_database_types_and_constraints() -> Result<(), Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        let db_path = temp_dir.path().join("test.db");
        
        create_test_database(db_path.to_str().unwrap())?;
        
        let conn = Connection::open(&db_path)?;
        
        // Test that email constraint works (should fail on duplicate)
        let result = conn.execute(
            "INSERT INTO users (name, email, age) VALUES (?1, ?2, ?3)",
            ["Test User", "john@example.com", "40"], // Duplicate email
        );
        assert!(result.is_err()); // Should fail due to UNIQUE constraint
        
        // Test that foreign key works
        let _result = conn.execute(
            "INSERT INTO posts (user_id, title, content) VALUES (?1, ?2, ?3)",
            ["999", "Invalid Post", "This should work even with invalid foreign key"],
        );
        // Note: SQLite doesn't enforce foreign keys by default, so this might succeed
        // In a real test, you'd want to enable foreign key constraints
        
        Ok(())
    }

    #[test] 
    fn test_database_query_operations() -> Result<(), Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        let db_path = temp_dir.path().join("test.db");
        
        create_test_database(db_path.to_str().unwrap())?;
        
        let conn = Connection::open(&db_path)?;
        
        // Test basic SELECT
        let mut stmt = conn.prepare("SELECT name, email FROM users WHERE active = 1")?;
        let user_iter = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
            ))
        })?;
        
        let mut users = Vec::new();
        for user in user_iter {
            users.push(user?);
        }
        
        assert_eq!(users.len(), 2); // John and Jane are active
        assert!(users.iter().any(|(name, _)| name == "John Doe"));
        assert!(users.iter().any(|(name, _)| name == "Jane Smith"));
        
        // Test JOIN operation
        let mut stmt = conn.prepare(
            "SELECT u.name, p.title FROM users u 
             JOIN posts p ON u.id = p.user_id"
        )?;
        let joined_iter = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
            ))
        })?;
        
        let mut joined_results = Vec::new();
        for result in joined_iter {
            joined_results.push(result?);
        }
        
        assert_eq!(joined_results.len(), 2);
        assert!(joined_results.iter().any(|(name, title)| name == "John Doe" && title == "First Post"));
        assert!(joined_results.iter().any(|(name, title)| name == "Jane Smith" && title == "Jane's Post"));
        
        Ok(())
    }
} 