# Platform-Specific Tauri Configuration

## Problem
Tauri applications need different external binaries and resources for different platforms:
- **macOS**: Uses tools from `macos-deps/` directory 
- **Windows**: Uses tools from `../resources/libimobiledevice-windows/` and `../resources/adb-platform-tools/`

When building for Windows, Tauri automatically appends the target triple and `.exe` extension to external binary paths.

## Solution
We use separate Tauri configuration files for each platform:

### Configuration Files
- `tauri.conf.json` - Default configuration (macOS)
- `tauri.windows.conf.json` - Windows-specific configuration

### Platform-Specific Tools

#### macOS Configuration (`tauri.conf.json`)
```json
{
  "bundle": {
    "externalBin": [
      "macos-deps/afcclient",
      "macos-deps/idevice_id", 
      "macos-deps/ideviceinfo",
      "macos-deps/ideviceinstaller"
    ],
    "resources": []
  }
}
```

#### Windows Configuration (`tauri.windows.conf.json`)
```json
{
  "bundle": {
    "externalBin": [
      "../resources/libimobiledevice-windows/afcclient",
      "../resources/libimobiledevice-windows/idevice_id",
      "../resources/libimobiledevice-windows/ideviceinfo", 
      "../resources/libimobiledevice-windows/ideviceinstaller",
      "../resources/adb-platform-tools/adb"
    ],
    "resources": []
  }
}
```

> **Note**: The `resources` array is empty because Tauri's glob patterns (`**`) don't work reliably during Windows cross-compilation. The external binaries are sufficient for bundling the required tools.

### Target-Suffixed Binary Files
For Windows builds, the following target-suffixed copies exist:

#### iOS Tools (libimobiledevice-windows)
- `afcclient-x86_64-pc-windows-gnu.exe` (copy of `afcclient.exe`)
- `afcclient-x86_64-pc-windows-msvc.exe` (copy of `afcclient.exe`)
- `idevice_id-x86_64-pc-windows-gnu.exe` (copy of `idevice_id.exe`)
- `idevice_id-x86_64-pc-windows-msvc.exe` (copy of `idevice_id.exe`)
- `ideviceinfo-x86_64-pc-windows-gnu.exe` (copy of `ideviceinfo.exe`)
- `ideviceinfo-x86_64-pc-windows-msvc.exe` (copy of `ideviceinfo.exe`)
- `ideviceinstaller-x86_64-pc-windows-gnu.exe` (copy of `ideviceinstaller.exe`)
- `ideviceinstaller-x86_64-pc-windows-msvc.exe` (copy of `ideviceinstaller.exe`)

#### Android Tools (adb-platform-tools)
- `adb-x86_64-pc-windows-gnu.exe` (copy of `adb.exe`)
- `adb-x86_64-pc-windows-msvc.exe` (copy of `adb.exe`)

```yaml
- name: Configure platform-specific external binaries
  if: runner.os == 'Windows'
  run: |
    # Use Windows-specific configuration
    cp src-tauri/tauri.windows.conf.json src-tauri/tauri.conf.json
    echo "Using Windows-specific configuration"
```

## Local Development
Use the configuration switcher script:

```bash
# Switch to Windows configuration for testing
node scripts/switch-config.js windows

# Switch back to macOS configuration
node scripts/switch-config.js macos
```

## File Structure
```
resources/
├── libimobiledevice-windows/
│   ├── afcclient.exe (original)
│   ├── afcclient-x86_64-pc-windows-gnu.exe (for Tauri GNU)
│   ├── afcclient-x86_64-pc-windows-msvc.exe (for Tauri MSVC)
│   ├── idevice_id.exe (original)
│   ├── idevice_id-x86_64-pc-windows-gnu.exe (for Tauri GNU)
│   ├── idevice_id-x86_64-pc-windows-msvc.exe (for Tauri MSVC)
│   ├── ...other iOS tools
└── adb-platform-tools/
    ├── adb.exe (original)
    ├── adb-x86_64-pc-windows-gnu.exe (for Tauri GNU)
    └── adb-x86_64-pc-windows-msvc.exe (for Tauri MSVC)
```

## Notes
- The target-suffixed files must be committed to the repository
- Both GNU and MSVC target variants are supported
- GitHub Actions will handle the `tauri.conf.json` modification automatically
- macOS builds continue to use the `macos-deps/` directory as before
- This approach works for both local development and CI/CD builds
- The specific target triple used depends on the Rust toolchain and build configuration
