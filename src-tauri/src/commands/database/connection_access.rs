use crate::commands::database::helpers::ensure_database_file_permissions;
use crate::commands::database::types::{DbConnectionCache, DbPool};
use log::{error, info, warn};
use sqlx::sqlite::SqlitePool;
use tauri::State;

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

/// Get or create a database connection (cache disabled - always creates fresh connections).
pub async fn get_cached_connection(
    _db_cache: &DbConnectionCache,
    db_path: &str,
) -> Result<SqlitePool, String> {
    let normalized_path = match std::fs::canonicalize(db_path) {
        Ok(absolute_path) => absolute_path.to_string_lossy().to_string(),
        Err(_) => db_path.to_string(),
    };

    info!("🚫 Cache disabled - creating fresh connection for: {}", normalized_path);

    if !std::path::Path::new(&normalized_path).exists() {
        return Err(format!("Database file does not exist: {}", normalized_path));
    }

    ensure_database_file_permissions(&normalized_path)?;

    match SqlitePool::connect(&format!("sqlite:{}?mode=rwc", normalized_path)).await {
        Ok(pool) => {
            info!("✅ Successfully connected to database: {}", normalized_path);
            Ok(pool)
        }
        Err(e) => {
            error!("❌ Failed to connect to database '{}': {}", normalized_path, e);
            Err(format!("Could not connect to database: {}", e))
        }
    }
}

// Helper function to get the current active database from cache or state.
pub async fn get_current_pool(
    state: &State<'_, DbPool>,
    db_cache: &State<'_, DbConnectionCache>,
    current_db_path: Option<String>,
) -> Result<SqlitePool, String> {
    if let Some(db_path) = current_db_path {
        log::debug!("🔍 Attempting to get connection for specific database: {}", db_path);
        return match get_cached_connection(db_cache, &db_path).await {
            Ok(cached_pool) => {
                if cached_pool.is_closed() {
                    error!(
                        "🚫 Cached pool is closed even though it was just returned! Path: {}",
                        db_path
                    );
                    {
                        let normalized_path = match std::fs::canonicalize(&db_path) {
                            Ok(absolute_path) => absolute_path.to_string_lossy().to_string(),
                            Err(_) => db_path.clone(),
                        };
                        let mut cache_guard = db_cache.write().await;
                        cache_guard.remove(&normalized_path);
                        warn!("🧹 Force removed closed pool from cache: {}", normalized_path);
                    }

                    info!("🔄 Attempting to create new connection after detecting closed pool");
                    return get_cached_connection(db_cache, &db_path).await;
                }

                info!("✅ Using cached connection for specific database: {}", db_path);
                Ok(cached_pool)
            }
            Err(e) => {
                warn!("⚠️ Failed to get cached connection for specific database: {}", e);
                Err(e)
            }
        }
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
