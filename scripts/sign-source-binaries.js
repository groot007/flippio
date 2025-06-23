#!/usr/bin/env node

const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const process = require('node:process')

// Script to sign libimobiledevice binaries at their source location
// This should be run before the Tauri build process

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
  if (args.length < 1) {
    console.error('Usage: node sign-source-binaries.js <signing-identity>')
    console.error('Example: node sign-source-binaries.js "Developer ID Application: Your Name"')
    process.exit(1)
  }

  const signingIdentity = args[0]

  // Define the source paths for the binaries
  const basePath = path.join(__dirname, '..', 'resources', 'libimobiledevice')

  const binariesToSign = [
    // Tools
    path.join(basePath, 'tools', 'idevice_id'),
    path.join(basePath, 'tools', 'ideviceinfo'),
    path.join(basePath, 'tools', 'ideviceinstaller'),
    path.join(basePath, 'tools', 'afcclient'),
    // Libraries
    path.join(basePath, 'libs', 'libimobiledevice-1.0.6.dylib'),
    path.join(basePath, 'libs', 'libimobiledevice-glue-1.0.0.dylib'),
    path.join(basePath, 'libs', 'libplist-2.0.4.dylib'),
    path.join(basePath, 'libs', 'libusbmuxd-2.0.7.dylib'),
    path.join(basePath, 'libs', 'libzip.5.5.dylib'),
    path.join(basePath, 'libs', 'libcrypto.3.dylib'),
    path.join(basePath, 'libs', 'libssl.3.dylib'),
    path.join(basePath, 'libs', 'liblzma.5.dylib'),
    path.join(basePath, 'libs', 'libzstd.1.5.7.dylib'),
  ]

  console.log('🔍 Signing libimobiledevice binaries at source...')

  let signedCount = 0
  let failedCount = 0

  for (const binary of binariesToSign) {
    if (!fs.existsSync(binary)) {
      console.warn(`⚠️ Binary not found: ${binary}`)
      continue
    }

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
  console.log('You can now proceed with the Tauri build.')
}

if (require.main === module) {
  main()
}

module.exports = { signBinary, verifySignature }
