# Build & Deployment Guide

## Overview

This guide covers building, packaging, and deploying Flippio across different platforms. It includes development builds, production releases, code signing, and distribution strategies.

## Build Types

### Development Builds

#### Quick Development Build
```bash
npm run tauri:dev              # Development with hot reload
npm run tauri:build:debug      # Debug build with symbols
```

#### Debug Features
- **Debug Symbols**: Full debugging information included
- **Faster Compilation**: Optimized for build speed
- **Development Tools**: Additional logging and debugging tools
- **Hot Reload**: Automatic recompilation on code changes

### Production Builds

#### Standard Production Build
```bash
npm run tauri:build            # Release build
npm run tauri:build:signed     # Signed release (macOS)
```

#### Production Optimizations
- **Size Optimization**: Minimized bundle size
- **Performance**: Full compiler optimizations
- **Security**: Code obfuscation and protection
- **Asset Optimization**: Compressed resources

---

## Platform-Specific Building

### macOS

#### Requirements
- **Xcode** 14.x or later
- **Developer Certificate**: For code signing
- **Notarization**: For distribution outside App Store

#### Build Process
```bash
# Development build
npm run tauri:dev

# Production build
npm run tauri:build

# Signed production build
npm run tauri:build:signed

# Post-build signing (if needed)
npm run tauri:post-sign
```

#### Bundle Structure
```
Flippio.app/
├── Contents/
│   ├── Info.plist
│   ├── MacOS/
│   │   └── Flippio           # Main executable
│   ├── Resources/
│   │   ├── icons/
│   │   └── dist/             # Frontend assets
│   ├── Frameworks/           # Embedded libraries
│   │   ├── libimobiledevice-1.0.6.dylib
│   │   ├── libssl.3.dylib
│   │   └── ...
│   └── MacOS/               # External binaries
│       ├── idevice_id
│       ├── ideviceinstaller
│       └── afcclient
```

#### Code Signing Configuration
```json
// tauri.conf.json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)",
      "frameworks": [
        "macos-deps/libcrypto.3.dylib",
        "macos-deps/libssl.3.dylib",
        // ... other frameworks
      ]
    }
  }
}
```

### Windows

#### Requirements
- **Visual Studio** 2019+ with C++ tools
- **Windows SDK**
- **Code Signing Certificate** (optional)

#### Build Process
```bash
# Development
npm run tauri:dev

# Production
npm run tauri:build

# With signing
npm run tauri:build -- --config "bundle.windows.certificateThumbprint=THUMBPRINT"
```

#### Bundle Outputs
- **MSI Installer**: `target/release/bundle/msi/Flippio_0.3.16_x64_en-US.msi`
- **NSIS Installer**: `target/release/bundle/nsis/Flippio_0.3.16_x64-setup.exe`
- **Portable**: `target/release/bundle/nsis/Flippio_0.3.16_x64_portable.exe`

### Linux

#### Requirements
- **Build essentials**: `build-essential` package
- **System dependencies**: Various libraries

#### Build Process
```bash
# Install dependencies (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev

# Build
npm run tauri:build
```

#### Bundle Outputs
- **AppImage**: `target/release/bundle/appimage/flippio_0.3.16_amd64.AppImage`
- **DEB Package**: `target/release/bundle/deb/flippio_0.3.16_amd64.deb`

---

## Auto-Updater Configuration

### Overview
Flippio uses Tauri's built-in auto-updater with GitHub Releases as the update server.

### Configuration

#### Tauri Configuration (`tauri.conf.json`)
```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/groot007/flippio/releases/latest/download/latest.json"
      ],
      "dialog": false,
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEY3QjdGRTMxQkI4MDdCQzkKUldUSmU0QzdNZjYzOTdYVEFTVEt5K0FGZXlxOEI3N1kzNVhoK2lkeHhPMjFOQUtXcVE1b3lVVFkK"
    }
  }
}
```

### Key Management

#### Generating Update Keys
```bash
# Generate new keypair
./scripts/generate-updater-keys.sh

# This creates:
# - tauri-update-key.sec (private key - keep secret)
# - tauri-update-key.pub (public key - embed in app)
```

#### Using Keys

##### Public Key (in app)
```json
// tauri.conf.json
{
  "plugins": {
    "updater": {
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    }
  }
}
```

