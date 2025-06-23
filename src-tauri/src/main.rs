// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use tokio::sync::RwLock;

mod commands;
use commands::database::DbPool;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize database connection pool state
    let db_pool: DbPool = Arc::new(RwLock::new(None));
    
    let mut builder = tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .manage(db_pool)
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
            commands::device::adb_get_devices,
            commands::device::adb_get_packages,
            commands::device::adb_get_android_database_files,
            commands::device::adb_push_database_file,
            // Device commands (iOS)
            commands::device::device_get_ios_devices,
            commands::device::device_get_ios_packages,
            commands::device::device_get_ios_device_packages,
            commands::device::device_get_ios_device_database_files,
            commands::device::adb_get_ios_database_files,
            commands::device::device_check_app_existence,
            commands::device::device_upload_ios_db_file,
            commands::device::device_push_ios_database_file,
            // Virtual device commands
            commands::device::get_android_emulators,
            commands::device::get_ios_simulators,
            commands::device::launch_android_emulator,
            commands::device::launch_ios_simulator,
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
            // Common commands (file dialogs)
            commands::common::dialog_select_file,
            commands::common::dialog_save_file,
            // Updater commands
            commands::updater::check_for_updates,
            commands::updater::download_and_install_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
