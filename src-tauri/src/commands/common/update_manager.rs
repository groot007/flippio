//! Unified Update Manager
//! 
//! This module provides a comprehensive interface for auto-update operations,
//! handling platform-specific differences and providing consistent error handling.

use log::{info, error, debug};
use serde::{Deserialize, Serialize};

/// Update information structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub available: bool,
    pub version: Option<String>,
    pub notes: Option<String>,
    pub date: Option<String>,
}

/// Standardized update response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateResponse {
    pub success: bool,
    pub data: Option<UpdateInfo>,
    pub error: Option<String>,
}

/// Update manager configuration
#[derive(Debug, Clone)]
pub struct UpdateConfig {
    pub check_on_startup: bool,
    pub auto_download: bool,
    pub notify_user: bool,
    pub update_channel: UpdateChannel,
}

/// Update channels for different release types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UpdateChannel {
    Stable,
    Beta,
    Dev,
}

impl Default for UpdateConfig {
    fn default() -> Self {
        Self {
            check_on_startup: true,
            auto_download: false,
            notify_user: true,
            update_channel: UpdateChannel::Stable,
        }
    }
}

/// Unified update manager
pub struct UpdateManager {
    app_handle: tauri::AppHandle,
    config: UpdateConfig,
}

impl UpdateManager {
    /// Create a new update manager
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        Self {
            app_handle,
            config: UpdateConfig::default(),
        }
    }
    
    /// Create with custom configuration
    pub fn with_config(app_handle: tauri::AppHandle, config: UpdateConfig) -> Self {
        Self {
            app_handle,
            config,
        }
    }
    
    /// Check for available updates
    pub async fn check_for_updates(&self) -> UpdateResponse {
        info!("🔍 Checking for updates using UpdateManager");
        debug!("Update config: {:?}", self.config);
        
        // Handle platform-specific update checking
        #[cfg(not(any(target_os = "android", target_os = "ios")))]
        {
            self.check_desktop_updates().await
        }
        
        #[cfg(any(target_os = "android", target_os = "ios"))]
        {
            self.handle_mobile_platform()
        }
    }
    
    /// Download and install available updates
    pub async fn download_and_install_update(&self) -> UpdateResponse {
        info!("⬇️ Starting update download and installation");
        
        // Handle platform-specific update installation
        #[cfg(not(any(target_os = "android", target_os = "ios")))]
        {
            self.install_desktop_update().await
        }
        
        #[cfg(any(target_os = "android", target_os = "ios"))]
        {
            self.handle_mobile_platform_install()
        }
    }
    
    /// Check for updates on desktop platforms
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    async fn check_desktop_updates(&self) -> UpdateResponse {
        use tauri_plugin_updater::UpdaterExt;
        
        match self.app_handle.updater() {
            Ok(updater) => {
                match updater.check().await {
                    Ok(Some(update)) => {
                        info!("✅ Update available: version {}", update.version);
                        
                        UpdateResponse::success(UpdateInfo {
                            available: true,
                            version: Some(update.version.clone()),
                            notes: update.body.clone(),
                            date: update.date.map(|d| d.to_string()),
                        })
                    }
                    Ok(None) => {
                        info!("✅ No updates available");
                        
                        UpdateResponse::success(UpdateInfo {
                            available: false,
                            version: None,
                            notes: None,
                            date: None,
                        })
                    }
                    Err(e) => {
                        error!("❌ Failed to check for updates: {}", e);
                        UpdateResponse::error(&format!("Failed to check for updates: {}", e))
                    }
                }
            }
            Err(e) => {
                error!("❌ Failed to get updater: {}", e);
                UpdateResponse::error(&format!("Updater not available: {}", e))
            }
        }
    }
    
    /// Install updates on desktop platforms
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    async fn install_desktop_update(&self) -> UpdateResponse {
        use tauri_plugin_updater::UpdaterExt;
        
        match self.app_handle.updater() {
            Ok(updater) => {
                match updater.check().await {
                    Ok(Some(update)) => {
                        info!("📥 Downloading update version {}", update.version);
                        
                        // Install the update with progress tracking
                        match update.download_and_install(
                            |chunk_length, content_length| {
                                debug!("📊 Downloaded {} of {:?} bytes", chunk_length, content_length);
                            },
                            || {
                                info!("📦 Download finished, installing...");
                            }
                        ).await {
                            Ok(_) => {
                                info!("✅ Update installed successfully, restarting...");
                                self.app_handle.restart();
                            }
                            Err(e) => {
                                error!("❌ Failed to download/install update: {}", e);
                                UpdateResponse::error(&format!("Failed to download/install update: {}", e))
                            }
                        }
                    }
                    Ok(None) => {
                        UpdateResponse::error("No update available")
                    }
                    Err(e) => {
                        error!("❌ Failed to check for updates: {}", e);
                        UpdateResponse::error(&format!("Failed to check for updates: {}", e))
                    }
                }
            }
            Err(e) => {
                error!("❌ Failed to get updater: {}", e);
                UpdateResponse::error(&format!("Updater not available: {}", e))
            }
        }
    }
    
    /// Handle mobile platform update checking (not supported)
    #[cfg(any(target_os = "android", target_os = "ios"))]
    fn handle_mobile_platform(&self) -> UpdateResponse {
        info!("📱 Mobile platform detected - auto-updates not supported");
        
        UpdateResponse::success(UpdateInfo {
            available: false,
            version: None,
            notes: Some("Updates are handled through the App Store/Google Play Store".to_string()),
            date: None,
        })
    }
    
    /// Handle mobile platform update installation (not supported)
    #[cfg(any(target_os = "android", target_os = "ios"))]
    fn handle_mobile_platform_install(&self) -> UpdateResponse {
        info!("📱 Mobile platform detected - auto-updates not supported");
        
        UpdateResponse::error("Auto-updates not supported on mobile platforms. Please update through your app store.")
    }
    
    /// Get current application version
    pub fn get_current_version(&self) -> String {
        self.app_handle.package_info().version.to_string()
    }
    
    /// Check if platform supports auto-updates
    pub fn is_auto_update_supported(&self) -> bool {
        #[cfg(any(target_os = "android", target_os = "ios"))]
        {
            false
        }
        #[cfg(not(any(target_os = "android", target_os = "ios")))]
        {
            true
        }
    }
    
    /// Get platform-specific update instructions
    pub fn get_update_instructions(&self) -> String {
        #[cfg(target_os = "windows")]
        {
            "Updates are automatically downloaded and installed. The application will restart when ready.".to_string()
        }
        #[cfg(target_os = "macos")]
        {
            "Updates are automatically downloaded and installed. The application will restart when ready.".to_string()
        }
        #[cfg(target_os = "linux")]
        {
            "Updates are automatically downloaded and installed. You may need to restart the application manually.".to_string()
        }
        #[cfg(target_os = "android")]
        {
            "Updates are managed through Google Play Store. Check the Play Store for available updates.".to_string()
        }
        #[cfg(target_os = "ios")]
        {
            "Updates are managed through the App Store. Check the App Store for available updates.".to_string()
        }
    }
}

