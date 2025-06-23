// Auto-updater commands module
// Implements auto-update functionality similar to Electron's autoUpdater

use serde::{Deserialize, Serialize};

#[cfg(not(any(target_os = "android", target_os = "ios")))]
use tauri_plugin_updater::UpdaterExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub available: bool,
    pub version: Option<String>,
    pub notes: Option<String>,
    pub date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateResponse {
    pub success: bool,
    pub data: Option<UpdateInfo>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn check_for_updates(app_handle: tauri::AppHandle) -> Result<UpdateResponse, String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        log::info!("Checking for updates...");
        
        match app_handle.updater() {
            Ok(updater) => {
                match updater.check().await {
                    Ok(Some(update)) => {
                        log::info!("Update available: version {}", update.version);
                        Ok(UpdateResponse {
                            success: true,
                            data: Some(UpdateInfo {
                                available: true,
                                version: Some(update.version.clone()),
                                notes: update.body.clone(),
                                date: update.date.map(|d| d.to_string()),
                            }),
                            error: None,
                        })
                    }
                    Ok(None) => {
                        log::info!("No updates available");
                        Ok(UpdateResponse {
                            success: true,
                            data: Some(UpdateInfo {
                                available: false,
                                version: None,
                                notes: None,
                                date: None,
                            }),
                            error: None,
                        })
                    }
                    Err(e) => {
                        log::error!("Failed to check for updates: {}", e);
                        Ok(UpdateResponse {
                            success: false,
                            data: None,
                            error: Some(format!("Failed to check for updates: {}", e)),
                        })
                    }
                }
            }
            Err(e) => {
                log::error!("Failed to get updater: {}", e);
                Ok(UpdateResponse {
                    success: false,
                    data: None,
                    error: Some(format!("Updater not available: {}", e)),
                })
            }
        }
    }
    
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        // Mobile platforms don't support auto-updates
        Ok(UpdateResponse {
            success: true,
            data: Some(UpdateInfo {
                available: false,
                version: None,
                notes: None,
                date: None,
            }),
            error: None,
        })
    }
}

#[tauri::command]
pub async fn download_and_install_update(app_handle: tauri::AppHandle) -> Result<UpdateResponse, String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        log::info!("Starting update download and installation...");
        
        match app_handle.updater() {
            Ok(updater) => {
                match updater.check().await {
                    Ok(Some(update)) => {
                        log::info!("Downloading update version {}", update.version);
                        
                        match update.download_and_install(|chunk_length, content_length| {
                            log::debug!("Downloaded {} of {:?} bytes", chunk_length, content_length);
                        }, || {
                            log::info!("Download finished, installing...");
                        }).await {
                            Ok(_) => {
                                log::info!("Update installed successfully, restarting...");
                                app_handle.restart();
                                // This code will never be reached, but Rust requires a return
                                unreachable!()
                            }
                            Err(e) => {
                                log::error!("Failed to download/install update: {}", e);
                                Ok(UpdateResponse {
                                    success: false,
                                    data: None,
                                    error: Some(format!("Failed to download/install update: {}", e)),
                                })
                            }
                        }
                    }
                    Ok(None) => {
                        Ok(UpdateResponse {
                            success: false,
                            data: None,
                            error: Some("No update available".to_string()),
                        })
                    }
                    Err(e) => {
                        log::error!("Failed to check for updates: {}", e);
                        Ok(UpdateResponse {
                            success: false,
                            data: None,
                            error: Some(format!("Failed to check for updates: {}", e)),
                        })
                    }
                }
            }
            Err(e) => {
                log::error!("Failed to get updater: {}", e);
                Ok(UpdateResponse {
                    success: false,
                    data: None,
                    error: Some(format!("Updater not available: {}", e)),
                })
            }
        }
    }
    
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        // Mobile platforms don't support auto-updates
        Ok(UpdateResponse {
            success: false,
            data: None,
            error: Some("Auto-updates not supported on mobile platforms".to_string()),
        })
    }
}
