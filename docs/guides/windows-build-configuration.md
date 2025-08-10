# Windows Build Configuration

## Platform-Specific External Binaries

Due to Tauri v2 limitations with platform-specific `externalBin` configuration, you need to manually update `src-tauri/tauri.conf.json` when building for Windows.

### For Windows Builds

Update the `bundle.externalBin` and `bundle.resources` sections in `src-tauri/tauri.conf.json`:

```json
{
  "bundle": {
    "externalBin": [
      "../resources/libimobiledevice-windows/afcclient",
      "../resources/libimobiledevice-windows/idevice_id",
      "../resources/libimobiledevice-windows/ideviceinfo",
      "../resources/libimobiledevice-windows/ideviceinstaller",
      "../resources/libimobiledevice-windows/idevicebackup2",
      "../resources/libimobiledevice-windows/idevicepair",
      "../resources/libimobiledevice-windows/idevicesyslog",
      "../resources/libimobiledevice-windows/iproxy",
      "../resources/adb-platform-tools/adb",
      "../resources/adb-platform-tools/fastboot"
    ],
    "resources": [
      "../resources/libimobiledevice-windows/",
      "../resources/adb-platform-tools/"
    ]
  }
}
```

### For macOS Builds (Current Configuration)

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

## Tool Resolution Logic

The application now includes cross-platform tool resolution in `src-tauri/src/commands/device/helpers.rs`:

### iOS Tools (`get_libimobiledevice_tool_path`)
- **Windows**: Looks for `.exe` files in the same directory as the executable
- **macOS**: Looks in `Contents/MacOs/` for bundled tools
- **Development**: Falls back to appropriate `resources/` directories

### ADB Tools (`get_adb_tool_path`)
- **Windows**: Looks for `.exe` files in the same directory as the executable
- **macOS**: Looks in `Contents/Resources/adb-platform-tools/`
- **Development**: Falls back to `resources/adb-platform-tools/`

## Automatic Configuration (Future Enhancement)

Consider creating a build script that automatically switches the configuration based on the target platform:

```bash
#!/bin/bash
# scripts/configure-for-platform.sh

TARGET_PLATFORM=$1

if [ "$TARGET_PLATFORM" = "windows" ]; then
    echo "Configuring for Windows build..."
    # Update tauri.conf.json for Windows
elif [ "$TARGET_PLATFORM" = "macos" ]; then
    echo "Configuring for macOS build..."
    # Update tauri.conf.json for macOS
fi
```

## Testing

After updating the configuration:

1. Clean the build cache: `cargo clean`
2. Build for the target platform: `npm run tauri:build` or `npm run tauri:build:debug`
3. Test tool resolution by checking the application logs for bundled tool detection

The application will log which tools it finds and from which locations:
- `[libimobiledevice] Using bundled Windows '...' from exe directory`
- `[adb] Using bundled Windows '...' from exe directory`
