const path = require('node:path')
const process = require('node:process')
const { notarize } = require('@electron/notarize')
const fs = require('node:fs')

const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'))
const version = packageJson.version

notarize({
  appBundleId: 'com.koliastanis.flippio',
  appPath: path.resolve(__dirname, '..', 'dist', `flippio-${version}.dmg`),
  appleId: process.env.APPLE_ID,
  appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
  teamId: process.env.APPLE_TEAM_ID,
})
