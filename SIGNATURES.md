# Tauri Auto-Updater Signature Generation Guide

## Overview

Tauri's auto-updater uses **minisign** signatures to verify the authenticity of updates. Each release asset (`.dmg`, `.app.tar.gz`, etc.) must have a corresponding `.sig` signature file.

## How It Works

1. **Private Key**: Used to sign release assets during build (stored in GitHub Secrets)
2. **Public Key**: Used by the app to verify signatures (stored in `tauri.conf.json`)
3. **Signature Files**: Generated for each asset (`.dmg.sig`, `.app.tar.gz.sig`)

## Current Configuration

### Public Key in `src-tauri/tauri.conf.json`:
```json
{
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDE4OEFCRjdFNjU1NjRGNUYKUldSZlQxWmxmcitLR0FldFhIcWRNVEUxVjN5QlJYenZYTytwS1BLYWhFSjJhRUdsVW1LZ2srelgK"
    }
  }
}
```

This decodes to:
```
untrusted comment: minisign public key: 188ABF7E65564F5F
RWRfT1Zlfr+KGAetXHqdMTE1V3yBRXzvXO+pKPKahEJ2aEGlUmKgk+zX
```

### Required GitHub Secrets:
- `TAURI_PRIVATE_KEY`: The private key corresponding to the public key above
- `TAURI_KEY_PASSWORD`: Password for the private key (if encrypted)

## Automatic Signature Generation

The `tauri-action` GitHub Action automatically generates signatures when:

1. `TAURI_PRIVATE_KEY` environment variable is set
2. The private key corresponds to the public key in `tauri.conf.json`
3. The action runs successfully

### What Gets Created:

For each release asset, a corresponding `.sig` file is generated:

**Assets:**
- `Flippio_0.3.4_aarch64.dmg`
- `Flippio_0.3.4_x64.dmg`
- `Flippio_aarch64.app.tar.gz`
- `Flippio_x64.app.tar.gz`

**Signatures:**
- `Flippio_0.3.4_aarch64.dmg.sig`
- `Flippio_0.3.4_x64.dmg.sig`
- `Flippio_aarch64.app.tar.gz.sig`
- `Flippio_x64.app.tar.gz.sig`

## Creating a New Release with Signatures

### Option 1: GitHub Actions (Recommended)

1. **Commit version changes**:
   ```bash
   git add .
   git commit -m "bump version to 0.3.4"
   git push
   ```

2. **Create and push a tag**:
   ```bash
   git tag v0.3.4
   git push origin v0.3.4
   ```

3. **The workflow will**:
   - Build the app for both architectures
   - Sign the assets with the private key
   - Create signature files
   - Upload both assets and signatures to the release

### Option 2: Local Testing

Use the provided test script:
```bash
# Set your private key (should match the public key in tauri.conf.json)
export TAURI_PRIVATE_KEY="your_private_key_here"

# Run the test script
./scripts/test-signatures.sh
```

## Troubleshooting

### Common Issues:

1. **"missing field `signature`"**: 
   - Release assets don't have corresponding `.sig` files
   - Usually means `TAURI_PRIVATE_KEY` wasn't set during build

2. **"signature verification failed"**:
   - Private key doesn't match public key
   - Signature files are corrupted or missing

3. **"invalid public key format"**:
   - Public key in `tauri.conf.json` is malformed
   - Should be base64-encoded minisign public key

### Verification:

Check if signatures were generated:
```bash
# After building, look for .sig files
find src-tauri/target/release/bundle -name "*.sig"

# Check GitHub release assets include both files and signatures
curl -s https://api.github.com/repos/groot007/flippio/releases/latest | jq '.assets[].name'
```

## Next Steps

1. **Test the updated workflow** by creating release v0.3.4
2. **Verify signature generation** in the GitHub Actions logs  
3. **Test the auto-updater** from version 0.3.2 → 0.3.4
4. **Confirm manual "Check for Updates"** works without errors

The key insight is that v0.3.3 was likely created without `TAURI_PRIVATE_KEY` set, which is why it lacks signature files. Version 0.3.4 should include them with the current configuration.
