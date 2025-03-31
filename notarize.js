const { notarize } = require('@electron/notarize')
require('dotenv').config()
const process = require('node:process')

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== 'darwin')
    return

  const appName = context.packager.appInfo.productFilename

  return await notarize({
    appBundleId: 'com.koliastanis.flippio', // Must match your appId
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  })
}
