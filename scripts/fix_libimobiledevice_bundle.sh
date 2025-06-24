#!/bin/bash
# Usage: ./fix_libimobiledevice_bundle.sh /path/to/Flippio.app
set -e

APP_PATH="$1"
APP_PATH="$1"
if [ -z "$APP_PATH" ]; then
  APP_PATH=./src-tauri/target/release/bundle/macos/Flippio.app/Contents
fi
if [ -z "$APP_PATH" ]; then
  echo "Usage: $0 /path/to/Flippio.app"
  exit 1
fi

echo "[fix_libimobiledevice_bundle.sh] App bundle path: $APP_PATH"

MACOS_PATH="$APP_PATH/MacOS/tools"
FRAMEWORKS_PATH="$APP_PATH/MacOS/libs"

echo "[fix_libimobiledevice_bundle.sh] MacOS path: $MACOS_PATH"
echo "[fix_libimobiledevice_bundle.sh] Frameworks path: $FRAMEWORKS_PATH"

# Copy dylibs to Frameworks
mkdir -p "$FRAMEWORKS_PATH"
cp -a "$(dirname "$0")/../resources/libimobiledevice/libs/"*.dylib "$FRAMEWORKS_PATH/"

# Copy tools to MacOS
mkdir -p "$MACOS_PATH"
cp -a "$(dirname "$0")/../resources/libimobiledevice/tools/"* "$MACOS_PATH/"

# Make sure tools are executable
chmod +x "$MACOS_PATH"/*

# Fix install_name for each dylib
for dylib in "$FRAMEWORKS_PATH"/*.dylib; do
  base=$(basename "$dylib")
  install_name_tool -id "@executable_path/../Frameworks/$base" "$dylib"
done

# Patch each tool to use the bundled dylibs
for tool in "$MACOS_PATH"/*; do
  [ -f "$tool" ] || continue
  otool -L "$tool" | grep "$FRAMEWORKS_PATH" | while read -r line; do
    dep=$(echo "$line" | awk '{print $1}')
    dep_base=$(basename "$dep")
    install_name_tool -change "$dep" "@executable_path/../Frameworks/$dep_base" "$tool"
  done
done

echo "[fix_libimobiledevice_bundle.sh] libimobiledevice dylibs and tools copied and patched in app bundle."
