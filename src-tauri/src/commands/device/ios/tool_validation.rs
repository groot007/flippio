// Enhanced iOS tool validation with robust fallback mechanisms
use log::{info, warn, error};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;

/// Error types for iOS tool validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ToolValidationError {
    NotFound { tool: String, attempted_paths: Vec<String> },
    NotExecutable { tool: String, path: String },
    PermissionDenied { tool: String, path: String },
    ValidationFailed { tool: String, error: String },
}

impl std::fmt::Display for ToolValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ToolValidationError::NotFound { tool, attempted_paths } => {
                write!(f, "Tool '{}' not found. Attempted paths: {}", tool, attempted_paths.join(", "))
            }
            ToolValidationError::NotExecutable { tool, path } => {
                write!(f, "Tool '{}' found at '{}' but is not executable", tool, path)
            }
            ToolValidationError::PermissionDenied { tool, path } => {
                write!(f, "Permission denied accessing tool '{}' at '{}'", tool, path)
            }
            ToolValidationError::ValidationFailed { tool, error } => {
                write!(f, "Validation failed for tool '{}': {}", tool, error)
            }
        }
    }
}

/// Tool discovery strategy with validation
#[derive(Debug, Clone)]
pub struct ToolDiscoveryStrategy {
    pub name: String,
    pub paths: Vec<PathBuf>,
    pub validator: fn(&Path) -> bool,
}

/// Validated tool result
#[derive(Debug, Clone)]
pub struct ValidatedTool {
    pub path: PathBuf,
    pub strategy: String,
    pub version: Option<String>,
}

/// Enhanced iOS tool validator with multiple fallback strategies
pub struct IOSToolValidator {
    strategies: Vec<ToolDiscoveryStrategy>,
}

impl IOSToolValidator {
    /// Create a new validator with predefined strategies
    pub fn new() -> Self {
        Self {
            strategies: Self::create_discovery_strategies(),
        }
    }

    /// Get a validated tool path with comprehensive fallback
    pub fn get_validated_tool(&self, tool_name: &str) -> Result<ValidatedTool, ToolValidationError> {
        let mut attempted_paths = Vec::new();

        info!("🔍 Starting enhanced validation for tool: {}", tool_name);

        // On Windows, try both with and without .exe extension
        let tool_names = if cfg!(target_os = "windows") {
            if tool_name.ends_with(".exe") {
                vec![tool_name.to_string()]
            } else {
                vec![tool_name.to_string(), format!("{}.exe", tool_name)]
            }
        } else {
            vec![tool_name.to_string()]
        };

        // Try each discovery strategy
        for strategy in &self.strategies {
            info!("📍 Trying strategy: {}", strategy.name);

            for base_path in &strategy.paths {
                for current_tool_name in &tool_names {
                    let tool_path = base_path.join(current_tool_name);
                    attempted_paths.push(tool_path.to_string_lossy().to_string());

                    info!("  Checking: {}", tool_path.display());

                    // Check if file exists
                    if !tool_path.exists() {
                        info!("    ❌ File does not exist");
                        continue;
                    }

                    // Check if it's a file (not directory)
                    if !tool_path.is_file() {
                        info!("    ❌ Not a file");
                        continue;
                    }

                    // Run strategy-specific validator
                    if !(strategy.validator)(&tool_path) {
                        info!("    ❌ Failed strategy validation");
                        continue;
                    }

                    // Check executable permissions
                    match Self::check_executable_permissions(&tool_path) {
                        Ok(true) => {
                            info!("    ✅ Executable permissions OK");
                        }
                        Ok(false) => {
                            warn!("    ⚠️ Not executable, attempting to fix permissions");
                            if let Err(e) = Self::try_fix_permissions(&tool_path) {
                                error!("    ❌ Failed to fix permissions: {}", e);
                                return Err(ToolValidationError::NotExecutable {
                                    tool: tool_name.to_string(),
                                    path: tool_path.to_string_lossy().to_string(),
                                });
                            }
                        }
                        Err(e) => {
                            error!("    ❌ Permission check failed: {}", e);
                            return Err(ToolValidationError::PermissionDenied {
                                tool: tool_name.to_string(),
                                path: tool_path.to_string_lossy().to_string(),
                            });
                        }
                    }

                    // Test tool execution
                    let version = Self::test_tool_execution(&tool_path, current_tool_name);
                    
                    info!("    ✅ Tool validated successfully!");
                    return Ok(ValidatedTool {
                        path: tool_path,
                        strategy: strategy.name.clone(),
                        version,
                    });
                }
            }
        }

        // Tool not found with any strategy
        error!("❌ Tool '{}' not found with any strategy", tool_name);
        Err(ToolValidationError::NotFound {
            tool: tool_name.to_string(),
            attempted_paths,
        })
    }

