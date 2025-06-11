// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::Connection;
use std::sync::Mutex;

mod commands;
mod database;
mod device;

use commands::*;
use database::*;
use device::*;

#[derive(Default)]
struct AppState {
    db_connection: Mutex<Option<Connection>>,
}

fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            // Device management
            get_devices,
            get_ios_packages,
            get_android_packages,
            get_ios_device_packages,
            get_android_database_files,
            get_ios_database_files,
            get_ios_device_database_files,
            check_app_existence,
            upload_ios_db_file,
            push_database_file,
            // Database operations
            open_database,
            get_tables,
            get_table_data,
            update_table_row,
            delete_table_row,
            insert_table_row,
            execute_query,
            // File operations
            select_file_dialog,
            save_file_dialog,
            // Virtual devices
            get_virtual_devices,
            launch_virtual_device,
            close_virtual_device,
            get_android_emulators,
            get_ios_simulators,
            launch_android_emulator,
            launch_ios_simulator
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
