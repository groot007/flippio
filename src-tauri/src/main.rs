// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use tokio::sync::RwLock;
use tauri_plugin_log;

mod commands;
use commands::database::{DbPool, DatabaseConnectionManager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize database connection management
    let db_pool: DbPool = Arc::new(RwLock::new(None)); // Legacy pool for compatibility
    let connection_manager = DatabaseConnectionManager::new();
    let db_cache = connection_manager.get_cache();
    
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .manage(db_pool)
        .manage(db_cache)
        .setup(|_app| {
            // Start background cleanup task after Tauri runtime is initialized
            let connection_manager = DatabaseConnectionManager::new();
            tauri::async_runtime::spawn(async move {
                connection_manager.start_cleanup_task().await;
            });
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init());

    // Add updater plugin only for desktop platforms
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .invoke_handler(tauri::generate_handler![
            // Device commands (ADB)
            commands::device::adb::adb_get_devices,
            commands::device::adb::adb_get_packages,
            commands::device::adb::adb_get_android_database_files,
            commands::device::adb::adb_push_database_file,
            // Device commands (iOS)
            commands::device::ios::device::device_get_ios_devices,
            commands::device::ios::packages::device_get_ios_packages,
            commands::device::ios::packages::device_get_ios_device_packages,
            commands::device::ios::database::get_ios_device_database_files,
            commands::device::ios::device::device_check_app_existence,
            commands::device::ios::database::device_push_ios_database_file,
            // iOS Simulator commands
            commands::device::ios::simulator::get_ios_simulator_database_files,
            commands::device::ios::simulator::upload_simulator_ios_db_file,
            // Virtual device commands
            commands::device::virtual_device::get_android_emulators,
            commands::device::virtual_device::get_ios_simulators,
            commands::device::virtual_device::launch_android_emulator,
            commands::device::virtual_device::launch_ios_simulator,
            // Database commands
            commands::database::db_open,
            commands::database::db_get_tables,
            commands::database::db_get_table_data,
            commands::database::db_get_info,
            commands::database::db_update_table_row,
            commands::database::db_insert_table_row,
            commands::database::db_add_new_row_with_defaults,
            commands::database::db_delete_table_row,
            commands::database::db_execute_query,
            commands::database::db_get_connection_stats,
            commands::database::db_clear_cache_for_path,
            commands::database::db_clear_all_cache,
            commands::database::db_switch_database,
            // File dialog commands
            commands::file_dialogs::dialog_select_file,
            commands::file_dialogs::dialog_save_file,
            commands::file_dialogs::save_dropped_file,
            // Updater commands
            commands::updater::check_for_updates,
            commands::updater::download_and_install_update,
            // iOS diagnostic commands
            commands::device::ios::diagnostic::diagnose_ios_device,
            commands::device::ios::diagnostic::check_ios_device_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
