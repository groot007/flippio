use Flippio::commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .setup(|app| {
            #[cfg(debug_assertions)] // only include this code on debug builds
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
                window.close_devtools();
            }
            Ok(())
        })
        .manage(Flippio::DatabaseConnectionManager::new())
        .manage(Flippio::DatabaseCache::new())
        .invoke_handler(tauri::generate_handler![
            // Android commands (new structure)
            commands::android::adb_get_devices,
            commands::android::adb_get_packages,
            commands::android::adb_get_android_database_files,
            commands::android::adb_push_database_file,
            // iOS commands (new structure)
            commands::ios::device_get_ios_devices,
            commands::ios::device_get_ios_packages,
            commands::ios::device_get_ios_device_packages,
            commands::ios::get_ios_device_database_files,
            commands::ios::device_check_app_existence,
            commands::ios::device_push_ios_database_file,
            // iOS Simulator commands (new structure)
            commands::ios::get_ios_simulator_database_files,
            commands::ios::upload_simulator_ios_db_file,
            // Virtual device commands
            commands::virtual_devices::get_android_emulators,
            commands::virtual_devices::get_ios_simulators,
            commands::virtual_devices::launch_android_emulator,
            commands::virtual_devices::launch_ios_simulator,
            // Database commands (pure SQL operations)
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
            // Dialog commands (file operations)
            commands::dialogs::dialog_select_file,
            commands::dialogs::dialog_save_file,
            commands::dialogs::save_dropped_file,
            // App management commands (updater, etc.)
            commands::app_management::check_update,
            commands::app_management::install_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
} 