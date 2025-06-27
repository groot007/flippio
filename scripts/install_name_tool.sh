#!/bin/bash
set -e

DEPS_PATH="src-tauri/macos-deps"

echo "📁 Fixing dylib IDs and dependencies inside $DEPS_PATH before bundling"
echo ""

if [ ! -d "$DEPS_PATH" ]; then
  echo "❌ Directory does not exist: $DEPS_PATH"
  exit 1
fi



echo "🔧 Fixing dylib IDs..."

install_name_tool -id @executable_path/../Frameworks/libssl.3.dylib "$DEPS_PATH/libssl.3.dylib"
install_name_tool -id @executable_path/../Frameworks/libcrypto.3.dylib "$DEPS_PATH/libcrypto.3.dylib"
install_name_tool -id @executable_path/../Frameworks/libusbmuxd-2.0.7.dylib "$DEPS_PATH/libusbmuxd-2.0.7.dylib"
install_name_tool -id @executable_path/../Frameworks/libimobiledevice-glue-1.0.0.dylib "$DEPS_PATH/libimobiledevice-glue-1.0.0.dylib"
install_name_tool -id @executable_path/../Frameworks/libplist-2.0.4.dylib "$DEPS_PATH/libplist-2.0.4.dylib"
install_name_tool -id @executable_path/../Frameworks/libzip.5.5.dylib "$DEPS_PATH/libzip.5.5.dylib"
install_name_tool -id @executable_path/../Frameworks/liblzma.5.dylib "$DEPS_PATH/liblzma.5.dylib"

echo "🔧 Fixing dylib dependencies inside dylibs..."

install_name_tool -change @executable_path/../libs/libplist-2.0.4.dylib @executable_path/../Frameworks/libplist-2.0.4.dylib "$DEPS_PATH/libimobiledevice-glue-1.0.0.dylib"
install_name_tool -change @executable_path/../libs/libcrypto.3.dylib @executable_path/../Frameworks/libcrypto.3.dylib "$DEPS_PATH/libssl.3.dylib"
install_name_tool -change @executable_path/../libs/libimobiledevice-glue-1.0.0.dylib @executable_path/../Frameworks/libimobiledevice-glue-1.0.0.dylib "$DEPS_PATH/libusbmuxd-2.0.7.dylib"
install_name_tool -change @executable_path/../libs/libplist-2.0.4.dylib @executable_path/../Frameworks/libplist-2.0.4.dylib "$DEPS_PATH/libusbmuxd-2.0.7.dylib"
install_name_tool -change @executable_path/../libs/liblzma.5.dylib @executable_path/../Frameworks/liblzma.5.dylib "$DEPS_PATH/libimobiledevice-1.0.6.dylib"
install_name_tool -change @executable_path/../libs/liblzma.5.dylib @executable_path/../Frameworks/liblzma.5.dylib "$DEPS_PATH/libssl.3.dylib"
install_name_tool -change @executable_path/../libs/libssl.3.dylib @executable_path/../Frameworks/libssl.3.dylib "$DEPS_PATH/libimobiledevice-1.0.6.dylib"
install_name_tool -change @executable_path/../libs/libcrypto.3.dylib @executable_path/../Frameworks/libcrypto.3.dylib "$DEPS_PATH/libimobiledevice-1.0.6.dylib"
install_name_tool -change @executable_path/../libs/liblzma.5.dylib @executable_path/../Frameworks/liblzma.5.dylib "$DEPS_PATH/libzip.5.5.dylib"

echo "🔧 Fixing helper binaries to load dylibs from Frameworks..."

for bin in "$DEPS_PATH"/*; do
  # Skip dylibs themselves to avoid errors here
  if [[ "$bin" == *.dylib ]]; then
    continue
  fi
  echo "Patching $bin"
  install_name_tool -change @executable_path/../libs/libssl.3.dylib @executable_path/../Frameworks/libssl.3.dylib "$bin" || true
  install_name_tool -change @executable_path/../libs/libcrypto.3.dylib @executable_path/../Frameworks/libcrypto.3.dylib "$bin" || true
  install_name_tool -change @executable_path/../libs/libusbmuxd-2.0.7.dylib @executable_path/../Frameworks/libusbmuxd-2.0.7.dylib "$bin" || true
  install_name_tool -change @executable_path/../libs/libimobiledevice-glue-1.0.0.dylib @executable_path/../Frameworks/libimobiledevice-glue-1.0.0.dylib "$bin" || true
  install_name_tool -change @executable_path/../libs/libplist-2.0.4.dylib @executable_path/../Frameworks/libplist-2.0.4.dylib "$bin" || true
  install_name_tool -change @executable_path/../libs/libzip.5.5.dylib @executable_path/../Frameworks/libzip.5.5.dylib "$bin" || true
  install_name_tool -change @executable_path/../libs/libimobiledevice-1.0.6.dylib @executable_path/../Frameworks/libimobiledevice-1.0.6.dylib "$bin" || true
  install_name_tool -change @executable_path/../libs/liblzma.5.dylib @executable_path/../Frameworks/liblzma.5.dylib "$bin" || true
done

echo ""
echo "✅ Done fixing dylib paths inside $DEPS_PATH."
echo "Now you can bundle the app, and dylib paths will be ready."