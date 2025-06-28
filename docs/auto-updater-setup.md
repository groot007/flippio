# Auto-updater Setup Guide

## Overview
The auto-updater has been fully configured for Flippio. This document outlines the final steps needed to complete the setup.

## Current Status ✅

### ✅ Completed Components:
1. **Backend Integration**: Rust commands for checking and downloading updates
2. **Frontend Component**: UpdateChecker component integrated into AppHeader
3. **Configuration**: Public key configured in `tauri.conf.json`
4. **UI Integration**: Update checker button visible in main application header

### ✅ Key Files Updated:
- `src-tauri/src/commands/updater.rs` - Backend update logic
- `src/renderer/src/tauri-api.ts` - Frontend API integration
- `src/renderer/src/components/updater/UpdateChecker.tsx` - UI component
- `src/renderer/src/components/layout/AppHeader.tsx` - Integration point
- `src-tauri/tauri.conf.json` - Public key configuration

## Required GitHub Secrets ⚠️

To enable auto-updates in production, add these secrets to your GitHub repository:

### 1. TAURI_PRIVATE_KEY
```bash
# The private key content (from the generated keypair)
# Location: /Users/mykolastanislavchuk/Home/Flippio/tauri-update-key.sec
```

### 2. TAURI_KEY_PASSWORD
```bash
# The password used when generating the keypair
# This should be the password you entered during key generation
```

## How to Add GitHub Secrets:

1. Go to your GitHub repository
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Add `TAURI_PRIVATE_KEY` with the content of `tauri-update-key.sec`
5. Add `TAURI_KEY_PASSWORD` with your keypair password

## Testing the Auto-updater:

1. **Create a Release**: The GitHub Actions workflow will automatically sign updates when you create a new release
2. **Version Bump**: Update the version in `src-tauri/tauri.conf.json`
3. **Manual Check**: Use the "Check for Updates" button in the app header
4. **Automatic Check**: The app will check for updates on startup (configured in the backend)

## Update Flow:

1. User clicks "Check for Updates" or app checks automatically
2. App queries GitHub API for latest release
3. If newer version found, "Update Now" button appears
4. User clicks "Update Now" to download and install
5. App restarts with new version

## Security Notes:

- Updates are signed with your private key and verified with the public key
- Only releases from your GitHub repository will be accepted
- The updater respects the configured endpoints in `tauri.conf.json`

## File Structure:
```
/src-tauri/
  ├── tauri.conf.json          # Contains public key and updater config
  └── src/commands/updater.rs  # Backend update logic

/src/renderer/src/
  ├── components/updater/UpdateChecker.tsx  # UI component
  ├── components/layout/AppHeader.tsx       # Integration point
  └── tauri-api.ts                          # Frontend API
```

The auto-updater is now fully integrated and ready for production use once GitHub Secrets are configured.
