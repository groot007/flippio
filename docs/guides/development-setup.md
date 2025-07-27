# Development Setup Guide

## Overview

This guide provides step-by-step instructions for setting up a development environment for Flippio, a cross-platform desktop application for viewing and editing SQLite databases on mobile devices.

## Prerequisites

### System Requirements
- **Node.js** 18.x or later
- **Rust** 1.70 or later
- **Tauri CLI** 2.0
- **Git** for version control

### Platform-Specific Requirements

#### macOS (Required for iOS development)
- **Xcode** 14.x or later
- **Command Line Tools**: `xcode-select --install`
- **Homebrew**: For package management

#### Windows (Android development)
- **Visual Studio** 2019 or later (with C++ tools)
- **Windows SDK** (latest version)

#### Linux (Android development)
- **Build essentials**: `sudo apt-get install build-essential`
- **Additional dependencies**: May vary by distribution

### Mobile Development Tools

#### iOS Development (macOS only)
- **libimobiledevice tools** (via Homebrew)
- **Xcode Simulator** access

#### Android Development (All platforms)
- **Android SDK** with platform tools
- **ADB** (Android Debug Bridge)
- **Android Emulator** (optional)

---

## Installation Steps

### 1. Clone Repository

```bash
git clone https://github.com/groot007/flippio.git
cd flippio
```

### 2. Install Rust and Tauri

#### Install Rust
```bash
# Install Rust via rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Verify installation
rustc --version
cargo --version
```

#### Install Tauri CLI
```bash
cargo install tauri-cli --version "^2.0.0"

# Verify installation
cargo tauri --version
```

### 3. Install Node.js Dependencies

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd src/renderer
npm install
cd ../..
```

### 4. Setup iOS Tools (macOS only)

#### Install libimobiledevice via Homebrew
```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install iOS development tools
brew install libimobiledevice ideviceinstaller

# Verify installation
idevice_id --help
ideviceinstaller --help
afcclient --help
```

#### Verify iOS Tools
```bash
# Test device detection (with iOS device connected)
idevice_id -l

# Test device info (replace DEVICE_ID with actual device ID)
ideviceinfo -u DEVICE_ID
```

### 5. Setup Android Tools

#### Install Android SDK
```bash
# Option 1: Via Android Studio (recommended)
# Download and install Android Studio
# Follow setup wizard to install SDK

# Option 2: Command line tools only
# Download command line tools from developer.android.com
# Extract and add to PATH
```

#### Configure Environment Variables
```bash
# Add to ~/.bashrc, ~/.zshrc, or equivalent
export ANDROID_HOME=/path/to/android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools

# Reload shell configuration
source ~/.bashrc  # or ~/.zshrc
```

#### Verify Android Setup
```bash
# Test ADB
adb version

# List connected devices
adb devices

# Test emulator (if installed)
emulator -list-avds
```

---

## Development Workflow

### Available Scripts

#### Frontend Development
```bash
npm run dev:renderer           # Start frontend dev server (Vite)
npm run build:renderer         # Build frontend for production
npm run typecheck:web          # TypeScript type checking
```

#### Backend Development
```bash
cargo check                    # Check Rust code compilation
cargo build                    # Build Rust backend
cargo test                     # Run Rust tests
```

#### Full Application Development
```bash
npm run tauri:dev              # Start full development environment
npm run tauri:build            # Build complete application
npm run tauri:build:debug      # Build with debug symbols
```

#### Code Quality
```bash
npm run lint                   # Run ESLint
npm run lint:fix               # Fix ESLint issues automatically
npm run format                 # Format code with Prettier
```

#### Testing
```bash
npm run test                   # Run frontend tests (Vitest)
npm run test:coverage          # Run tests with coverage
npm run test:rust              # Run Rust tests
npm run test:all               # Run all tests
```

### Development Environment Setup

#### 1. Start Development Server
```bash
# Terminal 1: Start the development environment
npm run tauri:dev

# This will:
# - Start Vite dev server for frontend (port 5173)
# - Compile and run Tauri backend
# - Open application window with hot reload
```

#### 2. Development Best Practices

##### Code Organization
- Keep frontend logic in `src/renderer/src/`
- Keep backend logic in `src-tauri/src/`
- Use TypeScript for all frontend code
- Follow Rust conventions for backend code

##### State Management
- Use Zustand for frontend state management
- Keep stores focused and specific
- Use React Query for server state

##### Component Development
- Use Chakra UI components consistently
- Create reusable components in `src/renderer/src/components/common/`
- Follow React best practices (hooks, functional components)

---

## Troubleshooting

### Common Issues

#### 1. iOS Tools Not Found
**Problem**: `idevice_id: command not found`

**Solution**:
```bash
# Reinstall libimobiledevice
brew uninstall libimobiledevice
brew install libimobiledevice

# Check PATH
echo $PATH | grep homebrew
```

#### 2. ADB Not Found
**Problem**: `adb: command not found`

**Solution**:
```bash
# Add Android SDK to PATH
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Or install via Homebrew (macOS)
brew install android-platform-tools
```

#### 3. Rust Compilation Issues
**Problem**: Rust compiler errors

**Solution**:
```bash
# Update Rust to latest stable
rustup update stable

# Clean build cache
cargo clean

# Rebuild
cargo build
```

#### 4. Frontend Build Issues
**Problem**: Node.js or npm errors

**Solution**:
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check Node.js version
node --version  # Should be 18.x or later
```

#### 5. Tauri Dev Server Issues
**Problem**: Application window doesn't open

**Solution**:
```bash
# Check if ports are available
lsof -i :5173

# Restart development server
npm run tauri:dev
```

### Environment Validation

#### Check Development Environment
```bash
# Run environment check script
./scripts/check-dev-environment.sh

# Or manually verify:
node --version     # Should be 18.x+
rustc --version    # Should be 1.70+
cargo --version
idevice_id --help  # macOS only
adb version
```

#### Test Basic Functionality
```bash
# Test Rust compilation
cd src-tauri
cargo check

# Test frontend compilation
cd ../src/renderer
npm run build

# Test full application build
cd ../..
npm run tauri:build:debug
```

---

## IDE Setup

### Recommended Extensions

#### Visual Studio Code
```json
{
  "recommendations": [
    "rust-lang.rust-analyzer",
    "tauri-apps.tauri-vscode",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

#### Configuration
```json
{
  "settings": {
    "rust-analyzer.cargo.features": "all",
    "typescript.preferences.importModuleSpecifier": "relative",
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

### Alternative IDEs

#### IntelliJ IDEA / WebStorm
- Install Rust plugin
- Install Tauri plugin
- Configure TypeScript and React support

#### Vim/Neovim
- Use rust.vim for Rust support
- Configure LSP with rust-analyzer
- Use appropriate TypeScript/React plugins

---

## Next Steps

After completing the setup:

1. **Read the [Project Overview](../PROJECT_OVERVIEW.md)** to understand the architecture
2. **Review the [Testing Guide](../testing/comprehensive-testing-plan.md)** for testing practices
3. **Check [Build & Deployment Guide](build-and-deployment.md)** for release processes
4. **Explore the codebase** starting with `src/renderer/src/App.tsx` and `src-tauri/src/main.rs`

---

## Getting Help

- **Documentation**: Check other files in the `docs/` directory
- **Issues**: Create GitHub issues for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions

---

*This guide is regularly updated. If you encounter issues not covered here, please contribute improvements.* 