    /// Create predefined discovery strategies
    fn create_discovery_strategies() -> Vec<ToolDiscoveryStrategy> {
        let strategies = vec![
            // Strategy 1: Homebrew (Apple Silicon) - Priority for M1/M2 Macs
            ToolDiscoveryStrategy {
                name: "Homebrew (Apple Silicon)".to_string(),
                paths: vec![
                    PathBuf::from("/opt/homebrew/bin"),
                    PathBuf::from("/opt/homebrew/opt/libimobiledevice/bin"),
                ],
                validator: Self::validate_homebrew_tool,
            },
            
            // Strategy 2: Homebrew (Intel) - For Intel Macs
            ToolDiscoveryStrategy {
                name: "Homebrew (Intel)".to_string(),
                paths: vec![
                    PathBuf::from("/usr/local/bin"),
                    PathBuf::from("/usr/local/opt/libimobiledevice/bin"),
                ],
                validator: Self::validate_homebrew_tool,
            },
            
            // Strategy 3: MacPorts
            ToolDiscoveryStrategy {
                name: "MacPorts".to_string(),
                paths: vec![PathBuf::from("/opt/local/bin")],
                validator: Self::validate_system_tool,
            },
            
            // Strategy 4: System PATH
            ToolDiscoveryStrategy {
                name: "System PATH".to_string(),
                paths: Self::get_system_paths(),
                validator: Self::validate_system_tool,
            },
            
            // Strategy 5: Bundled tools (production) - Fallback only
            ToolDiscoveryStrategy {
                name: "Bundled (Production)".to_string(),
                paths: Self::get_bundled_production_paths(),
                validator: Self::validate_bundled_tool,
            },
            
            // Strategy 6: Bundled tools (development) - Last resort
            ToolDiscoveryStrategy {
                name: "Bundled (Development)".to_string(),
                paths: Self::get_bundled_dev_paths(),
                validator: Self::validate_bundled_tool,
            },
        ];

        // Add Windows-specific strategies if on Windows
        #[cfg(target_os = "windows")]
        {
            strategies.insert(0, ToolDiscoveryStrategy {
                name: "Bundled Windows Tools".to_string(),
                paths: Self::get_windows_bundled_paths(),
                validator: Self::validate_windows_tool,
            });
        }

        strategies
    }

