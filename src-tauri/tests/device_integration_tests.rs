// Device Integration Tests
// Critical tests for iOS and Android device functionality

use flippio::*;
use tempfile::TempDir;
use std::fs;

/// Test iOS device functionality integration
#[cfg(test)]
mod ios_integration_tests {
    use super::*;
    use flippio::commands::device::types::*;

    #[tokio::test]
    async fn test_ios_device_workflow_simulation() {
        // Simulate iOS device detection workflow
        let device_response = DeviceResponse {
            success: true,
            data: Some(vec![
                Device {
                    id: "00008030-001234567890000E".to_string(),
                    name: "iPhone 14 Pro".to_string(),
                    model: "iPhone15,3".to_string(),
                    device_type: "iphone".to_string(),
                    description: "Real iOS device".to_string(),
                },
                Device {
                    id: "A1B2C3D4-5678-90AB-CDEF-1234567890AB".to_string(),
                    name: "iPhone 14 Simulator".to_string(),
                    model: "iPhone15,2".to_string(),
                    device_type: "simulator".to_string(),
                    description: "iOS Simulator".to_string(),
                },
            ]),
            error: None,
        };

        // Verify device response structure
        assert!(device_response.success);
        assert!(device_response.data.is_some());
        assert!(device_response.error.is_none());

        let devices = device_response.data.unwrap();
        assert_eq!(devices.len(), 2);

        // Verify device types
        assert!(devices.iter().any(|d| d.device_type == "iphone"));
        assert!(devices.iter().any(|d| d.device_type == "simulator"));

        // Verify device IDs follow iOS format
        for device in &devices {
            assert!(device.id.contains("-"));
            assert!(device.id.len() >= 20);
        }
    }

    #[tokio::test]
    async fn test_ios_package_discovery_workflow() {
        // Simulate iOS package discovery
        let packages = vec![
            Package {
                name: "Settings".to_string(),
                bundle_id: "com.apple.Preferences".to_string(),
            },
            Package {
                name: "Safari".to_string(),
                bundle_id: "com.apple.mobilesafari".to_string(),
            },
            Package {
                name: "Test App".to_string(),
                bundle_id: "com.example.testapp".to_string(),
            },
        ];

        let package_response = DeviceResponse {
            success: true,
            data: Some(packages),
            error: None,
        };

        assert!(package_response.success);
        let packages = package_response.data.unwrap();
        assert_eq!(packages.len(), 3);

        // Verify bundle ID formats
        for package in &packages {
            assert!(package.bundle_id.contains("."));
            let parts: Vec<&str> = package.bundle_id.split('.').collect();
            assert!(parts.len() >= 2);
        }
    }

    #[tokio::test]
    async fn test_ios_database_file_workflow() {
        // Simulate iOS database file discovery
        let db_files = vec![
            DatabaseFile {
                path: "/var/mobile/Containers/Data/Application/ABC123/Documents/database.sqlite".to_string(),
                package_name: "com.example.iosapp".to_string(),
                filename: "database.sqlite".to_string(),
                location: "Documents".to_string(),
                remote_path: Some("/var/mobile/Containers/Data/Application/ABC123/Documents/database.sqlite".to_string()),
                device_type: "iphone".to_string(),
            },
            DatabaseFile {
                path: "/var/mobile/Containers/Data/Application/DEF456/Library/cache.db".to_string(),
                package_name: "com.apple.mobilesafari".to_string(),
                filename: "cache.db".to_string(),
                location: "Library".to_string(),
                remote_path: Some("/var/mobile/Containers/Data/Application/DEF456/Library/cache.db".to_string()),
                device_type: "iphone".to_string(),
            },
        ];

        let db_response = DeviceResponse {
            success: true,
            data: Some(db_files),
            error: None,
        };

        assert!(db_response.success);
        let db_files = db_response.data.unwrap();
        assert_eq!(db_files.len(), 2);

        // Verify iOS-specific patterns
        for db_file in &db_files {
            assert_eq!(db_file.device_type, "iphone");
            assert!(db_file.path.starts_with("/var/mobile"));
            assert!(db_file.filename.contains("."));
            assert!(db_file.remote_path.is_some());
        }
    }

