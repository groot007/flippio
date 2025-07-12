use super::types::*;
use super::helpers::*;
use tauri_plugin_shell::ShellExt;
use log::info;

#[tauri::command]
pub async fn get_android_emulators(app_handle: tauri::AppHandle) -> Result<DeviceResponse<Vec<VirtualDevice>>, String> {
    log::info!("Getting Android emulators");

    let emulator_path = find_android_emulator_path();
    let adb_path = get_adb_path();
    let shell = app_handle.shell();

    // Step 1: List all configured AVDs
    let avd_list_output = shell.command(&emulator_path)
        .args(["-list-avds"])
        .output()
        .await
        .map_err(|e| format!("Failed to list AVDs using '{}': {}", emulator_path, e))?;

    if !avd_list_output.status.success() {
        return Err("Failed to get list of Android Virtual Devices (AVDs).".into());
    }

    let all_avds: Vec<String> = String::from_utf8_lossy(&avd_list_output.stdout)
        .lines()
        .map(|line| line.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    // Step 2: List running emulator devices via `adb devices`
    let adb_devices_output = shell.command(&adb_path)
        .args(["devices"])
        .output()
        .await;

    let running_ports: Vec<String> = if let Ok(output) = adb_devices_output {
        if output.status.success() {
            String::from_utf8_lossy(&output.stdout)
                .lines()
                .skip(1)
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 2 && parts[0].starts_with("emulator-") && parts[1] == "device" {
                        Some(parts[0].to_string())
                    } else {
                        None
                    }
                })
                .collect()
        } else {
            Vec::new()
        }
    } else {
        Vec::new()
    };

    // Step 3: Map running emulator port to its AVD name
    let mut running_avds = std::collections::HashSet::new();
    for port in &running_ports {
        log::info!("Checking AVD name for running emulator port: {}", port);
        
        let avd_name_output = shell.command(&adb_path)
            .args(["-s", port, "emu", "avd", "name"])
            .output()
            .await;

        match avd_name_output {
            Ok(output) => {
                if output.status.success() {
                    let output_text = String::from_utf8_lossy(&output.stdout);
                    // Take the first line as the AVD name (ignore "OK" and other lines)
                    let name = output_text.lines().next().unwrap_or("").trim().to_string();
                    log::info!("Found running AVD: '{}' on port {}", name, port);
                    if !name.is_empty() && name != "OK" {
                        running_avds.insert(name);
                    }
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    log::warn!("Failed to get AVD name for port {}: {}", port, stderr);
                }
            }
            Err(e) => {
                log::warn!("Error executing AVD name command for port {}: {}", port, e);
            }
        }
    }
    
    log::info!("Running AVDs found: {:?}", running_avds);
    log::info!("All AVDs: {:?}", all_avds);

    // Step 4: Build device list with running/stopped status
    let emulators: Vec<VirtualDevice> = all_avds
        .into_iter()
        .map(|avd| VirtualDevice {
            id: avd.clone(),
            name: avd.clone(),
            platform: "android".to_string(),
            model: Some(avd.clone()),
            state: Some(if running_avds.contains(&avd) {
                "running".to_string()
            } else {
                "stopped".to_string()
            }),
        })
        .collect();

    Ok(DeviceResponse {
        success: true,
        data: Some(emulators),
        error: None,
    })
}

#[tauri::command]
pub async fn get_ios_simulators(app_handle: tauri::AppHandle) -> Result<DeviceResponse<Vec<VirtualDevice>>, String> {
    log::info!("Getting iOS simulators");
    
    let shell = app_handle.shell();
    let output = shell.command("xcrun")
        .args(["simctl", "list", "devices", "available", "--json"])
        .output()
        .await
        .map_err(|e| format!("Failed to execute simctl: {}", e))?;
    
    if output.status.success() {
        let simulators_output = String::from_utf8_lossy(&output.stdout);
        let mut simulators = Vec::new();
        
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&simulators_output) {
            if let Some(devices) = json.get("devices").and_then(|d| d.as_object()) {
                for (runtime, device_list) in devices {
                    if let Some(device_array) = device_list.as_array() {
                        for device in device_array {
                            if let (Some(name), Some(udid), Some(state)) = (
                                device.get("name").and_then(|n| n.as_str()),
                                device.get("udid").and_then(|u| u.as_str()),
                                device.get("state").and_then(|s| s.as_str()),
                            ) {
                                simulators.push(VirtualDevice {
                                    id: udid.to_string(),
                                    name: format!("{} ({})", name, runtime),
                                    model: Some(name.to_string()),
                                    platform: "ios".to_string(),
                                    state: Some(state.to_string()),
                                });
                            }
                        }
                    }
                }
            }
        }
        
        Ok(DeviceResponse {
            success: true,
            data: Some(simulators),
            error: None,
        })
    } else {
        Ok(DeviceResponse {
            success: true,
            data: Some(Vec::new()),
            error: None,
        })
    }
}

#[tauri::command]
pub async fn launch_android_emulator(app_handle: tauri::AppHandle, emulator_id: String) -> Result<DeviceResponse<String>, String> {
    log::info!("Launching Android emulator: {}", emulator_id);
    
    let emulator_path = find_android_emulator_path();
    let shell = app_handle.shell();
    
    // Launch emulator in background
    let command = shell.command(&emulator_path)
        .args(["-avd", &emulator_id]);
    
    match command.spawn() {
        Ok(_) => Ok(DeviceResponse {
            success: true,
            data: Some(format!("Emulator {} launched", emulator_id)),
            error: None,
        }),
        Err(e) => Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(format!("Failed to launch emulator: {}", e)),
        }),
    }
}

#[tauri::command]
pub async fn launch_ios_simulator(app_handle: tauri::AppHandle, simulator_id: String) -> Result<DeviceResponse<String>, String> {
    log::info!("Launching iOS simulator: {}", simulator_id);
    
    let shell = app_handle.shell();
    let output = shell.command("xcrun")
        .args(["simctl", "boot", &simulator_id])
        .output()
        .await;
    
    match output {
        Ok(result) => {
            if result.status.success() || String::from_utf8_lossy(&result.stderr).contains("already booted") {
                // Open Simulator app
                let _ = shell.command("open")
                    .args(["-a", "Simulator"])
                    .output()
                    .await;
                
                Ok(DeviceResponse {
                    success: true,
                    data: Some(format!("Simulator {} launched", simulator_id)),
                    error: None,
                })
            } else {
                let stderr = String::from_utf8_lossy(&result.stderr);
                Ok(DeviceResponse {
                    success: false,
                    data: None,
                    error: Some(format!("Failed to launch simulator: {}", stderr)),
                })
            }
        }
        Err(e) => Ok(DeviceResponse {
            success: false,
            data: None,
            error: Some(format!("Failed to execute simctl: {}", e)),
        }),
    }
}
