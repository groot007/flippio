require('dotenv').config()
const { execSync } = require('node:child_process')
const process = require('node:process')

const ghToken = process.env.GH_TOKEN
if (!ghToken) {
  console.error('GH_TOKEN is not set in the .env file!')
  process.exit(1)
}

execSync('npm run publish', { stdio: 'inherit' })
