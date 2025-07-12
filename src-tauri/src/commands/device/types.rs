use serde::{Deserialize, Serialize};

// Metadata for pulled database files
#[derive(Debug, Serialize, Deserialize)]
pub struct DatabaseFileMetadata {
    pub device_id: String,
    pub package_name: String,
    pub remote_path: String,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeviceResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Device {
    pub id: String,
    pub name: String,
    pub model: String,
    #[serde(rename = "deviceType")]
    pub device_type: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Package {
    pub name: String,
    #[serde(rename = "bundleId")]
    pub bundle_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DatabaseFile {
    pub path: String,
    #[serde(rename = "packageName")]
    pub package_name: String,
    pub filename: String,
    pub location: String,
    #[serde(rename = "remotePath")]
    pub remote_path: Option<String>,
    #[serde(rename = "deviceType")]
    pub device_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VirtualDevice {
    pub id: String,
    pub name: String,
    pub model: Option<String>,
    pub platform: String,
    pub state: Option<String>,
}
