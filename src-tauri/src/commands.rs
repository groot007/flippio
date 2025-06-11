use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct VirtualDevice {
    pub id: String,
    pub name: String,
    pub platform: String, // e.g., "android", "ios"
    pub device_type: String,
    pub status: String,
}

#[command]
pub async fn select_file_dialog(
    app: tauri::AppHandle,
    title: Option<String>,
    filters: Option<Vec<(String, Vec<String>)>>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    use tokio::sync::oneshot;
    
    let mut dialog = app.dialog().file();
    
    if let Some(title) = title {
        dialog = dialog.set_title(&title);
    }
    
    if let Some(filters) = filters {
        for (name, extensions) in filters {
            let ext_refs: Vec<&str> = extensions.iter().map(|s| s.as_str()).collect();
            dialog = dialog.add_filter(&name, &ext_refs);
        }
    }
    
    let (tx, rx) = oneshot::channel();
    
    dialog.pick_file(move |file_path| {
        let result = file_path.map(|path| path.to_string());
        let _ = tx.send(result);
    });
    
    match rx.await {
        Ok(result) => Ok(result),
        Err(_) => Err("Dialog was cancelled or failed".to_string()),
    }
}

#[command]
pub async fn save_file_dialog(
    app: tauri::AppHandle,
    title: Option<String>,
    default_name: Option<String>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    use tokio::sync::oneshot;
    
    let mut dialog = app.dialog().file();
    
    if let Some(title) = title {
        dialog = dialog.set_title(&title);
    }
    
    if let Some(default_name) = default_name {
        dialog = dialog.set_file_name(&default_name);
    }
    
    let (tx, rx) = oneshot::channel();
    
    dialog.save_file(move |file_path| {
        let result = file_path.map(|path| path.to_string());
        let _ = tx.send(result);
    });
    
    match rx.await {
        Ok(result) => Ok(result),
        Err(_) => Err("Dialog was cancelled or failed".to_string()),
    }
}

#[command]
pub async fn get_virtual_devices() -> Result<Vec<VirtualDevice>, String> {
    let mut devices = Vec::new();
    
    // Get Android emulators
    match Command::new("emulator").args(&["-list-avds"]).output() {
        Ok(output) => {
            let output_str = String::from_utf8_lossy(&output.stdout);
            for line in output_str.lines() {
                let line = line.trim();
                if !line.is_empty() {
                    devices.push(VirtualDevice {
                        id: line.to_string(),
                        name: format!("Android Emulator ({})", line),
                        platform: "android".to_string(),
                        device_type: "android_emulator".to_string(),
                        status: "stopped".to_string(),
                    });
                }
            }
        }
        Err(_) => {
            // Emulator command not available
        }
    }
    
    // Get iOS Simulators (already handled in device.rs get_devices function)
    // We could filter for simulators only here if needed
    
    Ok(devices)
}

#[command]
pub async fn get_android_emulators() -> Result<Vec<VirtualDevice>, String> {
    println!("🔍 DEBUG: Getting Android emulators...");
    let mut emulators = Vec::new();
    
    match Command::new("emulator").args(&["-list-avds"]).output() {
        Ok(output) => {
            let output_str = String::from_utf8_lossy(&output.stdout);
            println!("🔍 DEBUG: Emulator list output: {}", output_str);
            for line in output_str.lines() {
                let line = line.trim();
                if !line.is_empty() {
                    let emulator = VirtualDevice {
                        id: line.to_string(),
                        name: format!("Android Emulator ({})", line),
                        platform: "android".to_string(),
                        device_type: "android_emulator".to_string(),
                        status: "stopped".to_string(),
                    };
                    println!("🔍 DEBUG: Found Android emulator: {:?}", emulator);
                    emulators.push(emulator);
                }
            }
        }
        Err(e) => {
            println!("🔍 DEBUG: Emulator command failed: {}", e);
            // Emulator command not available
        }
    }
    
    println!("🔍 DEBUG: Total Android emulators found: {}", emulators.len());
    Ok(emulators)
}

