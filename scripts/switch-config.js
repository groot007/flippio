#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');

const platform = process.argv[2];

if (!platform || !['windows', 'macos'].includes(platform)) {
  console.log('Usage: node switch-config.js [windows|macos]');
  process.exit(1);
}

const srcTauriDir = path.join(__dirname, '../src-tauri');
const defaultConfig = path.join(srcTauriDir, 'tauri.conf.json');
const backupConfig = path.join(srcTauriDir, 'tauri.conf.json.backup');

if (platform === 'windows') {
  const windowsConfig = path.join(srcTauriDir, 'tauri.windows.conf.json');
  
  if (!fs.existsSync(backupConfig)) {
    // Backup original (macOS) config
    fs.copyFileSync(defaultConfig, backupConfig);
    console.log('✅ Backed up original macOS config');
  }
  
  // Copy Windows config
  fs.copyFileSync(windowsConfig, defaultConfig);
  console.log('✅ Switched to Windows configuration');
  console.log('External binaries: Windows tools from ../resources/');
  
} else if (platform === 'macos') {
  if (fs.existsSync(backupConfig)) {
    // Restore original macOS config
    fs.copyFileSync(backupConfig, defaultConfig);
    fs.unlinkSync(backupConfig);
    console.log('✅ Restored original macOS configuration');
  } else {
    console.log('ℹ️  Already using macOS configuration');
  }
  console.log('External binaries: macOS tools from macos-deps/');
}
