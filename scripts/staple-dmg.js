const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const process = require('node:process')

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'))
const version = packageJson.version

console.log(`Looking for DMG file with version ${version}...`)

// Find the DMG file
const dmgPath = `dist/flippio-${version}.dmg`

if (fs.existsSync(dmgPath)) {
  console.log(`Found DMG at ${dmgPath}, stapling now...`)
  try {
    execSync(`xcrun stapler staple "${dmgPath}"`, { stdio: 'inherit' })
    console.log('DMG successfully stapled!')

    // Verify stapling
    try {
      execSync(`stapler validate "${dmgPath}"`, { stdio: 'inherit' })
      console.log('Stapling verification successful')
    }
    catch (verifyError) {
      console.error('Stapling verification failed:', verifyError.message)
    }
  }
  catch (error) {
    console.error('Error stapling DMG:', error.message)
    process.exit(1)
  }
}
else {
  console.error(`Error: DMG file not found at ${dmgPath}`)
  console.log('Available files in dist directory:')
  try {
    const files = fs.readdirSync('dist')
    console.log(files.join('\n'))
  }
  catch {
    console.log('Could not read dist directory')
  }
  process.exit(1)
}