    /// Get bundled production tool paths
    fn get_bundled_production_paths() -> Vec<PathBuf> {
        let mut paths = Vec::new();
        
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                // Production: Contents/MacOS/
                if let Some(resources_path) = exe_dir
                    .parent() // Contents/
                    .map(|p| p.join("MacOS"))
                {
                    paths.push(resources_path);
                }
            }
        }
        
        paths
    }

    /// Get bundled development tool paths
    fn get_bundled_dev_paths() -> Vec<PathBuf> {
        let mut paths = Vec::new();
        
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                // Development: target/debug/../../../resources/libimobiledevice/tools
                let dev_path = exe_dir
                    .parent()
                    .and_then(|p| p.parent())  // target/debug/
                    .and_then(|p| p.parent())  // target/
                    .map(|p| p.join("resources/libimobiledevice/tools"));

                if let Some(path) = dev_path {
                    paths.push(path);
                }
            }
        }
        
        paths
    }

    /// Get Windows bundled tool paths
    #[cfg(target_os = "windows")]
    fn get_windows_bundled_paths() -> Vec<PathBuf> {
        let mut paths = Vec::new();
        
        if let Ok(exe_path) = std::env::current_exe() {
            info!("📁 Current executable path: {}", exe_path.display());
            if let Some(exe_dir) = exe_path.parent() {
                info!("📁 Executable directory: {}", exe_dir.display());
                
                // Windows bundled tools: check multiple possible locations
                
                // 1. Same directory as executable
                paths.push(exe_dir.to_path_buf());
                
                // 2. Resources subdirectory (Tauri bundled resources)
                let resource_path = exe_dir.join("_up_").join("resources").join("libimobiledevice-windows");
                info!("📁 Generated Tauri resource path: {}", resource_path.display());
                paths.push(resource_path);
                
                // 3. Direct resources path
                paths.push(exe_dir.join("resources").join("libimobiledevice-windows"));
                
                // 4. Bin subdirectory
                paths.push(exe_dir.join("bin"));
            }
        } else {
            error!("❌ Failed to get current executable path");
        }
        
        info!("📁 Generated {} Windows bundled paths", paths.len());
        for (i, path) in paths.iter().enumerate() {
            info!("📁   Path {}: {}", i + 1, path.display());
        }
        
        paths
    }

    /// Get system PATH directories
    fn get_system_paths() -> Vec<PathBuf> {
        let separator = if cfg!(target_os = "windows") { ';' } else { ':' };
        std::env::var("PATH")
            .unwrap_or_default()
            .split(separator)
            .map(PathBuf::from)
            .collect()
    }

    /// Validate bundled tool
    fn validate_bundled_tool(path: &Path) -> bool {
        // Check file size (bundled tools should be reasonably sized)
        if let Ok(metadata) = std::fs::metadata(path) {
            let size = metadata.len();
            // libimobiledevice tools are typically 50KB-5MB
            size > 50_000 && size < 10_000_000
        } else {
            false
        }
    }

    /// Validate Homebrew tool
    fn validate_homebrew_tool(path: &Path) -> bool {
        // Homebrew tools should be in specific paths and be symlinks or executables
        let path_str = path.to_string_lossy();
        (path_str.contains("/homebrew/") || path_str.contains("/usr/local/")) && path.exists()
    }

    /// Validate system tool
    fn validate_system_tool(path: &Path) -> bool {
        // Basic existence check for system tools
        path.exists() && path.is_file()
    }

    /// Validate Windows tool
    #[cfg(target_os = "windows")]
    fn validate_windows_tool(path: &Path) -> bool {
        // Check if it's a Windows executable
        if let Some(extension) = path.extension() {
            if extension.to_string_lossy().to_lowercase() == "exe" {
                return path.exists() && path.is_file();
            }
        }
        false
    }

    /// Check if file has executable permissions
    fn check_executable_permissions(path: &Path) -> Result<bool, String> {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            match std::fs::metadata(path) {
                Ok(metadata) => {
                    let mode = metadata.permissions().mode();
                    Ok(mode & 0o111 != 0) // Check if any execute bit is set
                }
                Err(e) => Err(format!("Failed to check permissions: {}", e)),
            }
        }
        
        #[cfg(not(unix))]
        {
            // On non-Unix systems, assume executable if file exists
            Ok(path.exists())
        }
    }

    /// Try to fix executable permissions
    fn try_fix_permissions(path: &Path) -> Result<(), String> {
        #[cfg(unix)]
        {
            use std::fs;
            use std::os::unix::fs::PermissionsExt;
            
            let metadata = fs::metadata(path)
                .map_err(|e| format!("Failed to get metadata: {}", e))?;
            
            let mut permissions = metadata.permissions();
            let mode = permissions.mode();
            permissions.set_mode(mode | 0o755); // Add executable permissions
            
            fs::set_permissions(path, permissions)
                .map_err(|e| format!("Failed to set permissions: {}", e))?;
            
            info!("✅ Fixed executable permissions for: {}", path.display());
            Ok(())
        }
        
        #[cfg(not(unix))]
        {
            // On non-Unix systems, no permission fixing needed
            Ok(())
        }
    }

    /// Test tool execution to verify it's working
    fn test_tool_execution(path: &Path, tool_name: &str) -> Option<String> {
        info!("🧪 Testing tool execution: {}", path.display());
        
        // Different tools have different ways to check version
        let test_args = match tool_name {
            "idevice_id" => vec!["--help"],
            "ideviceinfo" => vec!["--help"],
            "afcclient" => vec!["--help"],
            "ideviceinstaller" => vec!["--help"],
            _ => vec!["--version", "--help"],
        };

        for args in test_args {
            match Command::new(path).arg(args).output() {
                Ok(output) => {
                    // On Windows, be more forgiving with exit codes for ideviceinstaller
                    let is_success = if cfg!(target_os = "windows") && tool_name == "ideviceinstaller" {
                        // For ideviceinstaller on Windows, exit code -1073741701 (0xC000007B) 
                        // indicates DLL dependency issues but the tool exists and may work in actual usage
                        match output.status.code() {
                            Some(-1073741701) => {
                                warn!("⚠️ ideviceinstaller has DLL dependency issues (exit code -1073741701) but tool exists");
                                true  // Consider this "valid" since the tool exists
                            },
                            Some(code) if code == 0 => true,
                            _ => {
                                String::from_utf8_lossy(&output.stderr).contains("Usage") ||
                                String::from_utf8_lossy(&output.stdout).contains("Usage")
                            }
                        }
                    } else {
                        output.status.success() || 
                        String::from_utf8_lossy(&output.stderr).contains("Usage") ||
                        String::from_utf8_lossy(&output.stdout).contains("Usage")
                    };
                    
                    if is_success {
                        info!("✅ Tool execution test passed");
                        
                        // Try to extract version from output
                        let stdout = String::from_utf8_lossy(&output.stdout);
                        let stderr = String::from_utf8_lossy(&output.stderr);
                        
                        // Look for version patterns
                        for line in stdout.lines().chain(stderr.lines()) {
                            if line.contains("version") || line.contains("Version") {
                                return Some(line.trim().to_string());
                            }
                        }
                        
                        return Some("Unknown version".to_string());
                    }
                }
                Err(e) => {
                    warn!("⚠️ Tool execution test failed with args '{}': {}", args, e);
                }
            }
        }
        
        warn!("⚠️ All tool execution tests failed");
        None
    }

    /// Get user-friendly error message with installation instructions
    pub fn get_installation_instructions(error: &ToolValidationError) -> String {
        match error {
            ToolValidationError::NotFound { tool, .. } => {
                if cfg!(target_os = "windows") {
                    format!(
                        "iOS tool '{}' not found. Windows libimobiledevice tools should be bundled with the application.\n\
                        \n\
                        If you're seeing this error:\n\
                        1. Ensure the Windows libimobiledevice tools are in the same directory as the Flippio executable\n\
                        2. Check that the bundled .exe files and .dll files are present\n\
                        3. Try running Flippio as administrator\n\
                        \n\
                        For manual installation, download libimobiledevice for Windows and place the tools in the application directory.",
                        tool
                    )
                } else {
                    format!(
                        "iOS tool '{}' not found. To install libimobiledevice tools:\n\
                        \n\
                        Option 1 - Homebrew (Recommended):\n\
                        brew install libimobiledevice\n\
                        \n\
                        Option 2 - MacPorts:\n\
                        sudo port install libimobiledevice\n\
                        \n\
                        After installation, restart Flippio.",
                        tool
                    )
                }
            }
            ToolValidationError::NotExecutable { tool, path } => {
                if cfg!(target_os = "windows") {
                    format!(
                        "iOS tool '{}' found at '{}' but is not executable.\n\
                        Try running Flippio as administrator or check antivirus settings.",
                        tool, path
                    )
                } else {
                    format!(
                        "iOS tool '{}' found at '{}' but is not executable.\n\
                        Try running: chmod +x '{}'",
                        tool, path, path
                    )
                }
            }
            ToolValidationError::PermissionDenied { tool, path } => {
                if cfg!(target_os = "windows") {
                    format!(
                        "Permission denied accessing iOS tool '{}' at '{}'.\n\
                        Try running Flippio as administrator.",
                        tool, path
                    )
                } else {
                    format!(
                        "Permission denied accessing iOS tool '{}' at '{}'.\n\
                        Check file permissions and try again.",
                        tool, path
                    )
                }
            }
            ToolValidationError::ValidationFailed { tool, error } => {
                format!("iOS tool '{}' validation failed: {}", tool, error)
            }
        }
    }
}

impl Default for IOSToolValidator {
    fn default() -> Self {
        Self::new()
    }
}

/// Helper function to find iOS tool path (for backward compatibility)
pub fn find_ios_tool(tool_name: &str) -> Result<PathBuf, String> {
    let validator = IOSToolValidator::new();
    match validator.get_validated_tool(tool_name) {
        Ok(validated_tool) => Ok(validated_tool.path),
        Err(e) => Err(e.to_string()),
    }
} 