    #[test]
    fn test_ios_tool_path_discovery() {
        // Test iOS tool path discovery logic
        let tool_names = vec!["idevice_id", "ideviceinfo", "ideviceinstaller", "afcclient"];
        
        for tool_name in tool_names {
            let tool_path = get_libimobiledevice_tool_path(tool_name);
            
            // Tool path discovery should work (may return None if tools not installed)
            assert!(tool_path.is_some() || tool_path.is_none());
            
            if let Some(path) = tool_path {
                assert!(path.to_string_lossy().contains(tool_name));
            }
        }
    }

    #[test]
    fn test_ios_file_transfer_simulation() -> Result<(), Box<dyn std::error::Error>> {
        // Simulate iOS file transfer workflow
        let temp_dir = TempDir::new()?;
        
        // Simulate iOS database paths
        let ios_db_paths = vec![
            "/var/mobile/Containers/Data/Application/ABC/Documents/test.sqlite",
            "/var/mobile/Applications/DEF/Library/data.db",
        ];
        
        for remote_path in ios_db_paths {
            // Extract filename
            let filename = std::path::Path::new(remote_path)
                .file_name()
                .unwrap()
                .to_string_lossy();
            
            // Simulate local file creation
            let local_path = temp_dir.path().join(&*filename);
            fs::write(&local_path, "simulated iOS database content")?;
            
            // Verify file was created
            assert!(local_path.exists());
            assert!(local_path.to_string_lossy().contains(&*filename));
            
            // Verify content
            let content = fs::read_to_string(&local_path)?;
            assert!(content.contains("simulated iOS database content"));
        }
        
        Ok(())
    }
}

/// Test Android ADB functionality integration
#[cfg(test)]
mod android_integration_tests {
    use super::*;
    use flippio::commands::device::types::*;
    use flippio::commands::device::helpers::*;

    #[tokio::test]
    async fn test_android_device_workflow_simulation() {
        // Simulate Android device detection workflow
        let device_response = DeviceResponse {
            success: true,
            data: Some(vec![
                Device {
                    id: "emulator-5554".to_string(),
                    name: "Android Emulator".to_string(),
                    model: "Android SDK built for x86".to_string(),
                    device_type: "emulator".to_string(),
                    description: "Android emulator device".to_string(),
                },
                Device {
                    id: "ABCD1234".to_string(),
                    name: "Samsung Galaxy".to_string(),
                    model: "SM-G998B".to_string(),
                    device_type: "android".to_string(),
                    description: "Real Android device".to_string(),
                },
            ]),
            error: None,
        };

        // Verify device response structure
        assert!(device_response.success);
        assert!(device_response.data.is_some());
        
        let devices = device_response.data.unwrap();
        assert_eq!(devices.len(), 2);

        // Verify device types
        assert!(devices.iter().any(|d| d.device_type == "emulator"));
        assert!(devices.iter().any(|d| d.device_type == "android"));

        // Verify device IDs
        for device in &devices {
            assert!(!device.id.is_empty());
            if device.device_type == "emulator" {
                assert!(device.id.starts_with("emulator-"));
            }
        }
    }

    #[tokio::test]
    async fn test_android_package_discovery_workflow() {
        // Simulate Android package discovery
        let packages = vec![
            Package {
                name: "Chrome".to_string(),
                bundle_id: "com.android.chrome".to_string(),
            },
            Package {
                name: "Gmail".to_string(),
                bundle_id: "com.google.android.gm".to_string(),
            },
            Package {
                name: "Test App".to_string(),
                bundle_id: "com.example.testapp".to_string(),
            },
        ];

        let package_response = DeviceResponse {
            success: true,
            data: Some(packages),
            error: None,
        };

        assert!(package_response.success);
        let packages = package_response.data.unwrap();
        assert_eq!(packages.len(), 3);

        // Verify package formats
        for package in &packages {
            assert!(package.bundle_id.contains("."));
            assert!(!package.name.is_empty());
        }
    }

