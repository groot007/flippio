#!/usr/bin/env node

const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const process = require('node:process')

// Script to sign bundled libimobiledevice binaries for macOS notarization
// This script should be run after the Tauri build but before notarization

function findBundledBinaries(appPath) {
  // Try both possible paths where Tauri might place resources
  const possiblePaths = [
    path.join(appPath, 'Contents', 'Resources', '_up_', 'resources', 'libimobiledevice'),
    path.join(appPath, 'Contents', 'Resources', 'libimobiledevice'),
    path.join(appPath, 'Contents', 'Resources', 'resources', 'libimobiledevice'),
  ]

  let binariesPath = null
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      binariesPath = possiblePath
      console.log('Found libimobiledevice at:', binariesPath)
      break
    }
  }

  const binaries = []

  if (!binariesPath) {
    console.log('No libimobiledevice binaries found. Tried paths:')
    possiblePaths.forEach(p => console.log(' -', p))
    return binaries
  }

  // Find all executables in tools directory
  const toolsPath = path.join(binariesPath, 'tools')
  if (fs.existsSync(toolsPath)) {
    const tools = fs.readdirSync(toolsPath)
    for (const tool of tools) {
      const toolPath = path.join(toolsPath, tool)
      try {
        const stat = fs.statSync(toolPath)
        if (stat.isFile() && (stat.mode & 0o111) && !tool.includes('.')) {
          binaries.push(toolPath)
        }
      }
      catch (error) {
        console.warn(`Could not stat ${toolPath}:`, error.message)
      }
    }
  }

  // Find all dynamic libraries in libs directory
  const libsPath = path.join(binariesPath, 'libs')
  if (fs.existsSync(libsPath)) {
    const libs = fs.readdirSync(libsPath)
    for (const lib of libs) {
      if (lib.endsWith('.dylib')) {
        binaries.push(path.join(libsPath, lib))
      }
    }
  }

  return binaries
}

function signBinary(binaryPath, identity) {
  try {
    console.log(`Signing binary: ${binaryPath}`)

    // Sign with hardened runtime and timestamp
    const cmd = `codesign --force --sign "${identity}" --options runtime --timestamp "${binaryPath}"`
    execSync(cmd, { stdio: 'inherit' })

    console.log(`✅ Successfully signed: ${path.basename(binaryPath)}`)
  }
  catch (error) {
    console.error(`❌ Failed to sign ${binaryPath}:`, error.message)
    throw error
  }
}

function verifySignature(binaryPath) {
  try {
    const cmd = `codesign --verify --verbose "${binaryPath}"`
    execSync(cmd, { stdio: 'pipe' })
    return true
  }
  catch {
    return false
  }
}

function main() {
  const args = process.argv.slice(2)
  if (args.length < 2) {
    console.error('Usage: node sign-bundled-binaries.js <app-path> <signing-identity>')
    console.error('Example: node sign-bundled-binaries.js /path/to/Flippio.app "Developer ID Application: Your Name"')
    process.exit(1)
  }

  const appPath = args[0]
  const signingIdentity = args[1]

  if (!fs.existsSync(appPath)) {
    console.error('App path does not exist:', appPath)
    process.exit(1)
  }

  console.log('🔍 Finding bundled binaries...')
  const binaries = findBundledBinaries(appPath)

  if (binaries.length === 0) {
    console.log('No binaries found to sign.')
    return
  }

  console.log(`Found ${binaries.length} binaries to sign:`)
  binaries.forEach(binary => console.log(`  - ${path.basename(binary)}`))

  let signedCount = 0
  let failedCount = 0

  for (const binary of binaries) {
    try {
      signBinary(binary, signingIdentity)

      // Verify the signature
      if (verifySignature(binary)) {
        signedCount++
      }
      else {
        console.error(`❌ Signature verification failed for: ${path.basename(binary)}`)
        failedCount++
      }
    }
    catch (error) {
      console.error(`❌ Failed to sign ${path.basename(binary)}:`, error.message)
      failedCount++
    }
  }

  console.log(`\n📊 Signing Summary:`)
  console.log(`✅ Successfully signed: ${signedCount}`)
  console.log(`❌ Failed to sign: ${failedCount}`)

  if (failedCount > 0) {
    console.error('\n❌ Some binaries failed to sign. Check the errors above.')
    process.exit(1)
  }

  console.log('\n✅ All binaries signed successfully!')
  console.log('You can now proceed with notarization.')
}

if (require.main === module) {
  main()
}

module.exports = { findBundledBinaries, signBinary, verifySignature }
