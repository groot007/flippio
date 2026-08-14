// Database connection management with per-database caching
use crate::commands::database::helpers::ensure_database_file_permissions;
use crate::commands::database::types::*;
use log::{error, info, warn};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::collections::HashMap;
use std::path::Path;
use std::str::FromStr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::sleep;

/// Database connection manager with caching and automatic cleanup
#[derive(Clone)]
pub struct DatabaseConnectionManager {
    cache: DbConnectionCache,
    config: ConnectionConfig,
}

#[allow(dead_code)]
impl DatabaseConnectionManager {
    /// Create a new connection manager with default configuration
    pub fn new() -> Self {
        Self::with_config(ConnectionConfig::default())
    }

    /// Create a new connection manager with custom configuration
    pub fn with_config(config: ConnectionConfig) -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
            config,
        }
    }

    /// Get the cache for use in Tauri state management
    pub fn get_cache(&self) -> DbConnectionCache {
        self.cache.clone()
    }

    /// Get a database connection, reusing cached connection if available
    pub async fn get_connection(&self, db_path: &str) -> Result<SqlitePool, String> {
        self.get_connection_with_key(db_path, None).await
    }

    /// Get a database connection, reusing cached connection if available.
    pub async fn get_connection_with_key(
        &self,
        db_path: &str,
        key: Option<&str>,
    ) -> Result<SqlitePool, String> {
        let normalized_path = self.normalize_path(db_path);

        // If caching is disabled, always create fresh connections
        if self.config.cache_disabled {
            info!(
                "🚫 Cache disabled - creating fresh connection for: {}",
                normalized_path
            );
            return self.create_new_connection(&normalized_path, key).await;
        }

        // Try to get existing connection from cache
        {
            let mut cache_guard = self.cache.write().await;

            if let Some(cached_conn) = cache_guard.get_mut(&normalized_path) {
                // Check if connection should be removed (time-expired OR pool is closed)
                if !cached_conn.should_be_removed(self.config.connection_ttl)
                    && cached_conn.matches_key(key)
                {
                    cached_conn.update_last_used();
                    info!("📦 Reusing cached connection for: {}", normalized_path);
                    return Ok(cached_conn.pool.clone());
                } else {
                    if cached_conn.is_pool_closed() {
                        info!(
                            "🚫 Cached connection pool is closed, removing from cache: {}",
                            normalized_path
                        );
                    } else {
                        info!("⏰ Cached connection expired for: {}", normalized_path);
                    }
                    // Remove the invalid connection from cache
                    cache_guard.remove(&normalized_path);
                }
            }
        }

        // Create new connection
        info!("🔗 Creating new connection for: {}", normalized_path);
        let pool = self.create_new_connection(&normalized_path, key).await?;

        // Add to cache only if caching is enabled
        if !self.config.cache_disabled {
            let mut cache_guard = self.cache.write().await;

            // Check cache size limit
            if cache_guard.len() >= self.config.max_connections {
                self.cleanup_oldest_connection(&mut cache_guard).await;
            }

            cache_guard.insert(
                normalized_path.clone(),
                CachedConnection::new_with_key(pool.clone(), key),
            );
        }

        Ok(pool)
    }

    /// Create a new SQLite connection
    async fn create_new_connection(
        &self,
        db_path: &str,
        key: Option<&str>,
    ) -> Result<SqlitePool, String> {
        // Validate file exists
        if !Path::new(db_path).exists() {
            return Err(format!("Database file does not exist: {}", db_path));
        }

        // Ensure file permissions are correct
        ensure_database_file_permissions(db_path)?;

        let mut options =
            SqliteConnectOptions::from_str(&format!("sqlite:{}?mode=rwc", db_path))
                .map_err(|e| format!("Could not build database connection options: {}", e))?;

        if let Some(key) = key {
            options = options.pragma("key", quote_sqlite_pragma_string(key));
        }

        // Create connection with optimized settings
        match SqlitePoolOptions::new()
            .max_connections(self.config.max_connections as u32)
            .connect_with(options)
            .await
        {
            Ok(pool) => match validate_sqlite_connection(&pool).await {
                Ok(()) => {
                    info!("✅ Successfully connected to database: {}", db_path);
                    Ok(pool)
                }
                Err(e) => {
                    pool.close().await;
                    error!("❌ Failed to validate database '{}': {}", db_path, e);
                    Err(e)
                }
            },
            Err(e) => {
                error!("❌ Failed to connect to database '{}': {}", db_path, e);
                Err(format!("Could not connect to database: {}", e))
            }
        }
    }

    /// Remove oldest unused connection to make space
    async fn cleanup_oldest_connection(&self, cache: &mut HashMap<String, CachedConnection>) {
        if let Some((oldest_path, _)) = cache
            .iter()
            .filter(|(_, conn)| !conn.is_active())
            .min_by_key(|(_, conn)| conn.last_used)
            .map(|(path, conn)| (path.clone(), conn.clone()))
        {
            info!("🧹 Removing oldest cached connection: {}", oldest_path);
            cache.remove(&oldest_path);
            // Don't explicitly close the pool - let it be garbage collected
            // when all references are dropped
        }
    }

    /// Start background cleanup task for expired connections
    pub async fn start_cleanup_task(&self) {
        let cache = self.cache.clone();
        let ttl = self.config.connection_ttl;
        let interval = self.config.cleanup_interval;

        tokio::spawn(async move {
            loop {
                sleep(interval).await;

                let mut cache_guard = cache.write().await;
                let mut keys_to_remove = Vec::new();

                // Find connections that should be removed (expired or closed)
                for (path, conn) in cache_guard.iter() {
                    if conn.is_cleanup_candidate(ttl) {
                        keys_to_remove.push(path.clone());
                    }
                }

                // Remove invalid connections from cache
                for key in keys_to_remove {
                    cache_guard.remove(&key);
                    info!("🧹 Cleaning up invalid connection: {}", key);
                }

                if !cache_guard.is_empty() {
                    info!("📊 Active connections: {}", cache_guard.len());
                }
            }
        });
    }

    /// Close a specific database connection
    pub async fn close_connection(&self, db_path: &str) -> Result<(), String> {
        let normalized_path = self.normalize_path(db_path);
        let mut cache_guard = self.cache.write().await;

        if let Some(cached_conn) = cache_guard.remove(&normalized_path) {
            cached_conn.pool.close().await;
            info!("🔒 Closed connection for: {}", normalized_path);
            Ok(())
        } else {
            warn!("⚠️ No connection found to close for: {}", normalized_path);
            Ok(())
        }
    }

    /// Close all cached connections (for app shutdown)
    pub async fn close_all_connections(&self) {
        let mut cache_guard = self.cache.write().await;

        for (path, cached_conn) in cache_guard.drain() {
            cached_conn.pool.close().await;
            info!("🔒 Closed connection for: {}", path);
        }

        info!("🧹 All database connections closed");
    }

    /// Get connection statistics
    pub async fn get_stats(&self) -> HashMap<String, serde_json::Value> {
        let cache_guard = self.cache.read().await;
        let mut stats = HashMap::new();

        stats.insert(
            "total_connections".to_string(),
            serde_json::Value::from(cache_guard.len()),
        );
        stats.insert(
            "max_connections".to_string(),
            serde_json::Value::from(self.config.max_connections),
        );
        stats.insert(
            "ttl_seconds".to_string(),
            serde_json::Value::from(self.config.connection_ttl.as_secs()),
        );

        let connection_details: Vec<serde_json::Value> = cache_guard
            .iter()
            .map(|(path, conn)| {
                serde_json::json!({
                    "path": path,
                    "age_seconds": conn.created_at.elapsed().as_secs(),
                    "last_used_seconds_ago": conn.last_used.elapsed().as_secs()
                })
            })
            .collect();

        stats.insert(
            "connections".to_string(),
            serde_json::Value::Array(connection_details),
        );

        stats
    }

    /// Normalize database path for consistent caching
    fn normalize_path(&self, db_path: &str) -> String {
        // Convert to absolute path to avoid cache misses due to relative path differences
        match std::fs::canonicalize(db_path) {
            Ok(absolute_path) => absolute_path.to_string_lossy().to_string(),
            Err(_) => db_path.to_string(), // Fallback to original path if canonicalization fails
        }
    }
}

fn quote_sqlite_pragma_string(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

async fn validate_sqlite_connection(pool: &SqlitePool) -> Result<(), String> {
    sqlx::query("SELECT COUNT(*) FROM sqlite_master")
        .fetch_one(pool)
        .await
        .map(|_| ())
        .map_err(|e| format!("Could not validate database connection: {}", e))
}
