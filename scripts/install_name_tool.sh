#!/bin/bash
set -e

DEPS_PATH="src-tauri/macos-deps"

echo "📁 Fixing dylib IDs and dependencies inside $DEPS_PATH before bundling"
echo ""

if [ ! -d "$DEPS_PATH" ]; then
  echo "❌ Directory does not exist: $DEPS_PATH"
  exit 1
fi

# List of all dylibs to update
DYLIBS=(
  libssl.3.dylib
  libcrypto.3.dylib
  libusbmuxd-2.0.7.dylib
  libimobiledevice-glue-1.0.0.dylib
  libplist-2.0.4.dylib
  libzip.5.5.dylib
  liblzma.5.dylib
  libzstd.1.5.7.dylib
  libimobiledevice-1.0.6.dylib
)

echo "🔧 Fixing dylib IDs..."
for dylib in "${DYLIBS[@]}"; do
  if [[ -f "$DEPS_PATH/$dylib" ]]; then
    install_name_tool -id "@executable_path/../Frameworks/$dylib" "$DEPS_PATH/$dylib"
  fi
done

echo "🔧 Fixing dylib references inside dylibs..."

# Define mapping: <target> <source> <dest>
declare -a DEP_FIXES=(
  "libssl.3.dylib @executable_path/../libs/libcrypto.3.dylib @executable_path/../Frameworks/libcrypto.3.dylib"
  "libusbmuxd-2.0.7.dylib @executable_path/../libs/libimobiledevice-glue-1.0.0.dylib @executable_path/../Frameworks/libimobiledevice-glue-1.0.0.dylib"
  "libusbmuxd-2.0.7.dylib @executable_path/../libs/libplist-2.0.4.dylib @executable_path/../Frameworks/libplist-2.0.4.dylib"
  "libimobiledevice-glue-1.0.0.dylib @executable_path/../libs/libplist-2.0.4.dylib @executable_path/../Frameworks/libplist-2.0.4.dylib"
  "libimobiledevice-1.0.6.dylib @executable_path/../libs/libcrypto.3.dylib @executable_path/../Frameworks/libcrypto.3.dylib"
  "libimobiledevice-1.0.6.dylib @executable_path/../libs/libssl.3.dylib @executable_path/../Frameworks/libssl.3.dylib"
  "libimobiledevice-1.0.6.dylib @executable_path/../libs/liblzma.5.dylib @executable_path/../Frameworks/liblzma.5.dylib"
  "libzip.5.5.dylib @executable_path/../libs/liblzma.5.dylib @executable_path/../Frameworks/liblzma.5.dylib"
  "libzip.5.5.dylib @executable_path/../libs/libzstd.1.5.7.dylib @executable_path/../Frameworks/libzstd.1.5.7.dylib"
  "libimobiledevice-1.0.6.dylib @executable_path/../libs/libusbmuxd-2.0.7.dylib @executable_path/../Frameworks/libusbmuxd-2.0.7.dylib"
  "libimobiledevice-1.0.6.dylib @executable_path/../libs/libplist-2.0.4.dylib @executable_path/../Frameworks/libplist-2.0.4.dylib"
)

for fix in "${DEP_FIXES[@]}"; do
  set -- $fix
  target="$1"
  old="$2"
  new="$3"
  if [[ -f "$DEPS_PATH/$target" ]]; then
    echo "  ⮞ Patching $target: $old → $new"
    install_name_tool -change "$old" "$new" "$DEPS_PATH/$target" || true
  fi
done

echo "🔧 Fixing binaries to reference Frameworks dylibs..."

for bin in "$DEPS_PATH"/*; do
  [[ "$bin" == *.dylib ]] && continue
  [[ ! -x "$bin" ]] && continue
  name=$(basename "$bin")
  echo "  ⮞ Patching binary: $name"
  for dylib in "${DYLIBS[@]}"; do
    base=$(basename "$dylib")
    install_name_tool -change "@executable_path/../libs/$base" "@executable_path/../Frameworks/$base" "$bin" || true
  done

  # Auto-duplicate missing arch-specific copies (only if binary doesn't already have arch suffix)
  if [[ ! "$name" =~ -(x86_64|aarch64)-apple-darwin$ ]]; then
    for arch in x86_64 aarch64; do
      arch_file="${DEPS_PATH}/${name}-${arch}-apple-darwin"
      if [[ ! -f "$arch_file" ]]; then
        echo "    ➕ Creating arch-specific copy: $(basename "$arch_file")"
        cp "$bin" "$arch_file"
      fi
    done
  fi
done

echo ""
echo "✅ All dylibs and binaries patched. Ready for bundling."