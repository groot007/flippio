#!/bin/bash

# CI Workflow Test Script
# This script simulates what the GitHub Actions workflow does

set -e

echo "🚀 Simulating CI workflow steps..."

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script must be run on macOS"
    exit 1
fi

# Configuration
TARGET_ARCH="${1:-aarch64-apple-darwin}"
SIGNING_IDENTITY="${2:--}"  # Default to ad-hoc

echo "📋 Configuration:"
echo "  Target: $TARGET_ARCH"
echo "  Signing Identity: $SIGNING_IDENTITY"
echo ""

# Step 1: Build the app (simulating CI build step)
echo "🔨 Step 1: Building Tauri app..."
cd src-tauri
npx tauri build --target "$TARGET_ARCH"
cd ..

# Step 2: Determine app path (simulating CI logic)
echo "🔍 Step 2: Determining app path..."
if [[ "$TARGET_ARCH" == *"aarch64-apple-darwin"* ]]; then
    APP_PATH="src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Flippio.app"
elif [[ "$TARGET_ARCH" == *"x86_64-apple-darwin"* ]]; then
    APP_PATH="src-tauri/target/x86_64-apple-darwin/release/bundle/macos/Flippio.app"
else
    APP_PATH="src-tauri/target/release/bundle/macos/Flippio.app"
fi

echo "Looking for app at: $APP_PATH"

if [ ! -d "$APP_PATH" ]; then
    echo "❌ App bundle not found at: $APP_PATH"
    exit 1
fi

# Step 3: Bundle structure inspection (simulating CI logging)
echo "🔍 Step 3: App bundle structure:"
ls -la "$APP_PATH/Contents/"

echo "🔍 Resources directory:"
ls -la "$APP_PATH/Contents/Resources/" 2>/dev/null || echo "No Resources directory"

echo "🔍 Frameworks directory:"
ls -la "$APP_PATH/Contents/Frameworks/" 2>/dev/null || echo "No Frameworks directory"

# Step 4: Sign bundled binaries (simulating CI signing step)
echo "🔐 Step 4: Signing bundled binaries and frameworks..."
node scripts/sign-bundled-binaries.js "$APP_PATH" "$SIGNING_IDENTITY"

# Step 5: Sign main app (simulating CI app signing)
echo "🔐 Step 5: Signing main app bundle..."
codesign --force --sign "$SIGNING_IDENTITY" --options runtime --timestamp "$APP_PATH" || echo "⚠️  Main app signing failed (expected for ad-hoc)"

# Step 6: Verify signatures (simulating CI verification)
echo "✅ Step 6: Verifying app signature..."
codesign --verify --deep --verbose "$APP_PATH" || echo "⚠️  Deep verification failed (expected for ad-hoc)"

# Step 7: Create DMG (simulating CI DMG creation)
echo "📦 Step 7: Creating DMG..."
if [[ "$TARGET_ARCH" == *"aarch64-apple-darwin"* ]]; then
    DMG_DIR="src-tauri/target/aarch64-apple-darwin/release/bundle/dmg"
    ARCH_SUFFIX="_aarch64"
elif [[ "$TARGET_ARCH" == *"x86_64-apple-darwin"* ]]; then
    DMG_DIR="src-tauri/target/x86_64-apple-darwin/release/bundle/dmg"
    ARCH_SUFFIX="_x86_64"
else
    DMG_DIR="src-tauri/target/release/bundle/dmg"
    ARCH_SUFFIX=""
fi

mkdir -p "$DMG_DIR"
DMG_NAME="Flippio_test${ARCH_SUFFIX}.dmg"
DMG_PATH="$DMG_DIR/$DMG_NAME"

echo "Creating DMG: $DMG_PATH"
hdiutil create -volname "Flippio" -srcfolder "$APP_PATH" -ov -format UDZO "$DMG_PATH"

# Step 8: Sign DMG (simulating CI DMG signing)
echo "🔐 Step 8: Signing DMG..."
codesign --force --sign "$SIGNING_IDENTITY" --timestamp "$DMG_PATH" || echo "⚠️  DMG signing failed (expected for ad-hoc)"

echo ""
echo "🎉 CI workflow simulation completed!"
echo ""
echo "📋 Results:"
echo "  ✅ App Bundle: $APP_PATH"
echo "  ✅ DMG: $DMG_PATH"
echo ""
echo "📊 File Sizes:"
du -h "$APP_PATH" || echo "Could not get app size"
du -h "$DMG_PATH" || echo "Could not get DMG size"
echo ""
echo "💡 Next Steps:"
echo "  - Test the app: open '$APP_PATH'"
echo "  - Test the DMG: open '$DMG_PATH'"
echo "  - Run with real signing: $0 $TARGET_ARCH 'Developer ID Application: Your Name'"
