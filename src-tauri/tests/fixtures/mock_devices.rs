use serde::{Deserialize, Serialize};

// Mock device types for testing
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MockDevice {
    pub id: String,
    pub name: String,
    pub model: String,
    pub device_type: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MockPackage {
    pub name: String,
    pub bundle_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MockDatabaseFile {
    pub path: String,
    pub package_name: String,
    pub filename: String,
    pub location: String,
    pub remote_path: Option<String>,
    pub device_type: String,
}

// iOS specific mock data structures
#[derive(Debug, Clone)]
pub struct MockIOSDevice {
    pub udid: String,
    pub name: String,
}

#[derive(Debug, Clone)]
pub struct MockIOSApp {
    pub bundle_id: String,
    pub name: String,
    pub device_udid: String,
}

#[derive(Debug, Clone)]
pub struct MockIOSDatabase {
    pub path: String,
    pub app_bundle_id: String,
    pub device_udid: String,
}

// Android specific mock data structures
#[derive(Debug, Clone)]
pub struct MockAndroidDevice {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone)]
pub struct MockAndroidApp {
    pub package_name: String,
    pub name: String,
    pub device_id: String,
}

#[derive(Debug, Clone)]
pub struct MockAndroidDatabase {
    pub path: String,
    pub package_name: String,
    pub device_id: String,
}

/// Mock device data for testing
pub const MOCK_ANDROID_DEVICE: &str = r#"
RZCX12EQM7D	device	usb:336592896X	product:redfin model:Pixel_5 device:redfin transport_id:1
"#;

pub const MOCK_ANDROID_PACKAGES: &str = r#"
package:com.android.chrome
package:com.google.android.apps.photos
package:com.example.testapp
"#;

pub const MOCK_IOS_DEVICE_INFO: &str = r#"
DeviceName: iPhone Kolya
ProductType: iPhone14,5
ProductVersion: 17.1.1
SerialNumber: 00008101-001908100E32001E
"#;

pub const MOCK_IOS_SIMULATOR_LIST: &str = r#"
{
    "devices" : {
        "iOS 17.0" : [
            {
                "name" : "iPhone 14",
                "udid" : "E9E497ED-ED8E-4A33-B124-8F31C8E9FC34",
                "state" : "Shutdown",
                "deviceTypeIdentifier" : "com.apple.CoreSimulator.SimDeviceType.iPhone-14"
            }
        ]
    }
}
"#;

// Mock device creation functions
pub fn create_mock_ios_devices() -> Vec<MockIOSDevice> {
    vec![
        MockIOSDevice {
            udid: "test-udid-1".to_string(),
            name: "Test iPhone 1".to_string(),
        },
        MockIOSDevice {
            udid: "test-udid-2".to_string(),
            name: "Test iPhone 2".to_string(),
        },
    ]
}

pub fn create_mock_adb_devices() -> Vec<MockAndroidDevice> {
    vec![
        MockAndroidDevice {
            id: "device_id_1".to_string(),
            name: "Test Android 1".to_string(),
        },
        MockAndroidDevice {
            id: "device_id_2".to_string(),
            name: "Test Android 2".to_string(),
        },
    ]
}

pub fn create_mock_ios_apps() -> Vec<MockIOSApp> {
    vec![
        MockIOSApp {
            bundle_id: "com.example.app1".to_string(),
            name: "Test App 1".to_string(),
            device_udid: "test-udid-1".to_string(),
        },
        MockIOSApp {
            bundle_id: "com.example.app2".to_string(),
            name: "Test App 2".to_string(),
            device_udid: "test-udid-2".to_string(),
        },
    ]
}

pub fn create_mock_android_apps() -> Vec<MockAndroidApp> {
    vec![
        MockAndroidApp {
            package_name: "com.example.android1".to_string(),
            name: "Android App 1".to_string(),
            device_id: "device_id_1".to_string(),
        },
        MockAndroidApp {
            package_name: "com.example.android2".to_string(),
            name: "Android App 2".to_string(),
            device_id: "device_id_2".to_string(),
        },
    ]
}

pub fn create_mock_ios_databases() -> Vec<MockIOSDatabase> {
    vec![
        MockIOSDatabase {
            path: "/Documents/database.db".to_string(),
            app_bundle_id: "com.example.app1".to_string(),
            device_udid: "test-udid-1".to_string(),
        },
        MockIOSDatabase {
            path: "/Documents/data.sqlite".to_string(),
            app_bundle_id: "com.example.app2".to_string(),
            device_udid: "test-udid-2".to_string(),
        },
    ]
}

pub fn create_mock_android_databases() -> Vec<MockAndroidDatabase> {
    vec![
        MockAndroidDatabase {
            path: "/data/data/com.example.android1/databases/main.db".to_string(),
            package_name: "com.example.android1".to_string(),
            device_id: "device_id_1".to_string(),
        },
        MockAndroidDatabase {
            path: "/data/data/com.example.android2/databases/app.db".to_string(),
            package_name: "com.example.android2".to_string(),
            device_id: "device_id_2".to_string(),
        },
    ]
}