impl UpdateResponse {
    /// Create a successful response
    pub fn success(data: UpdateInfo) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }
    
    /// Create an error response
    pub fn error(error_message: &str) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error_message.to_string()),
        }
    }
}

impl UpdateInfo {
    /// Create update info for available update
    pub fn available(version: String, notes: Option<String>, date: Option<String>) -> Self {
        Self {
            available: true,
            version: Some(version),
            notes,
            date,
        }
    }
    
    /// Create update info for no available update
    pub fn not_available() -> Self {
        Self {
            available: false,
            version: None,
            notes: None,
            date: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_update_config_default() {
        let config = UpdateConfig::default();
        assert!(config.check_on_startup);
        assert!(!config.auto_download);
        assert!(config.notify_user);
        assert!(matches!(config.update_channel, UpdateChannel::Stable));
    }
    
    #[test]
    fn test_update_response_success() {
        let info = UpdateInfo::available("1.0.1".to_string(), Some("Bug fixes".to_string()), None);
        let response = UpdateResponse::success(info);
        
        assert!(response.success);
        assert!(response.error.is_none());
        assert!(response.data.is_some());
    }
    
    #[test]
    fn test_update_response_error() {
        let response = UpdateResponse::error("Network error");
        
        assert!(!response.success);
        assert_eq!(response.error, Some("Network error".to_string()));
        assert!(response.data.is_none());
    }
    
    #[test]
    fn test_update_info_available() {
        let info = UpdateInfo::available("1.0.1".to_string(), Some("New features".to_string()), None);
        
        assert!(info.available);
        assert_eq!(info.version, Some("1.0.1".to_string()));
        assert_eq!(info.notes, Some("New features".to_string()));
    }
    
    #[test]
    fn test_update_info_not_available() {
        let info = UpdateInfo::not_available();
        
        assert!(!info.available);
        assert!(info.version.is_none());
        assert!(info.notes.is_none());
        assert!(info.date.is_none());
    }
} 