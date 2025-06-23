use std::env;
use std::fs;
use std::path::{Path, PathBuf};

fn main() {
    // Always run the standard Tauri build
    tauri_build::build();
    
    println!("cargo:rerun-if-changed=../resources/libimobiledevice");
    
    // Only run during actual Tauri bundle builds
    if let Ok(bundle_app_dir) = env::var("TAURI_BUNDLE_APP_DIR") {
        let app_path = PathBuf::from(&bundle_app_dir);
        
        if app_path.exists() && app_path.extension().map_or(false, |ext| ext == "app") {
            println!("cargo:warning=Relocating libimobiledevice binaries for macOS bundle");
            
            match relocate_binaries(&app_path) {
                Ok(()) => println!("cargo:warning=Successfully relocated libimobiledevice binaries"),
                Err(e) => {
                    println!("cargo:warning=Failed to relocate binaries: {}", e);
                    // Don't fail the build, just warn
                }
            }
        }
    }
}

fn relocate_binaries(app_path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let contents_path = app_path.join("Contents");
    let frameworks_path = contents_path.join("Frameworks");
    let macos_path = contents_path.join("MacOS");
    
    // Create directories if they don't exist
    fs::create_dir_all(&frameworks_path)?;
    fs::create_dir_all(&macos_path)?;
    
    // Find the source directories relative to the project root
    let manifest_dir = env::var("CARGO_MANIFEST_DIR")?;
    let project_root = Path::new(&manifest_dir).parent().unwrap();
    let libs_source = project_root.join("resources/libimobiledevice/libs");
    let tools_source = project_root.join("resources/libimobiledevice/tools");
    
    // Define the libraries and tools to relocate
    let dylibs = [
        "libimobiledevice-1.0.6.dylib",
        "libimobiledevice-glue-1.0.0.dylib",
        "libplist-2.0.4.dylib",
        "libusbmuxd-2.0.7.dylib",
        "libzip.5.5.dylib",
        "libcrypto.3.dylib",
        "libssl.3.dylib",
        "liblzma.5.dylib",
        "libzstd.1.5.7.dylib",
    ];
    
    let tools = [
        "idevice_id",
        "ideviceinfo",
        "ideviceinstaller",
        "afcclient",
    ];
    
    // Copy dylibs to Contents/Frameworks/
    for dylib in &dylibs {
        let source = libs_source.join(dylib);
        let dest = frameworks_path.join(dylib);
        
        if source.exists() {
            copy_file(&source, &dest)?;
            println!("cargo:warning=Copied {} to Frameworks/", dylib);
        } else {
            println!("cargo:warning=Warning: {} not found at {}", dylib, source.display());
        }
    }
    
    // Copy CLI tools to Contents/MacOS/
    for tool in &tools {
        let source = tools_source.join(tool);
        let dest = macos_path.join(tool);
        
        if source.exists() {
            copy_file(&source, &dest)?;
            // Make sure the tool is executable
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = fs::metadata(&dest)?.permissions();
                perms.set_mode(0o755);
                fs::set_permissions(&dest, perms)?;
            }
            println!("cargo:warning=Copied {} to MacOS/", tool);
        } else {
            println!("cargo:warning=Warning: {} not found at {}", tool, source.display());
        }
    }
    
    // Clean up any existing resources that might have been placed by Tauri
    cleanup_resources(&contents_path)?;
    
    Ok(())
}

fn copy_file(source: &Path, dest: &Path) -> Result<(), Box<dyn std::error::Error>> {
    if dest.exists() {
        fs::remove_file(dest)?;
    }
    fs::copy(source, dest)?;
    Ok(())
}

fn cleanup_resources(contents_path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    // Remove any libimobiledevice files that might be in Resources
    let resources_path = contents_path.join("Resources");
    
    if !resources_path.exists() {
        return Ok(());
    }
    
    // Check for various possible paths where Tauri might have placed files
    let possible_paths = [
        resources_path.join("_up_/resources/libimobiledevice"),
        resources_path.join("resources/libimobiledevice"),
        resources_path.join("libimobiledevice"),
    ];
    
    for path in &possible_paths {
        if path.exists() {
            println!("cargo:warning=Cleaning up redundant files at {}", path.display());
            fs::remove_dir_all(path).unwrap_or_else(|e| {
                println!("cargo:warning=Failed to remove {}: {}", path.display(), e);
            });
        }
    }
    
    Ok(())
}
