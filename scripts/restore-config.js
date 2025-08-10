#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const configPath = path.join(__dirname, '../src-tauri/tauri.conf.json');
const backupPath = `${configPath}.backup`;

if (fs.existsSync(backupPath)) {
  const originalConfig = fs.readFileSync(backupPath, 'utf8');
  fs.writeFileSync(configPath, originalConfig);
  fs.unlinkSync(backupPath);
  console.log('Restored original tauri.conf.json from backup');
} else {
  console.log('No backup found at:', backupPath);
}
