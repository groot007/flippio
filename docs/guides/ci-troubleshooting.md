# CI/CD Troubleshooting Guide

## Rollup Native Binary Issues

### Problem
Error: `Cannot find module @rollup/rollup-linux-x64-gnu`

This is a common issue with Rollup's optional dependencies in CI environments, particularly on Linux runners.

### Root Cause
- npm's handling of optional dependencies can be inconsistent
- Platform-specific native binaries may not install correctly
- Cache corruption in CI environments

### Solutions Applied

1. **Enhanced GitHub Actions Workflow**:
   - Added retry logic for npm installation
   - Explicit installation of missing native binaries
   - Comprehensive error diagnostics

2. **NPM Configuration**:
   - Created `.npmrc` with specific Rollup registry settings
   - Enabled optional dependencies explicitly

3. **Fallback Strategies**:
   - Multiple installation attempts with cleanup
   - Force reinstallation of specific packages
   - Environment diagnostics for debugging

### Local Development
If you encounter this issue locally:

```bash
# Clear everything and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

# If issue persists, manually install the native binary
npm install @rollup/rollup-linux-x64-gnu --save-optional
```

## Rust/Tauri System Dependencies Issues

### Problem
Error: `The system library 'glib-2.0' required by crate 'glib-sys' was not found`

Tauri applications require various GTK/GLib system libraries, even for running tests.

### Root Cause
- Missing system development libraries on CI runners
- pkg-config not finding the required .pc files
- Incomplete GTK/WebKit development packages

### Solutions Applied

1. **Comprehensive System Dependencies** (Updated for Ubuntu 24.04):
   ```bash
   # For Ubuntu 24.04 (Noble)
   sudo apt-get install -y \
     libgtk-3-dev \
     libwebkit2gtk-4.1-dev \
     libglib2.0-dev \
     libsoup-3.0-dev \
     pkg-config \
     # Fallback to older versions if needed:
     # libwebkit2gtk-4.0-dev \
     # libsoup2.4-dev
   ```

   **Important**: Package names vary by Ubuntu version:
   - **WebKit**: Ubuntu 24.04 uses `libwebkit2gtk-4.1-dev`, older versions use `libwebkit2gtk-4.0-dev`
   - **Soup**: Ubuntu 24.04 prefers `libsoup-3.0-dev`, fallback to `libsoup2.4-dev`
   - **GLib**: `libglib2.0-dev` includes gobject-2.0 and gio-2.0 automatically

2. **PKG_CONFIG_PATH Configuration**:
   - Explicit setting of PKG_CONFIG_PATH environment variable
   - Verification of library availability

3. **Fallback Test Strategies**:
   - Try with no-default-features if full tests fail
   - Comprehensive environment diagnostics

### Local Development
For Tauri development on Ubuntu/Debian:

```bash
sudo apt-get update

# For Ubuntu 24.04 (Noble):
sudo apt-get install -y \
  libgtk-3-dev \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  libglib2.0-dev \
  libsoup-3.0-dev \
  pkg-config

# For Ubuntu 22.04 and earlier:
sudo apt-get install -y \
  libgtk-3-dev \
  libwebkit2gtk-4.0-dev \
  libappindicator3-dev \
  librsvg2-dev \
  libglib2.0-dev \
  libsoup2.4-dev \
  pkg-config
```

**Note**: The CI workflow now automatically detects and tries different package versions for maximum compatibility.

### Alternative Solutions
- Use `npm ci --ignore-optional` followed by `npm install`
- Switch to yarn or pnpm package managers
- Use Docker containers with pre-built dependencies