##### Private Key (for signing)
```bash
# Set as environment variable or GitHub secret
export TAURI_PRIVATE_KEY="$(cat tauri-update-key.sec)"
```

### Update Process

#### 1. Version Update
```bash
# Update version in all files
npm run version:update -- 0.3.17

# This updates:
# - package.json
# - src/renderer/package.json
# - src-tauri/Cargo.toml
# - src-tauri/tauri.conf.json
```

#### 2. Build Release
```bash
# Build all platforms (if CI/CD)
npm run tauri:build

# Or platform-specific
npm run tauri:build -- --target universal-apple-darwin  # macOS Universal
npm run tauri:build -- --target x86_64-pc-windows-msvc  # Windows x64
npm run tauri:build -- --target x86_64-unknown-linux-gnu # Linux x64
```

#### 3. Generate Update Artifacts
```bash
# Sign and generate update metadata
cargo tauri build --ci

# This creates:
# - Signed binaries
# - latest.json (update manifest)
# - Platform-specific installers
```

---

## CI/CD Pipeline

### GitHub Actions

#### Build Workflow (`.github/workflows/build.yml`)
```yaml
name: Build and Release

on:
  push:
    tags: ['v*']
  workflow_dispatch:

jobs:
  build:
    strategy:
      matrix:
        platform: [macos-latest, ubuntu-20.04, windows-latest]
    
    runs-on: ${{ matrix.platform }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18
          
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        
      - name: Install dependencies (Ubuntu)
        if: matrix.platform == 'ubuntu-20.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.0-dev libayatana-appindicator3-dev librsvg2-dev
          
      - name: Install frontend dependencies
        run: npm install
        
      - name: Build
        env:
          TAURI_PRIVATE_KEY: ${{ secrets.TAURI_PRIVATE_KEY }}
        run: npm run tauri:build
        
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.platform }}-bundle
          path: src-tauri/target/release/bundle/
```

#### Release Workflow
```yaml
name: Release

on:
  workflow_run:
    workflows: ["Build and Release"]
    types: [completed]

jobs:
  release:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    
    steps:
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            **/*.dmg
            **/*.msi
            **/*.AppImage
            **/*.deb
            **/latest.json
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Required Secrets

#### GitHub Repository Secrets
```bash
# Tauri updater private key
TAURI_PRIVATE_KEY="YOUR_PRIVATE_KEY_CONTENT"

# macOS code signing (if applicable)
APPLE_CERTIFICATE="BASE64_ENCODED_P12"
APPLE_CERTIFICATE_PASSWORD="P12_PASSWORD"
APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"

# Windows code signing (if applicable)
WINDOWS_CERTIFICATE="BASE64_ENCODED_PFX"
WINDOWS_CERTIFICATE_PASSWORD="PFX_PASSWORD"
```

---

## Distribution

### Release Channels

#### Stable Releases
- **Location**: GitHub Releases
- **Frequency**: Major versions and critical fixes
- **Audience**: End users
- **Auto-Updates**: Enabled

#### Beta Releases
- **Location**: GitHub Pre-releases
- **Frequency**: Feature previews
- **Audience**: Early adopters and testers
- **Auto-Updates**: Optional

### Download Options

#### Direct Downloads
- **macOS**: `.dmg` disk image
- **Windows**: `.msi` installer or `.exe` setup
- **Linux**: `.AppImage` portable or `.deb` package

#### Package Managers (Future)
- **macOS**: Homebrew Cask
- **Windows**: Winget, Chocolatey
- **Linux**: Snap, Flatpak

### Installation Instructions

#### macOS
```bash
# Download and install
curl -L -o Flippio.dmg https://github.com/groot007/flippio/releases/latest/download/Flippio.dmg
open Flippio.dmg

# Or via Homebrew (when available)
brew install --cask flippio
```

#### Windows
```bash
# Download and install
curl -L -o FlippioSetup.msi https://github.com/groot007/flippio/releases/latest/download/Flippio_x64_en-US.msi
msiexec /i FlippioSetup.msi

# Or via Winget (when available)
winget install flippio
```

#### Linux
```bash
# AppImage (portable)
curl -L -o Flippio.AppImage https://github.com/groot007/flippio/releases/latest/download/flippio_amd64.AppImage
chmod +x Flippio.AppImage
./Flippio.AppImage

