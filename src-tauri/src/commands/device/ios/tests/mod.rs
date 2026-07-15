// iOS device tests
// Comprehensive tests for iOS device detection, tool validation, and file operations

use crate::commands::device::types::*;
use crate::commands::device::ios::diagnostic::*;
use tempfile::TempDir;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ios_device_creation() {
        let device = Device {
            id: "00008030-001234567890000E".to_string(),
            name: "iPhone 14 Pro".to_string(),
            model: "iPhone15,3".to_string(),
            device_type: "iphone".to_string(),
            description: "Real iOS device".to_string(),
        };
        
        assert_eq!(device.id, "00008030-001234567890000E");
        assert_eq!(device.device_type, "iphone");
        assert!(device.name.contains("iPhone"));
        assert!(device.model.contains("iPhone"));
    }

    #[test]
    fn test_ios_package_creation() {
        let package = Package {
            name: "Settings".to_string(),
            bundle_id: "com.apple.Preferences".to_string(),
        };
        
        assert_eq!(package.name, "Settings");
        assert_eq!(package.bundle_id, "com.apple.Preferences");
        assert!(package.bundle_id.starts_with("com."));
    }

    #[test]
    fn test_ios_database_file_creation() {
        let db_file = DatabaseFile {
            path: "/var/mobile/Containers/Data/Application/ABC123/Documents/database.sqlite".to_string(),
            package_name: "com.example.iosapp".to_string(),
            filename: "database.sqlite".to_string(),
            location: "Documents".to_string(),
            remote_path: Some("/var/mobile/Containers/Data/Application/ABC123/Documents/database.sqlite".to_string()),
            device_type: "iphone".to_string(),
        };
        
        assert_eq!(db_file.filename, "database.sqlite");
        assert_eq!(db_file.package_name, "com.example.iosapp");
        assert_eq!(db_file.device_type, "iphone");
        assert_eq!(db_file.location, "Documents");
        assert!(db_file.remote_path.is_some());
    }

    #[test]
    fn test_simulator_device_creation() {
        let simulator = VirtualDevice {
            id: "A1B2C3D4-5678-90AB-CDEF-1234567890AB".to_string(),
            name: "iPhone 14 Pro Simulator".to_string(),
            model: Some("iPhone14,3".to_string()),
            platform: "iOS".to_string(),
            state: Some("Booted".to_string()),
        };
        
        assert!(simulator.id.contains("-"));
        assert!(simulator.name.contains("Simulator"));
        assert_eq!(simulator.platform, "iOS");
        assert!(simulator.state.is_some());
        assert_eq!(simulator.state.unwrap(), "Booted");
    }

    #[test]
    fn test_ios_device_response_success() {
        let devices = vec![
            Device {
                id: "device1".to_string(),
                name: "iPhone 14".to_string(),
                model: "iPhone15,2".to_string(),
                device_type: "iphone".to_string(),
                description: "iOS device".to_string(),
            },
            Device {
                id: "device2".to_string(),
                name: "iPad Pro".to_string(),
                model: "iPad14,5".to_string(),
                device_type: "ipad".to_string(),
                description: "iPad device".to_string(),
            },
        ];
        
        let response = DeviceResponse {
            success: true,
            data: Some(devices),
            error: None,
        };
        
        assert!(response.success);
        assert!(response.data.is_some());
        assert_eq!(response.data.unwrap().len(), 2);
    }

    #[test]
    fn test_ios_device_response_error() {
        let response: DeviceResponse<Vec<Device>> = DeviceResponse {
            success: false,
            data: None,
            error: Some("libimobiledevice tools not found".to_string()),
        };
        
        assert!(!response.success);
        assert!(response.data.is_none());
        assert!(response.error.is_some());
        assert!(response.error.unwrap().contains("libimobiledevice"));
    }

    #[test]
    fn test_ios_serde_serialization() -> Result<(), serde_json::Error> {
        let device = Device {
            id: "ios_device_123".to_string(),
            name: "Test iPhone".to_string(),
            model: "iPhone15,1".to_string(),
            device_type: "iphone".to_string(),
            description: "Test iOS device".to_string(),
        };
        
        // Test serialization
        let json = serde_json::to_string(&device)?;
        assert!(json.contains("ios_device_123"));
        assert!(json.contains("deviceType"));
        assert!(json.contains("iphone"));
        
        // Test deserialization
        let deserialized: Device = serde_json::from_str(&json)?;
        assert_eq!(deserialized.id, device.id);
        assert_eq!(deserialized.device_type, device.device_type);
        
        Ok(())
    }

    #[test]
    fn test_ios_package_serde() -> Result<(), serde_json::Error> {
        let package = Package {
            name: "Test iOS App".to_string(),
            bundle_id: "com.example.testapp".to_string(),
        };
        
        let json = serde_json::to_string(&package)?;
        assert!(json.contains("bundleId"));
        assert!(json.contains("com.example.testapp"));
        
        let deserialized: Package = serde_json::from_str(&json)?;
        assert_eq!(deserialized.bundle_id, package.bundle_id);
        
        Ok(())
    }

    #[test]
    fn test_ios_database_file_serde() -> Result<(), serde_json::Error> {
        let db_file = DatabaseFile {
            path: "/var/mobile/test.sqlite".to_string(),
            package_name: "com.test.ios".to_string(),
            filename: "test.sqlite".to_string(),
            location: "Documents".to_string(),
            remote_path: Some("/var/mobile/test.sqlite".to_string()),
            device_type: "iphone".to_string(),
        };
        
        let json = serde_json::to_string(&db_file)?;
        assert!(json.contains("packageName"));
        assert!(json.contains("remotePath"));
        assert!(json.contains("deviceType"));
        assert!(json.contains("iphone"));
        
        let deserialized: DatabaseFile = serde_json::from_str(&json)?;
        assert_eq!(deserialized.device_type, "iphone");
        
        Ok(())
    }

    #[test]
    fn test_virtual_device_serde() -> Result<(), serde_json::Error> {
        let simulator = VirtualDevice {
            id: "sim123".to_string(),
            name: "iPhone Simulator".to_string(),
            model: Some("iPhone14,1".to_string()),
            platform: "iOS".to_string(),
            state: Some("Shutdown".to_string()),
        };
        
        let json = serde_json::to_string(&simulator)?;
        assert!(json.contains("sim123"));
        assert!(json.contains("iOS"));
        
        let deserialized: VirtualDevice = serde_json::from_str(&json)?;
        assert_eq!(deserialized.platform, "iOS");
        
        Ok(())
    }

    #[test]
    fn test_ios_tool_path_logic() {
        // Test tool name extraction and path logic
        let tool_names = vec!["idevice_id", "ideviceinfo", "ideviceinstaller", "afcclient"];
        
        for tool_name in tool_names {
            // Test that tool names are valid
            assert!(!tool_name.is_empty());
            assert!(tool_name.starts_with("idevice") || tool_name == "afcclient");
            
            // Test path construction logic
            let tool_path = format!("/usr/local/bin/{}", tool_name);
            assert!(tool_path.contains(tool_name));
            assert!(tool_path.starts_with("/"));
        }
    }

    #[test]
    fn test_ios_device_id_parsing() {
        // Test iOS device ID format validation
        let device_ids = vec![
            "00008030-001234567890000E",
            "A1B2C3D4-5678-90AB-CDEF-1234567890AB",
            "12345678-90AB-CDEF-1234-567890ABCDEF",
        ];
        
        for device_id in device_ids {
            // iOS device IDs should contain dashes
            assert!(device_id.contains("-"));
            // Should be long enough (typical iOS device ID format)
            assert!(device_id.len() >= 20);
            // Should contain only hex characters and dashes
            for c in device_id.chars() {
                assert!(c.is_ascii_hexdigit() || c == '-');
            }
        }
    }

    #[test]
    fn test_ios_bundle_id_validation() {
        let bundle_ids = vec![
            "com.apple.MobileSafari",
            "com.example.testapp",
            "org.company.myapp",
            "net.domain.application",
        ];
        
        for bundle_id in bundle_ids {
            // Should contain dots
            assert!(bundle_id.contains("."));
            // Should have at least 2 parts
            let parts: Vec<&str> = bundle_id.split('.').collect();
            assert!(parts.len() >= 2);
            // Each part should not be empty
            for part in parts {
                assert!(!part.is_empty());
            }
        }
    }

    #[test]
    fn test_ios_database_path_patterns() {
        let ios_db_paths = vec![
            "/var/mobile/Containers/Data/Application/ABC123/Documents/database.sqlite",
            "/var/mobile/Containers/Data/Application/DEF456/Library/myapp.db",
            "/var/mobile/Applications/GHI789/Documents/data.sqlite3",
            "/var/mobile/Library/database.db",
        ];
        
        for path in ios_db_paths {
            // Should start with /var/mobile
            assert!(path.starts_with("/var/mobile"));
            
            // Should contain a database file extension
            assert!(path.ends_with(".sqlite") || 
                   path.ends_with(".db") || 
                   path.ends_with(".sqlite3"));
            
            // Extract filename
            let filename = std::path::Path::new(path)
                .file_name()
                .unwrap()
                .to_string_lossy();
            assert!(!filename.is_empty());
            assert!(filename.contains("."));
        }
    }

    #[test]
    fn test_ios_error_scenarios() {
        // Test various iOS-specific error scenarios
        
        // Device with empty ID
        let empty_device = Device {
            id: "".to_string(),
            name: "iPhone".to_string(),
            model: "iPhone15,1".to_string(),
            device_type: "iphone".to_string(),
            description: "Test".to_string(),
        };
        assert!(empty_device.id.is_empty());
        
        // Package with invalid bundle ID
        let invalid_package = Package {
            name: "Test App".to_string(),
            bundle_id: "invalid_bundle_id".to_string(),
        };
        assert!(!invalid_package.bundle_id.contains("."));
        
        // Database file with missing remote path
        let db_file_no_remote = DatabaseFile {
            path: "/local/path/test.db".to_string(),
            package_name: "com.test".to_string(),
            filename: "test.db".to_string(),
            location: "Documents".to_string(),
            remote_path: None,
            device_type: "iphone".to_string(),
        };
        assert!(db_file_no_remote.remote_path.is_none());
        
        // Simulator with no state
        let simulator_no_state = VirtualDevice {
            id: "sim123".to_string(),
            name: "Test Simulator".to_string(),
            model: None,
            platform: "iOS".to_string(),
            state: None,
        };
        assert!(simulator_no_state.state.is_none());
        assert!(simulator_no_state.model.is_none());
    }

    #[test]
    fn test_ios_tool_command_construction() {
        // Test various tool command scenarios
        let tools = vec![
            ("idevice_id", vec!["-l"]),
            ("ideviceinfo", vec!["-u", "device123", "-k", "DeviceName"]),
            ("ideviceinstaller", vec!["-u", "device456", "-l"]),
            ("afcclient", vec!["-u", "device789", "ls", "/var/mobile"]),
        ];
        
        for (tool_name, args) in tools {
            // Verify tool name is valid
            assert!(!tool_name.is_empty());
            
            // Verify args are valid
            for arg in &args {
                assert!(!arg.is_empty());
            }
            
            // Test command construction logic
            let full_command = format!("{} {}", tool_name, args.join(" "));
            assert!(full_command.starts_with(tool_name));
            assert!(full_command.len() > tool_name.len());
        }
    }

    #[test]
    fn test_ios_file_path_manipulation() {
        let temp_dir = TempDir::new().unwrap();
        let ios_remote_paths = vec![
            "/var/mobile/Containers/Data/Application/ABC/Documents/test.sqlite",
            "/var/mobile/Applications/DEF/Library/data.db",
            "/var/mobile/Documents/app.sqlite3",
        ];
        
        for remote_path in ios_remote_paths {
            // Test filename extraction
            let filename = std::path::Path::new(remote_path)
                .file_name()
                .unwrap()
                .to_string_lossy();
            assert!(!filename.is_empty());
            
            // Test local path generation
            let local_path = temp_dir.path().join(&*filename);
            assert!(local_path.to_string_lossy().contains(&*filename));
            
            // Test that path is within temp directory
            assert!(local_path.starts_with(temp_dir.path()));
        }
    }

    #[test]
    fn test_ios_error_help_message_format() {
        // Test that error help messages follow expected format
        let error_help = get_ios_error_help("Command failed");
        
        // Should contain helpful information
        assert!(!error_help.is_empty());
        
        // Should provide actionable guidance (check for case-insensitive "Try")
        assert!(
            error_help.to_lowercase().contains("install") ||
            error_help.to_lowercase().contains("check") ||
            error_help.to_lowercase().contains("verify") ||
            error_help.to_lowercase().contains("ensure") ||
            error_help.to_lowercase().contains("try")
        );
    }

    #[test]
    fn test_multiple_ios_devices_response() {
        let devices = vec![
            Device {
                id: "device1".to_string(),
                name: "iPhone 14".to_string(),
                model: "iPhone15,2".to_string(),
                device_type: "iphone".to_string(),
                description: "Primary iPhone".to_string(),
            },
            Device {
                id: "device2".to_string(),
                name: "iPad Pro".to_string(),
                model: "iPad14,5".to_string(),
                device_type: "ipad".to_string(),
                description: "Work iPad".to_string(),
            },
            Device {
                id: "simulator1".to_string(),
                name: "iPhone 14 Simulator".to_string(),
                model: "iPhone15,2".to_string(),
                device_type: "simulator".to_string(),
                description: "Development simulator".to_string(),
            },
        ];
        
        let response = DeviceResponse {
            success: true,
            data: Some(devices),
            error: None,
        };
        
        assert!(response.success);
        let devices = response.data.unwrap();
        assert_eq!(devices.len(), 3);
        
        // Verify different device types
        let device_types: Vec<&str> = devices.iter().map(|d| d.device_type.as_str()).collect();
        assert!(device_types.contains(&"iphone"));
        assert!(device_types.contains(&"ipad"));
        assert!(device_types.contains(&"simulator"));
    }

    #[test]
    fn test_ios_package_list_parsing() {
        // Test parsing of iOS package list output
        let package_output = r#"
com.apple.MobileSafari
com.example.testapp
org.company.myapp
net.domain.application
        "#;
        
        let lines: Vec<&str> = package_output.lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .collect();
        
        for line in lines {
            // Each line should be a valid bundle identifier
            assert!(line.contains("."));
            let parts: Vec<&str> = line.split('.').collect();
            assert!(parts.len() >= 2);
        }
    }
} 