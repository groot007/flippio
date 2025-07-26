use tempfile::TempDir;
use std::path::PathBuf;
use sqlx::sqlite::SqlitePool;

/// Create a temporary SQLite database for testing
pub async fn create_test_db() -> (TempDir, PathBuf) {
    let temp_dir = tempfile::tempdir().unwrap();
    let db_path = temp_dir.path().join("test.db");
    
    // Create the database asynchronously - sqlite:// prefix creates file if it doesn't exist
    let pool = SqlitePool::connect(&format!("sqlite://{}?mode=rwc", db_path.display()))
        .await
        .unwrap();
    
    // Create test table
    sqlx::query(
        "CREATE TABLE test_table (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            value INTEGER
        )"
    )
    .execute(&pool)
    .await
    .unwrap();
    
    // Insert test data
    sqlx::query("INSERT INTO test_table (name, value) VALUES ('test1', 100)")
        .execute(&pool)
        .await
        .unwrap();
    
    sqlx::query("INSERT INTO test_table (name, value) VALUES ('test2', 200)")
        .execute(&pool)
        .await
        .unwrap();
    
    // Close the pool connection
    pool.close().await;
    
    (temp_dir, db_path)
}

/// Create a temporary database with multiple tables
pub async fn create_complex_test_db() -> (TempDir, PathBuf) {
    let temp_dir = tempfile::tempdir().unwrap();
    let db_path = temp_dir.path().join("complex.db");
    
    let pool = SqlitePool::connect(&format!("sqlite://{}?mode=rwc", db_path.display()))
        .await
        .unwrap();
            
        // Create users table
        sqlx::query(
            "CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL
            )"
        )
        .execute(&pool)
        .await
        .unwrap();
        
        // Create posts table with foreign key
        sqlx::query(
            "CREATE TABLE posts (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )"
        )
        .execute(&pool)
        .await
        .unwrap();
        
        // Insert test users
        sqlx::query("INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')")
            .execute(&pool)
            .await
            .unwrap();
            
        sqlx::query("INSERT INTO users (name, email) VALUES ('Bob', 'bob@example.com')")
            .execute(&pool)
            .await
            .unwrap();
            
        // Insert test posts
        sqlx::query("INSERT INTO posts (user_id, title, content) VALUES (1, 'Hello World', 'First post')")
            .execute(&pool)
            .await
            .unwrap();
            
        sqlx::query("INSERT INTO posts (user_id, title, content) VALUES (2, 'Another Post', 'Second post')")
            .execute(&pool)
        .await
        .unwrap();
    
    // Close the pool connection
    pool.close().await;
    
    (temp_dir, db_path)
}/// Create an empty database file
pub fn create_empty_db() -> (TempDir, PathBuf) {
    let temp_dir = tempfile::tempdir().unwrap();
    let db_path = temp_dir.path().join("empty.db");
    
    // Create empty file
    std::fs::File::create(&db_path).unwrap();
    
    (temp_dir, db_path)
}

/// Create a corrupted database file
pub fn create_corrupted_db() -> (TempDir, PathBuf) {
    let temp_dir = tempfile::tempdir().unwrap();
    let db_path = temp_dir.path().join("corrupted.db");
    
    // Write invalid SQLite header
    std::fs::write(&db_path, b"INVALID SQLITE DATABASE").unwrap();
    
    (temp_dir, db_path)
}
