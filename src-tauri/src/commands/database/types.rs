// Database types - enhanced with per-database connection caching
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::sqlite::SqlitePool;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

// Connection cache entry with TTL (Time To Live)
#[derive(Debug, Clone)]
pub struct CachedConnection {
    pub pool: SqlitePool,
    pub last_used: Instant,
    pub created_at: Instant,
    is_active: bool,
    key_fingerprint: Option<[u8; 32]>,
}

impl CachedConnection {
    pub fn new_with_key(pool: SqlitePool, key: Option<&str>) -> Self {
        let now = Instant::now();
        Self {
            pool,
            last_used: now,
            created_at: now,
            is_active: false,
            key_fingerprint: key.map(fingerprint_database_key),
        }
    }

    pub fn matches_key(&self, key: Option<&str>) -> bool {
        self.key_fingerprint == key.map(fingerprint_database_key)
    }

    pub fn update_last_used(&mut self) {
        self.last_used = Instant::now();
    }

    pub fn set_active(&mut self, is_active: bool) {
        self.is_active = is_active;
    }

    pub fn is_active(&self) -> bool {
        self.is_active
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

    pub fn is_cleanup_candidate(&self, ttl: Duration) -> bool {
        !self.is_active && self.should_be_removed(ttl)
    }
}

fn fingerprint_database_key(key: &str) -> [u8; 32] {
    Sha256::digest(key.as_bytes()).into()
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
pub struct DbOpenResult {
    pub path: String,
    pub requires_key: bool,
    pub encryption_state: String,
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

// Configuration for the connection manager
#[derive(Debug, Clone)]
pub struct ConnectionConfig {
    pub max_connections: usize,
    pub connection_ttl: Duration,
    pub cleanup_interval: Duration,
    pub cache_disabled: bool,
}

impl Default for ConnectionConfig {
    fn default() -> Self {
        Self {
            max_connections: 10, // Maximum 10 concurrent database connections
            connection_ttl: Duration::from_secs(300), // 5 minutes TTL
            cleanup_interval: Duration::from_secs(60), // Cleanup every minute
            cache_disabled: false, // Cache enabled by default
        }
    }
}