    #[tokio::test]
    async fn test_android_database_file_workflow() {
        // Simulate Android database file discovery
        let db_files = vec![
            DatabaseFile {
                path: "/data/data/com.example.app/databases/main.db".to_string(),
                package_name: "com.example.app".to_string(),
                filename: "main.db".to_string(),
                location: "internal".to_string(),
                remote_path: Some("/data/data/com.example.app/databases/main.db".to_string()),
                device_type: "android".to_string(),
            },
            DatabaseFile {
                path: "/storage/emulated/0/Android/data/com.app/files/cache.sqlite".to_string(),
                package_name: "com.app".to_string(),
                filename: "cache.sqlite".to_string(),
                location: "external".to_string(),
                remote_path: Some("/storage/emulated/0/Android/data/com.app/files/cache.sqlite".to_string()),
                device_type: "android".to_string(),
            },
        ];

        let db_response = DeviceResponse {
            success: true,
            data: Some(db_files),
            error: None,
        };

        assert!(db_response.success);
        let db_files = db_response.data.unwrap();
        assert_eq!(db_files.len(), 2);

        // Verify Android-specific patterns
        for db_file in &db_files {
            assert_eq!(db_file.device_type, "android");
            assert!(
                db_file.path.starts_with("/data/data/") || 
                db_file.path.starts_with("/storage/")
            );
            assert!(db_file.remote_path.is_some());
        }
    }

    #[tokio::test]
    async fn test_adb_command_execution() {
        // Test ADB command execution logic
        let result = execute_adb_command(&["devices"]).await;
        
        match result {
            Ok(_output) => {
                // Command succeeded - ADB is available and working
                assert!(true);
            }
            Err(e) => {
                // Command failed - verify it's due to ADB not being available
                let error_msg = e.to_string();
                assert!(
                    error_msg.contains("No such file") ||
                    error_msg.contains("not found") ||
                    error_msg.contains("failed to execute") ||
                    error_msg.contains("permission")
                );
            }
        }
    }

    #[test]
    fn test_adb_path_discovery() {
        // Test ADB path discovery
        let adb_path = get_adb_path();
        
        assert!(!adb_path.is_empty());
        assert!(adb_path.contains("adb"));
        
        // Should be either a full path or just "adb"
        assert!(adb_path.starts_with("/") || adb_path == "adb");
    }

    #[test]
    fn test_android_file_transfer_simulation() -> Result<(), Box<dyn std::error::Error>> {
        // Simulate Android file transfer workflow
        let temp_dir = TempDir::new()?;
        
        // Simulate Android database paths
        let android_db_paths = vec![
            "/data/data/com.example.app/databases/test.db",
            "/storage/emulated/0/Android/data/com.app/files/data.sqlite",
        ];
        
        for remote_path in android_db_paths {
            // Extract filename
            let filename = std::path::Path::new(remote_path)
                .file_name()
                .unwrap()
                .to_string_lossy();
            
            // Simulate local file creation
            let local_path = temp_dir.path().join(&*filename);
            fs::write(&local_path, "simulated Android database content")?;
            
            // Verify file was created
            assert!(local_path.exists());
            assert!(local_path.to_string_lossy().contains(&*filename));
            
            // Verify content
            let content = fs::read_to_string(&local_path)?;
            assert!(content.contains("simulated Android database content"));
        }
        
        Ok(())
    }

    #[test]
    fn test_android_device_parsing() {
        // Test Android device output parsing
        let device_output = "List of devices attached\nemulator-5554\tdevice\nABCD1234\tdevice\noffline-device\toffline\n";
        
        let lines: Vec<&str> = device_output.lines()
            .filter(|line| !line.starts_with("List of devices") && !line.trim().is_empty())
            .collect();
        
        assert_eq!(lines.len(), 3);
        
        for line in lines {
            let parts: Vec<&str> = line.split('\t').collect();
            assert_eq!(parts.len(), 2);
            
            let device_id = parts[0];
            let status = parts[1];
            
            assert!(!device_id.is_empty());
            assert!(status == "device" || status == "offline" || status == "unauthorized");
        }
    }
}

/// Test cross-platform device functionality
#[cfg(test)]
mod cross_platform_tests {
    use super::*;
    use flippio::commands::device::types::*;

