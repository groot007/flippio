#!/bin/bash

# Script to diagnose and fix Tauri signature generation issues
# Run this script to verify your key configuration

set -e

echo "🔍 Diagnosing Tauri signature generation issue..."
echo ""

# Check if we're in the right directory
if [ ! -f "src-tauri/tauri.conf.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo "✅ Found tauri.conf.json"

# Extract and decode the public key
echo "🔍 Checking public key in tauri.conf.json..."
PUBLIC_KEY_BASE64=$(cat src-tauri/tauri.conf.json | grep '"pubkey"' | cut -d'"' -f4)

if [ -z "$PUBLIC_KEY_BASE64" ]; then
    echo "❌ No public key found in tauri.conf.json"
    exit 1
fi

echo "✅ Public key found (base64 encoded)"
echo "   Length: ${#PUBLIC_KEY_BASE64} characters"

# Decode the public key
echo ""
echo "🔍 Decoded public key:"
echo "$PUBLIC_KEY_BASE64" | base64 -d
echo ""

# Extract the key ID from the decoded public key
KEY_ID=$(echo "$PUBLIC_KEY_BASE64" | base64 -d | head -1 | grep -o '[A-F0-9]\{16\}')
echo "🔑 Key ID: $KEY_ID"

# Check if TAURI_PRIVATE_KEY is set locally (for testing)
echo ""
echo "🔍 Checking local TAURI_PRIVATE_KEY environment variable..."
if [ -z "$TAURI_PRIVATE_KEY" ]; then
    echo "⚠️  TAURI_PRIVATE_KEY is not set locally"
    echo "   This is expected for GitHub Actions, but needed for local testing"
else
    echo "✅ TAURI_PRIVATE_KEY is set locally"
    
    # Try to extract key ID from private key
    PRIVATE_KEY_ID=$(echo "$TAURI_PRIVATE_KEY" | base64 -d | head -1 | grep -o '[A-F0-9]\{16\}' || echo "UNKNOWN")
    echo "   Private key ID: $PRIVATE_KEY_ID"
    
    if [ "$KEY_ID" = "$PRIVATE_KEY_ID" ]; then
        echo "✅ Key IDs match!"
    else
        echo "❌ Key IDs don't match! This will cause signature failures."
    fi
fi

echo ""
echo "🔍 Checking GitHub repository settings..."
echo "   Repository: groot007/flippio"
echo ""
echo "📋 Required GitHub Secrets:"
echo "   - TAURI_PRIVATE_KEY: Must match the public key above"
echo "   - TAURI_KEY_PASSWORD: Password for the private key (if encrypted)"
echo ""

echo "🛠️  Potential Solutions:"
echo ""
echo "1. Generate a new key pair:"
echo "   npm install -g @tauri-apps/cli"
echo "   tauri signer generate"
echo ""
echo "2. Update GitHub Secrets:"
echo "   - Go to: https://github.com/groot007/flippio/settings/secrets/actions"
echo "   - Set TAURI_PRIVATE_KEY to the private key from step 1"
echo "   - Set TAURI_KEY_PASSWORD if the key is encrypted"
echo ""
echo "3. Update tauri.conf.json with the new public key"
echo ""
echo "4. Test locally:"
echo "   export TAURI_PRIVATE_KEY='your_private_key_here'"
echo "   ./scripts/diagnose-signatures.sh"
echo ""

echo "🔍 Current workflow configuration:"
echo "   - includeUpdateJSON: enabled"
echo "   - Environment variables: TAURI_PRIVATE_KEY, TAURI_KEY_PASSWORD"
echo ""

echo "📊 Diagnosis complete!"
echo ""
echo "Most likely issue: The TAURI_PRIVATE_KEY GitHub secret doesn't match"
echo "the public key in tauri.conf.json (Key ID: $KEY_ID)"
