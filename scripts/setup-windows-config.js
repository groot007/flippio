#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../src-tauri/tauri.conf.json');

// Read current config
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Backup original config
const backupPath = configPath + '.backup';
fs.writeFileSync(backupPath, JSON.stringify(config, null, 2));

console.log('Backed up original config to:', backupPath);

// Modify for Windows
config.bundle.externalBin = [
  "../resources/libimobiledevice-windows/afcclient",
  "../resources/libimobiledevice-windows/idevice_id", 
  "../resources/libimobiledevice-windows/ideviceinfo",
  "../resources/libimobiledevice-windows/ideviceinstaller"
];

config.bundle.resources = [
  "../resources/libimobiledevice-windows/**",
  "../resources/adb-platform-tools/**"
];

// Write modified config
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log('Updated tauri.conf.json for Windows build');
console.log('External binaries:', config.bundle.externalBin);
console.log('Resources:', config.bundle.resources);
