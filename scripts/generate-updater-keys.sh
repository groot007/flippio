#!/bin/bash

# Script to generate new Tauri updater key pair
# This will create a matching private/public key pair for Tauri updater

set -e

echo "🔐 Generating new Tauri updater key pair..."

# Check if tauri CLI is available
if ! command -v tauri &> /dev/null; then
    echo "❌ Tauri CLI not found. Installing..."
    npm install -g @tauri-apps/cli
fi

# Generate new key pair
echo "🔑 Generating new updater key pair..."
tauri signer generate -w flippio_updater.key

echo ""
echo "✅ Key pair generated successfully!"
echo ""
echo "📁 Files created:"
echo "   - flippio_updater.key (PRIVATE KEY - keep secret!)"
echo "   - flippio_updater.key.pub (PUBLIC KEY)"
echo ""

# Read the generated keys
if [ -f "flippio_updater.key" ] && [ -f "flippio_updater.key.pub" ]; then
    echo "🔐 PRIVATE KEY (for GitHub Secret TAURI_PRIVATE_KEY):"
    echo "=================================="
    cat flippio_updater.key
    echo ""
    echo "=================================="
    echo ""
    
    echo "🔓 PUBLIC KEY (for tauri.conf.json):"
    echo "=================================="
    cat flippio_updater.key.pub
    echo ""
    echo "=================================="
    echo ""
    
    # Encode public key for tauri.conf.json
    echo "📝 BASE64 ENCODED PUBLIC KEY (copy this to tauri.conf.json):"
    echo "=================================="
    base64 -i flippio_updater.key.pub
    echo "=================================="
    echo ""
    
    echo "📋 NEXT STEPS:"
    echo ""
    echo "1. 🔐 Set GitHub Secret:"
    echo "   - Go to: https://github.com/groot007/flippio/settings/secrets/actions"
    echo "   - Add or update secret: TAURI_PRIVATE_KEY"
    echo "   - Value: Copy the PRIVATE KEY content above (including comment lines)"
    echo ""
    echo "2. ⚙️  Update tauri.conf.json:"
    echo "   - Replace the 'pubkey' value with the BASE64 ENCODED PUBLIC KEY above"
    echo ""
    echo "3. 🚀 Create new release:"
    echo "   - Commit changes to tauri.conf.json"
    echo "   - Create new tag: git tag v0.3.7 && git push origin v0.3.7"
    echo ""
    echo "⚠️  SECURITY: Delete the .key files after setting up the secret!"
    echo "   rm flippio_updater.key flippio_updater.key.pub"
else
    echo "❌ Failed to generate keys"
    exit 1
fi
