#!/bin/bash

# Test script to verify signature generation works locally
# This helps debug signature issues before deploying to GitHub Actions

set -e

echo "🔍 Testing Tauri signature generation..."

# Check if TAURI_PRIVATE_KEY is set
if [ -z "$TAURI_PRIVATE_KEY" ]; then
    echo "❌ TAURI_PRIVATE_KEY environment variable is not set"
    echo "   You need to set this to test signature generation locally"
    echo "   export TAURI_PRIVATE_KEY='your_private_key_here'"
    exit 1
fi

echo "✅ TAURI_PRIVATE_KEY is set"

# Check if Tauri CLI is installed
if ! command -v tauri &> /dev/null; then
    echo "❌ Tauri CLI is not installed"
    echo "   Install it with: npm install -g @tauri-apps/cli"
    exit 1
fi

echo "✅ Tauri CLI is available"

# Verify the public key matches
echo "🔍 Checking public key in tauri.conf.json..."
PUBLIC_KEY=$(cat src-tauri/tauri.conf.json | grep -o '"pubkey": "[^"]*"' | cut -d'"' -f4)

if [ -z "$PUBLIC_KEY" ]; then
    echo "❌ No public key found in tauri.conf.json"
    exit 1
fi

echo "✅ Public key found in configuration"
echo "   Key: ${PUBLIC_KEY:0:50}..."

# Test build (this will create signatures if everything is configured correctly)
echo "🏗️  Testing build with signature generation..."
echo "   Note: This will create a production build which may take several minutes"

read -p "Do you want to proceed with a test build? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Starting test build..."
    npm run tauri:build
    
    # Check if .sig files were created
    echo "🔍 Checking for generated signature files..."
    SIG_COUNT=$(find src-tauri/target/release/bundle -name "*.sig" 2>/dev/null | wc -l || echo 0)
    
    if [ "$SIG_COUNT" -gt 0 ]; then
        echo "✅ Found $SIG_COUNT signature file(s):"
        find src-tauri/target/release/bundle -name "*.sig" 2>/dev/null || true
    else
        echo "❌ No signature files found"
        echo "   This indicates an issue with signature generation"
    fi
else
    echo "⏭️  Skipping test build"
fi

echo "✅ Signature test completed"
