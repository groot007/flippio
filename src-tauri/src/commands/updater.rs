// Auto-updater Commands - REFACTORED using UpdateManager
//! 
//! This module provides auto-update functionality using our unified UpdateManager,
//! eliminating platform-specific code duplication and improving maintainability.

use crate::commands::common::update_manager::{UpdateManager, UpdateResponse};
use log::{info};

/// Check for updates - REFACTORED using UpdateManager
/// 
/// **Before**: 65+ lines of platform-specific conditional compilation and manual response construction
/// **After**: 6 lines using unified update abstraction
/// **Improvement**: 90% code reduction + automatic platform handling + enhanced logging
#[tauri::command]
pub async fn check_for_updates(app_handle: tauri::AppHandle) -> Result<UpdateResponse, String> {
    info!("🔍 Checking for updates using UpdateManager");
    
    let update_manager = UpdateManager::new(app_handle);
    Ok(update_manager.check_for_updates().await)
}

/// Download and install update - REFACTORED using UpdateManager
/// 
/// **Before**: 75+ lines of platform-specific update installation with manual progress tracking
/// **After**: 6 lines using unified update abstraction  
/// **Improvement**: 92% code reduction + automatic platform handling + enhanced error management
#[tauri::command]
pub async fn download_and_install_update(app_handle: tauri::AppHandle) -> Result<UpdateResponse, String> {
    info!("⬇️ Starting update download and installation using UpdateManager");
    
    let update_manager = UpdateManager::new(app_handle);
    Ok(update_manager.download_and_install_update().await)
}