#[command]
pub async fn get_ios_simulators() -> Result<Vec<VirtualDevice>, String> {
    let mut simulators = Vec::new();
    
    match Command::new("xcrun")
        .args(&["simctl", "list", "devices", "--json"])
        .output()
    {
        Ok(output) => {
            let output_str = String::from_utf8_lossy(&output.stdout);
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&output_str) {
                if let Some(devices_obj) = json.get("devices") {
                    for (runtime, device_list) in devices_obj.as_object().unwrap() {
                        if let Some(device_array) = device_list.as_array() {
                            for device in device_array {
                                if let (Some(name), Some(udid), Some(state)) = (
                                    device.get("name").and_then(|v| v.as_str()),
                                    device.get("udid").and_then(|v| v.as_str()),
                                    device.get("state").and_then(|v| v.as_str()),
                                ) {
                                    // Only include simulators, not physical devices
                                    if runtime.contains("iOS") || runtime.contains("watchOS") || runtime.contains("tvOS") {
                                        simulators.push(VirtualDevice {
                                            id: udid.to_string(),
                                            name: format!("{} ({})", name, runtime),
                                            platform: "ios".to_string(),
                                            device_type: "iphone".to_string(),
                                            status: state.to_string(),
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        Err(_) => {
            // Xcode tools not available
        }
    }
    
    Ok(simulators)
}

#[command]
pub async fn launch_virtual_device(device_id: String, device_type: String) -> Result<String, String> {
    match device_type.as_str() {
        "android_emulator" => {
            Command::new("emulator")
                .args(&["-avd", &device_id])
                .spawn()
                .map_err(|e| format!("Failed to launch Android emulator: {}", e))?;
            
            Ok(format!("Android emulator {} launched", device_id))
        }
        "iphone" => {
            Command::new("xcrun")
                .args(&["simctl", "boot", &device_id])
                .output()
                .map_err(|e| format!("Failed to boot iOS simulator: {}", e))?;
                
            Command::new("open")
                .args(&["-a", "Simulator"])
                .output()
                .map_err(|e| format!("Failed to open Simulator app: {}", e))?;
            
            Ok(format!("iOS simulator {} launched", device_id))
        }
        _ => Err(format!("Unsupported device type: {}", device_type)),
    }
}

#[command]
pub async fn launch_android_emulator(emulator_id: String) -> Result<String, String> {
    Command::new("emulator")
        .args(&["-avd", &emulator_id])
        .spawn()
        .map_err(|e| format!("Failed to launch Android emulator: {}", e))?;
    
    Ok(format!("Android emulator {} launched", emulator_id))
}

#[command]
pub async fn launch_ios_simulator(simulator_id: String) -> Result<String, String> {
    Command::new("xcrun")
        .args(&["simctl", "boot", &simulator_id])
        .output()
        .map_err(|e| format!("Failed to boot iOS simulator: {}", e))?;
        
    Command::new("open")
        .args(&["-a", "Simulator"])
        .output()
        .map_err(|e| format!("Failed to open Simulator app: {}", e))?;
    
    Ok(format!("iOS simulator {} launched", simulator_id))
}

#[command]
pub async fn close_virtual_device(device_id: String, device_type: String) -> Result<String, String> {
    match device_type.as_str() {
        "android_emulator" => {
            Command::new("adb")
                .args(&["-s", &format!("emulator-{}", device_id), "emu", "kill"])
                .output()
                .map_err(|e| format!("Failed to close Android emulator: {}", e))?;
            
            Ok(format!("Android emulator {} closed", device_id))
        }
        "iphone" => {
            Command::new("xcrun")
                .args(&["simctl", "shutdown", &device_id])
                .output()
                .map_err(|e| format!("Failed to shutdown iOS simulator: {}", e))?;
            
            Ok(format!("iOS simulator {} shutdown", device_id))
        }
        _ => Err(format!("Unsupported device type: {}", device_type)),
    }
}
