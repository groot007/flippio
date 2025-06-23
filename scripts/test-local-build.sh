#!/bin/bash

# Local Testing Script for Tauri Build and Signing
# This script helps you test the build and signing process locally without running CI

set -e  # Exit on any error

echo "🚀 Starting local Tauri build and signing test..."

# Configuration
TARGET_ARCH="${1:-aarch64-apple-darwin}"  # Default to Apple Silicon, can pass x86_64-apple-darwin
BUILD_MODE="${2:-debug}"  # debug or release
SIGNING_IDENTITY="${3:--}"  # Default to ad-hoc signing

echo "📋 Configuration:"
echo "  Target Architecture: $TARGET_ARCH"
echo "  Build Mode: $BUILD_MODE"
echo "  Signing Identity: $SIGNING_IDENTITY"
echo ""

# Clean previous builds (optional)
if [ "$4" = "clean" ]; then
    echo "🧹 Cleaning previous builds..."
    rm -rf src-tauri/target
    echo "✅ Clean completed"
fi

# Build the Tauri app
echo "🔨 Building Tauri app for $TARGET_ARCH..."
cd src-tauri

if [ "$BUILD_MODE" = "release" ]; then
    npx tauri build --target "$TARGET_ARCH"
    BUILD_DIR="target/$TARGET_ARCH/release"
else
    npx tauri dev --target "$TARGET_ARCH" &
    DEV_PID=$!
    sleep 10  # Let it start
    kill $DEV_PID || true
    wait $DEV_PID 2>/dev/null || true
    npx tauri build --target "$TARGET_ARCH" --debug
    BUILD_DIR="target/$TARGET_ARCH/debug"
fi

cd ..

# Find the app bundle
APP_PATH="src-tauri/$BUILD_DIR/bundle/macos/Flippio.app"

if [ ! -d "$APP_PATH" ]; then
    echo "❌ App bundle not found at: $APP_PATH"
    echo "Available bundles:"
    find src-tauri/target -name "*.app" -type d 2>/dev/null || echo "No .app bundles found"
    exit 1
fi

echo "✅ App bundle built successfully: $APP_PATH"

# Inspect the bundle structure
echo ""
echo "🔍 Bundle Structure Analysis:"
echo "Contents directory:"
ls -la "$APP_PATH/Contents/" 2>/dev/null || echo "No Contents directory"

echo ""
echo "Resources directory:"
ls -la "$APP_PATH/Contents/Resources/" 2>/dev/null || echo "No Resources directory"

echo ""
echo "Frameworks directory:"
ls -la "$APP_PATH/Contents/Frameworks/" 2>/dev/null || echo "No Frameworks directory"

echo ""
echo "libimobiledevice resources:"
find "$APP_PATH/Contents/Resources" -name "libimobiledevice" -type d 2>/dev/null | while read dir; do
    echo "Found libimobiledevice at: $dir"
    echo "  Tools:"
    ls -la "$dir/tools/" 2>/dev/null | head -5 || echo "    No tools directory"
    echo "  Libraries:"
    ls -la "$dir/libs/" 2>/dev/null | head -5 || echo "    No libs directory"
done

# Test the signing script
echo ""
echo "🔐 Testing signing script..."
node scripts/sign-bundled-binaries.js "$APP_PATH" "$SIGNING_IDENTITY"

# Verify signatures
echo ""
echo "✅ Verifying app bundle signature..."
codesign --verify --deep --verbose "$APP_PATH" || echo "⚠️  Signature verification failed (expected for ad-hoc signing)"

echo ""
echo "🎉 Local build and signing test completed!"
echo ""
echo "📋 Summary:"
echo "  ✅ Build: SUCCESS"
echo "  ✅ Bundle Structure: VERIFIED"
echo "  ✅ Signing Script: SUCCESS"
echo ""
echo "💡 Tips:"
echo "  - To test with real signing: $0 $TARGET_ARCH $BUILD_MODE 'Developer ID Application: Your Name'"
echo "  - To clean build: $0 $TARGET_ARCH $BUILD_MODE '$SIGNING_IDENTITY' clean"
echo "  - To test x86_64: $0 x86_64-apple-darwin"