# DEB package
curl -L -o flippio.deb https://github.com/groot007/flippio/releases/latest/download/flippio_amd64.deb
sudo dpkg -i flippio.deb
```

---

## Security & Signing

### Code Signing

#### macOS
```bash
# Sign application bundle
codesign --force --deep --sign "Developer ID Application: Your Name" Flippio.app

# Verify signature
codesign --verify --deep --strict Flippio.app
codesign --display --verbose=2 Flippio.app
```

#### Windows
```bash
# Sign executable (using signtool)
signtool sign /f certificate.pfx /p password /tr http://timestamp.digicert.com /td sha256 /fd sha256 Flippio.exe
```

### Notarization (macOS)

#### Submit for Notarization
```bash
# Create DMG and submit
./scripts/notarize-dmg.js

# Check status
xcrun notarytool log --apple-id YOUR_APPLE_ID --password APP_PASSWORD SUBMISSION_ID
```

#### Staple Notarization
```bash
# Staple ticket to DMG
xcrun stapler staple Flippio.dmg

# Verify
xcrun stapler validate Flippio.dmg
```

---

## Build Optimization

### Bundle Size Optimization

#### Frontend Optimization
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@chakra-ui/react'],
          grid: ['ag-grid-react', 'ag-grid-community']
        }
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
})
```

#### Backend Optimization
```toml
# Cargo.toml
[profile.release]
opt-level = 3
lto = true
codegen-units = 1
panic = "abort"
strip = true
```

### Performance Optimization

#### Rust Compilation
```bash
# Use faster linker
export RUSTFLAGS="-C link-arg=-fuse-ld=lld"

# Parallel compilation
export CARGO_BUILD_JOBS=8

# Target-specific optimizations
cargo build --release --target x86_64-apple-darwin
```

#### Asset Optimization
```bash
# Optimize images
npx imagemin src/assets/images/* --out-dir=dist/assets/images

# Compress resources
gzip -k dist/assets/*.js
gzip -k dist/assets/*.css
```

---

## Troubleshooting

### Common Build Issues

#### 1. Code Signing Failures (macOS)
**Problem**: "code object is not signed at all"

**Solution**:
```bash
# Check certificate
security find-identity -v -p codesigning

# Clean and rebuild
cargo clean
npm run tauri:build:signed
```

#### 2. Missing Dependencies (Linux)
**Problem**: Library linking errors

**Solution**:
```bash
# Install missing dependencies
sudo apt-get install libwebkit2gtk-4.0-dev libgtk-3-dev libayatana-appindicator3-dev

# Check library versions
pkg-config --modversion gtk+-3.0
```

#### 3. Windows Build Failures
**Problem**: MSVC compiler errors

**Solution**:
```bash
# Install Visual Studio Build Tools
# https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022

# Clean build environment
cargo clean
Remove-Item -Recurse -Force target/
npm run tauri:build
```

#### 4. Auto-Updater Issues
**Problem**: Update verification failures

**Solution**:
```bash
# Verify key format
echo $TAURI_PRIVATE_KEY | base64 -d

# Check public key in config
grep -r "pubkey" src-tauri/tauri.conf.json

# Test signature
./scripts/test-signatures.sh
```

---

## Release Checklist

### Pre-Release
- [ ] Update version numbers (`npm run version:update`)
- [ ] Run all tests (`npm run test:all`)
- [ ] Update changelog/release notes
- [ ] Test builds on all platforms
- [ ] Verify auto-updater functionality

### Release Process
- [ ] Create git tag (`git tag v0.3.17`)
- [ ] Push tag (`git push origin v0.3.17`)
- [ ] Monitor CI/CD pipeline
- [ ] Verify artifacts in GitHub Releases
- [ ] Test download and installation

### Post-Release
- [ ] Update documentation if needed
- [ ] Announce release (if applicable)
- [ ] Monitor for issues
- [ ] Plan next release cycle

---

## Resources

### Documentation
- [Development Setup Guide](development-setup.md)
- [Auto-Updater Setup](auto-updater-setup.md)
- [CI Troubleshooting](ci-troubleshooting.md)

### External Resources
- [Tauri Build Guide](https://tauri.app/v1/guides/building/)
- [Apple Code Signing](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Windows Code Signing](https://docs.microsoft.com/en-us/windows/msix/package/sign-app-package-using-signtool)

---

*This guide is regularly updated with new platform requirements and best practices.* 