const { execSync } = require('node:child_process')
require('dotenv').config()
const process = require('node:process')

console.log('Starting release process...')

try {
  // Step 1: Build the app
  console.log('Building app...')
  execSync('NODE_ENV=production npm run build', { stdio: 'inherit' })

  // Step 2: Package app and create DMG (but don't publish yet)
  console.log('Creating DMG...')
  execSync('electron-builder --mac', { stdio: 'inherit' })

  // Step 3: Notarize the DMG
  console.log('Notarizing DMG...')
  execSync('npm run notarize-dmg', { stdio: 'inherit' })

  // Step 4: Staple the DMG
  console.log('Stapling DMG...')
  execSync('npm run staple-dmg', { stdio: 'inherit' })

  // Step 5: Publish to GitHub
  console.log('Publishing to GitHub...')
  execSync('electron-builder --publish always', { stdio: 'inherit' })

  console.log('Release process completed successfully!')
}
catch (error) {
  console.error('Release process failed:', error.message)
  process.exit(1)
}
