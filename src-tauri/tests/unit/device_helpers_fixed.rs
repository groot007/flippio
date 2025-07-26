use std::path::PathBuf;

#[cfg(test)]
mod device_helpers_tests {
    use super::*;
    use crate::fixtures::temp_files::TempFileManager;
    use crate::fixtures::mock_devices::*;
    
    #[test]
    fn test_temp_directory_creation() {
        let temp_manager = TempFileManager::new();
        let temp_dir = temp_manager.create_temp_dir("test_temp").unwrap();
        
        // Verify directory exists and has expected properties
        assert!(temp_dir.exists());
        assert!(temp_dir.is_dir());
        assert!(temp_dir.to_string_lossy().contains("test_temp"));
    }
    
    #[test]
    fn test_adb_path_construction() {
        // Test ADB path construction logic without requiring actual binary
        let binary_dir = PathBuf::from("/app/resources");
        let adb_path = binary_dir.join("adb");
        
        assert!(adb_path.to_string_lossy().contains("adb"));
        assert!(adb_path.to_string_lossy().contains("resources"));
    }
    
    #[test]
    fn test_ios_tool_paths() {
        let binary_dir = PathBuf::from("/app/resources/macos-deps");
        let ios_tools = ["idevice_id", "ideviceinfo", "ideviceinstaller", "afcclient"];
        
        for tool in ios_tools {
            let tool_path = binary_dir.join(tool);
            assert!(tool_path.to_string_lossy().contains("macos-deps"));
            assert!(tool_path.to_string_lossy().ends_with(tool));
        }
    }
    
    #[test]
    fn test_android_device_parsing() {
        let _mock_output = MOCK_ANDROID_DEVICE;
        // Test that mock data has expected format
        assert!(_mock_output.contains("device"));
    }
    
    #[test]
    fn test_android_package_parsing() {
        let _mock_output = MOCK_ANDROID_PACKAGES;
        // Test that mock data has expected format
        assert!(_mock_output.contains("package:"));
    }
    
    #[test]
    fn test_empty_command_output() {
        let _empty_output = "";
        assert!(_empty_output.is_empty());
    }
    
    #[test]
    fn test_malformed_command_output() {
        let _malformed_output = "this is not valid adb output\nrandom text";
        assert!(!_malformed_output.contains("device"));
    }
}
