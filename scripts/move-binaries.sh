#!/bin/bash
set -e

APP_NAME="Flippio"
SOURCE_DIR="src-tauri/macos-deps"
DEST_DIR="src-tauri/target/release/bundle/macos/${APP_NAME}.app/Contents/MacOS"

echo "📦 Copying binaries from $SOURCE_DIR to $DEST_DIR"

for bin in "$SOURCE_DIR"/*; do
  echo "➡️  Copying $(basename "$bin")"
  cp "$bin" "$DEST_DIR/"
done

echo "✅ Done moving binaries to Contents/MacOS"