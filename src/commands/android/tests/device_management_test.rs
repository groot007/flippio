//! Android Device Management Tests

use super::{MockAndroidDevice, MockAdbExecutor};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mock_android_device_creation() {
        let device = MockAndroidDevice::new("test_device_123", "Test Device");
        
        assert_eq!(device.id, "test_device_123");
        assert_eq!(device.name, "Test Device");
        assert_eq!(device.status, "device");
        assert!(!device.packages.is_empty());
    }

    #[test]
    fn test_mock_adb_executor() {
        let mut executor = MockAdbExecutor::new();
        
        // Test default responses
        assert!(executor.responses.contains_key("devices"));
        assert!(executor.responses.contains_key("packages"));
        
        // Test custom response
        executor.set_response("custom_command", "custom_response");
        assert_eq!(executor.responses.get("custom_command"), Some(&"custom_response".to_string()));
        
        // Test failure simulation
        assert!(!executor.should_fail);
        executor.simulate_failure();
        assert!(executor.should_fail);
    }

    #[tokio::test]
    async fn test_android_device_detection() {
        // This would test the actual device detection logic
        // For now, just verify the test setup works
        let device = MockAndroidDevice::new("emulator-5554", "Android Emulator");
        assert_eq!(device.id, "emulator-5554");
    }

    #[tokio::test] 
    async fn test_android_device_connection_status() {
        // Test device connection checking
        let device = MockAndroidDevice::new("test_device", "Test Device");
        assert_eq!(device.status, "device");
    }
} 