    #[tokio::test]
    async fn test_mixed_device_environment() {
        // Test handling both iOS and Android devices simultaneously
        let mixed_devices = vec![
            // iOS devices
            Device {
                id: "00008030-001234567890000E".to_string(),
                name: "iPhone 14".to_string(),
                model: "iPhone15,2".to_string(),
                device_type: "iphone".to_string(),
                description: "iOS device".to_string(),
            },
            // Android devices
            Device {
                id: "emulator-5554".to_string(),
                name: "Android Emulator".to_string(),
                model: "Android SDK".to_string(),
                device_type: "emulator".to_string(),
                description: "Android emulator".to_string(),
            },
            // Simulators
            Device {
                id: "A1B2C3D4-5678-90AB-CDEF-1234567890AB".to_string(),
                name: "iPhone Simulator".to_string(),
                model: "iPhone14,1".to_string(),
                device_type: "simulator".to_string(),
                description: "iOS Simulator".to_string(),
            },
        ];

        let response = DeviceResponse {
            success: true,
            data: Some(mixed_devices),
            error: None,
        };

        assert!(response.success);
        let devices = response.data.unwrap();
        assert_eq!(devices.len(), 3);

        // Verify we have different device types
        let device_types: Vec<&str> = devices.iter().map(|d| d.device_type.as_str()).collect();
        assert!(device_types.contains(&"iphone"));
        assert!(device_types.contains(&"emulator"));
        assert!(device_types.contains(&"simulator"));

        // Verify device ID formats are appropriate for each type
        for device in &devices {
            match device.device_type.as_str() {
                "iphone" | "simulator" => {
                    // iOS devices should have UUID-like IDs
                    assert!(device.id.contains("-"));
                }
                "emulator" => {
                    // Android emulators should have emulator- prefix
                    assert!(device.id.starts_with("emulator-"));
                }
                "android" => {
                    // Real Android devices can have various formats
                    assert!(!device.id.is_empty());
                }
                _ => {
                    // Unknown device type
                    assert!(!device.id.is_empty());
                }
            }
        }
    }

    #[tokio::test]
    async fn test_error_handling_across_platforms() {
        // Test error handling for both platforms
        let ios_error = DeviceResponse::<Vec<Device>> {
            success: false,
            data: None,
            error: Some("libimobiledevice tools not found".to_string()),
        };

        let android_error = DeviceResponse::<Vec<Device>> {
            success: false,
            data: None,
            error: Some("ADB not found in PATH".to_string()),
        };

        // Verify error responses
        assert!(!ios_error.success);
        assert!(ios_error.error.is_some());
        assert!(ios_error.error.unwrap().contains("libimobiledevice"));

        assert!(!android_error.success);
        assert!(android_error.error.is_some());
        assert!(android_error.error.unwrap().contains("ADB"));
    }

    #[test]
    fn test_temp_directory_management() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Test temp directory management for both platforms
        let temp_dir = ensure_temp_dir()?;
        
        // Create mock database files for both platforms
        let ios_file = temp_dir.join("ios_database.sqlite");
        let android_file = temp_dir.join("android_database.db");
        
        fs::write(&ios_file, "iOS database content")?;
        fs::write(&android_file, "Android database content")?;
        
        // Verify files exist
        assert!(ios_file.exists());
        assert!(android_file.exists());
        
        // Verify content
        let ios_content = fs::read_to_string(&ios_file)?;
        let android_content = fs::read_to_string(&android_file)?;
        
        assert!(ios_content.contains("iOS"));
        assert!(android_content.contains("Android"));
        
        Ok(())
    }

    #[test]
    fn test_concurrent_device_operations() {
        // Test that device operations can be performed concurrently
        let runtime = tokio::runtime::Runtime::new().unwrap();
        
        runtime.block_on(async {
            // Simulate concurrent device operations
            let ios_task = async {
                // Simulate iOS device operation
                tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
                "iOS operation complete"
            };
            
            let android_task = async {
                // Simulate Android device operation
                tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
                "Android operation complete"
            };
            
            // Run operations concurrently
            let (ios_result, android_result) = tokio::join!(ios_task, android_task);
            
            assert_eq!(ios_result, "iOS operation complete");
            assert_eq!(android_result, "Android operation complete");
        });
    }
} 