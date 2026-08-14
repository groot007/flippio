use crate::commands::database::helpers::ensure_database_file_permissions;
use crate::commands::database::types::{CachedConnection, DbConnectionCache, DbPool};
use log::{error, info, warn};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::str::FromStr;
use tauri::State;

const SQLITE_HEADER: &[u8; 16] = b"SQLite format 3\0";

/// Helper function to validate that a pool is actually usable.
pub async fn validate_pool_health(pool: &SqlitePool) -> bool {
    if pool.is_closed() {
        warn!("🚫 Pool is marked as closed");
        return false;
    }

    match sqlx::query("SELECT 1").fetch_one(pool).await {
        Ok(_) => {
            log::debug!("✅ Pool health check passed");
            true
        }
        Err(e) => {
            warn!("🚫 Pool health check failed: {}", e);
            false
        }
    }
}

pub fn normalize_db_path(db_path: &str) -> String {
    match std::fs::canonicalize(db_path) {
        Ok(absolute_path) => absolute_path.to_string_lossy().to_string(),
        Err(_) => db_path.to_string(),
    }
}

pub fn is_sqlcipher_key_error(error: &str) -> bool {
    error.contains("file is not a database")
        || error.contains("not a database")
        || error.contains("SQL logic error")
}

pub fn has_sqlite_plaintext_header(db_path: &str) -> Result<bool, String> {
    let normalized_path = normalize_db_path(db_path);
    let path = Path::new(&normalized_path);

    if !path.exists() {
        return Err(format!("Database file does not exist: {}", normalized_path));
    }

    let metadata = path
        .metadata()
        .map_err(|e| format!("Failed to read database metadata: {}", e))?;

    if metadata.len() == 0 {
        return Ok(true);
    }

    if metadata.len() < SQLITE_HEADER.len() as u64 {
        return Ok(false);
    }

    let mut file =
        File::open(path).map_err(|e| format!("Failed to open database file header: {}", e))?;
    let mut header = [0_u8; 16];
    file.read_exact(&mut header)
        .map_err(|e| format!("Failed to read database file header: {}", e))?;

    Ok(&header == SQLITE_HEADER)
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

async fn connect_sqlite_pool(db_path: &str, key: Option<&str>) -> Result<SqlitePool, String> {
    if !Path::new(db_path).exists() {
        return Err(format!("Database file does not exist: {}", db_path));
    }

    ensure_database_file_permissions(db_path)?;

    let mut options = SqliteConnectOptions::from_str(&format!("sqlite:{}?mode=rwc", db_path))
        .map_err(|e| format!("Could not build database connection options: {}", e))?;

    if let Some(key) = key {
        options = options.pragma("key", quote_sqlite_pragma_string(key));
    }

    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .map_err(|e| format!("Could not connect to database: {}", e))?;

    match validate_sqlite_connection(&pool).await {
        Ok(()) => Ok(pool),
        Err(e) => {
            pool.close().await;
            Err(e)
        }
    }
}

/// Get or create a database connection, optionally with a SQLCipher key.
pub async fn get_cached_connection(
    db_cache: &DbConnectionCache,
    db_path: &str,
    key: Option<&str>,
) -> Result<SqlitePool, String> {
    let normalized_path = normalize_db_path(db_path);

    {
        let mut cache_guard = db_cache.write().await;
        if let Some(cached_conn) = cache_guard.get_mut(&normalized_path) {
            if !cached_conn.is_pool_closed() && cached_conn.matches_key(key) {
                cached_conn.update_last_used();
                info!("📦 Reusing cached connection for: {}", normalized_path);
                return Ok(cached_conn.pool.clone());
            }

            cache_guard.remove(&normalized_path);
            warn!(
                "🧹 Removed closed or credential-mismatched connection for: {}",
                normalized_path
            );
        }
    }

    info!("🔗 Creating connection for: {}", normalized_path);
    let pool = connect_sqlite_pool(&normalized_path, key).await?;

    {
        let mut cache_guard = db_cache.write().await;
        cache_guard.insert(
            normalized_path.clone(),
            CachedConnection::new_with_key(pool.clone(), key),
        );
    }

    info!("✅ Successfully connected to database: {}", normalized_path);
    Ok(pool)
}

/// Revoke prior active and cached access before an explicit open/unlock attempt.
pub async fn reset_connection_for_open(
    state: &DbPool,
    db_cache: &DbConnectionCache,
    db_path: &str,
) {
    *state.write().await = None;

    let normalized_path = normalize_db_path(db_path);
    let mut cache_guard = db_cache.write().await;
    for cached_connection in cache_guard.values_mut() {
        cached_connection.set_active(false);
    }
    cache_guard.remove(&normalized_path);
}

pub async fn mark_cached_connection_active(db_cache: &DbConnectionCache, db_path: &str) {
    let normalized_path = normalize_db_path(db_path);
    let mut cache_guard = db_cache.write().await;
    if let Some(cached_connection) = cache_guard.get_mut(&normalized_path) {
        cached_connection.set_active(true);
    }
}

// Helper function to get the current active database from cache or state.
pub async fn get_current_pool(
    state: &State<'_, DbPool>,
    db_cache: &State<'_, DbConnectionCache>,
    current_db_path: Option<String>,
) -> Result<SqlitePool, String> {
    if let Some(db_path) = current_db_path {
        let normalized_path = normalize_db_path(&db_path);
        log::debug!(
            "🔍 Attempting to get connection for specific database: {}",
            normalized_path
        );

        {
            let mut cache_guard = db_cache.write().await;
            if let Some(cached_conn) = cache_guard.get_mut(&normalized_path) {
                if !cached_conn.is_pool_closed() {
                    cached_conn.update_last_used();
                    info!(
                        "✅ Using cached connection for specific database: {}",
                        normalized_path
                    );
                    return Ok(cached_conn.pool.clone());
                }

                cache_guard.remove(&normalized_path);
                warn!("🧹 Removed closed pool from cache: {}", normalized_path);
            }
        }

        warn!(
            "⚠️ No cached connection found for specific database: {}",
            normalized_path
        );
        return get_cached_connection(db_cache, &db_path, None).await;
    }

    {
        let cache_guard = db_cache.read().await;
        if let Some((path, cached_conn)) = cache_guard.iter().next() {
            if !cached_conn.should_be_removed(std::time::Duration::from_secs(300)) {
                warn!(
                    "⚠️ Using fallback cached connection from cache (no specific DB requested): {}",
                    path
                );
                return Ok(cached_conn.pool.clone());
            }
        }
    }

    {
        let pool_guard = state.read().await;
        match pool_guard.as_ref() {
            Some(pool) => {
                if pool.is_closed() {
                    error!("🚫 Legacy pool is also closed!");
                    Err("All database connections are closed".to_string())
                } else {
                    warn!("⚠️ Using legacy pool connection (no specific DB requested)");
                    Ok(pool.clone())
                }
            }
            None => Err("No database connection available".to_string()),
        }
    }
}
