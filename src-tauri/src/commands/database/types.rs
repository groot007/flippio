// Database types - enhanced with per-database connection caching
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use sqlx::sqlite::SqlitePool;

// Connection cache entry with TTL (Time To Live)
#[derive(Debug, Clone)]
pub struct CachedConnection {
    pub pool: SqlitePool,
    pub last_used: Instant,
    pub created_at: Instant,
}

impl CachedConnection {
    pub fn new(pool: SqlitePool) -> Self {
        let now = Instant::now();
        Self {
            pool,
            last_used: now,
            created_at: now,
        }
    }

    pub fn update_last_used(&mut self) {
        self.last_used = Instant::now();
    }

    pub fn is_expired(&self, ttl: Duration) -> bool {
        self.last_used.elapsed() > ttl
    }
    
    /// Check if the pool is actually closed/unusable
    pub fn is_pool_closed(&self) -> bool {
        self.pool.is_closed()
    }
    
    /// Check if this connection should be removed from cache
    /// (either time-expired or pool is closed)
    pub fn should_be_removed(&self, ttl: Duration) -> bool {
        self.is_expired(ttl) || self.is_pool_closed()
    }
}

// Per-database connection cache with automatic cleanup
pub type DbConnectionCache = Arc<RwLock<HashMap<String, CachedConnection>>>;

// Legacy global pool type for backward compatibility during migration
pub type DbPool = Arc<RwLock<Option<SqlitePool>>>;

// Response types matching Electron IPC responses
#[derive(Debug, Serialize, Deserialize)]
pub struct DbResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TableInfo {
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub type_name: String,
    pub notnull: bool,
    pub pk: bool,
    #[serde(rename = "defaultValue")]
    pub default_value: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TableData {
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DbInfo {
    pub path: String,
    pub size: u64,
    pub tables: Vec<TableInfo>,
}

// Connection management configuration
#[allow(dead_code)]
pub struct ConnectionConfig {
    pub max_connections: usize,
    pub connection_ttl: Duration,
    pub cleanup_interval: Duration,
}

impl Default for ConnectionConfig {
    fn default() -> Self {
        Self {
            max_connections: 10,           // Maximum 10 concurrent database connections
            connection_ttl: Duration::from_secs(300), // 5 minutes TTL
            cleanup_interval: Duration::from_secs(60), // Cleanup every minute
        }
    }
}
