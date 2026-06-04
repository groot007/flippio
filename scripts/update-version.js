#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const process = require('node:process')
const readline = require('node:readline/promises')

/**
 * Update version across all project files
 * Usage: node scripts/update-version.js <new-version>
 * Example: node scripts/update-version.js 0.3.16
 */

const args = process.argv.slice(2)
const newVersion = args[0]
const isDryRun = args.includes('--dry-run')

if (!newVersion) {
  console.error('❌ Please provide a version number')
  console.log('Usage: npm run version:update <new-version>')
  console.log('Example: npm run version:update 0.3.16')
  process.exit(1)
}

// Validate version format (semantic versioning)
const versionRegex = /^\d+\.\d+\.\d+(?:-[\w.-]*)?$/
if (!versionRegex.test(newVersion)) {
  console.error('❌ Invalid version format. Please use semantic versioning (e.g., 1.0.0, 1.0.0-beta.1)')
  process.exit(1)
}

console.log(`🚀 ${isDryRun ? 'Dry run - would update' : 'Updating'} version to ${newVersion}...`)

const rootDir = path.resolve(__dirname, '..')
const changelogPath = path.join(rootDir, 'CHANGELOG.md')

/**
 * Get current version from a file
 */
function getCurrentVersion(filePath, updateFunction) {
  if (updateFunction === updatePackageJson) {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    return content.version
  }
  else if (updateFunction === updateTauriConfig) {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    return content.version
  }
  else if (updateFunction === updateCargoToml) {
    const content = fs.readFileSync(filePath, 'utf8')
    const match = content.match(/^version\s*=\s*"([^"]+)"/m)
    return match ? match[1] : 'unknown'
  }
  return 'unknown'
}

async function main() {
  validateChangelogVersionAvailable(newVersion)

  // Files to update with their respective update functions
  const filesToUpdate = [
    {
      path: path.join(rootDir, 'package.json'),
      update: updatePackageJson,
      description: 'Root package.json',
    },
    {
      path: path.join(rootDir, 'src-tauri', 'tauri.conf.json'),
      update: updateTauriConfig,
      description: 'Tauri configuration',
    },
    {
      path: path.join(rootDir, 'src-tauri', 'Cargo.toml'),
      update: updateCargoToml,
      description: 'Cargo.toml',
    },
    {
      path: path.join(rootDir, 'src', 'renderer', 'package.json'),
      update: updatePackageJson,
      description: 'Renderer package.json',
    },
  ]

  let updatedFiles = 0
  const errors = []

  // Update each file
  for (const file of filesToUpdate) {
    try {
      if (fs.existsSync(file.path)) {
        console.log(`📝 ${isDryRun ? 'Would update' : 'Updating'} ${file.description}...`)
        if (!isDryRun) {
          file.update(file.path, newVersion)
        }
        else {
          // For dry run, just show what would be updated
          try {
            const currentVersion = getCurrentVersion(file.path, file.update)
            console.log(`   ${currentVersion} → ${newVersion}`)
          }
          catch {
            console.log(`   → ${newVersion}`)
          }
        }
        updatedFiles++
        console.log(`✅ ${isDryRun ? 'Would update' : 'Updated'} ${file.description}`)
      }
      else {
        console.log(`⚠️  File not found: ${file.path}`)
      }
    }
    catch (error) {
      const errorMsg = `Failed to update ${file.description}: ${error.message}`
      console.error(`❌ ${errorMsg}`)
      errors.push(errorMsg)
    }
  }

  if (errors.length === 0) {
    try {
      console.log(`📝 ${isDryRun ? 'Would update' : 'Updating'} CHANGELOG.md...`)
      const changelogEntry = await getChangelogEntry(newVersion, isDryRun)
      if (!isDryRun) {
        updateChangelog(changelogPath, newVersion, changelogEntry)
      }
      else {
        console.log(`   Would add CHANGELOG entry for ${newVersion}`)
      }
      updatedFiles++
      console.log(`✅ ${isDryRun ? 'Would update' : 'Updated'} CHANGELOG.md`)
    }
    catch (error) {
      const errorMsg = `Failed to update CHANGELOG.md: ${error.message}`
      console.error(`❌ ${errorMsg}`)
      errors.push(errorMsg)
    }
  }

  // Summary
  console.log('\n📊 Update Summary:')
  console.log(`✅ Successfully updated: ${updatedFiles} files`)
  if (errors.length > 0) {
    console.log(`❌ Errors: ${errors.length}`)
    errors.forEach(error => console.log(`   • ${error}`))
    process.exitCode = 1
  }
}

function validateChangelogVersionAvailable(version) {
  if (!fs.existsSync(changelogPath)) {
    throw new Error('CHANGELOG.md not found')
  }

  const changelogContent = fs.readFileSync(changelogPath, 'utf8')
  if (hasChangelogSection(changelogContent, version)) {
    throw new Error(`CHANGELOG.md already contains an entry for version ${version}`)
  }
}

/**
 * Update package.json version
 */
function updatePackageJson(filePath, version) {
  const content = fs.readFileSync(filePath, 'utf8')
  const packageJson = JSON.parse(content)
  
  const oldVersion = packageJson.version
  packageJson.version = version
  
  fs.writeFileSync(filePath, `${JSON.stringify(packageJson, null, 2)}\n`)
  console.log(`   ${oldVersion} → ${version}`)
}

/**
 * Update tauri.conf.json version
 */
function updateTauriConfig(filePath, version) {
  const content = fs.readFileSync(filePath, 'utf8')
  const config = JSON.parse(content)
  
  const oldVersion = config.version
  config.version = version
  
  fs.writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`)
  console.log(`   ${oldVersion} → ${version}`)
}

/**
 * Update Cargo.toml version
 */
function updateCargoToml(filePath, version) {
  let content = fs.readFileSync(filePath, 'utf8')
  
  // Extract current version
  const versionMatch = content.match(/^version\s*=\s*"([^"]+)"/m)
  const oldVersion = versionMatch ? versionMatch[1] : 'unknown'
  
  // Update version line
  content = content.replace(
    /^version\s*=\s*"[^"]+"/m,
    `version = "${version}"`,
  )
  
  fs.writeFileSync(filePath, content)
  console.log(`   ${oldVersion} → ${version}`)
}

async function getChangelogEntry(version, dryRun) {
  console.log('\n🗒️  Enter changelog notes for this version.')
  console.log('   Use Markdown. Press Enter on an empty line to finish.\n')

  if (dryRun) {
    console.log('   Dry run mode: changelog entry will not be written.')
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const lines = []

  try {
    while (true) {
      const line = await rl.question(lines.length === 0 ? '> ' : '')
      if (line.trim() === '') {
        break
      }
      lines.push(line)
    }
  }
  finally {
    rl.close()
  }

  if (lines.length === 0) {
    console.log('   No changelog text entered, using placeholder.\n')
    return '- No release notes provided.'
  }

  console.log('')
  return lines.join('\n')
}

function updateChangelog(filePath, version, entry) {
  const content = fs.readFileSync(filePath, 'utf8')

  if (hasChangelogSection(content, version)) {
    throw new Error(`CHANGELOG.md already contains an entry for version ${version}`)
  }

  const newSection = `## [${version}]\n\n${entry.trim()}\n\n`
  const unreleasedHeading = '## [Unreleased]'
  const unreleasedIndex = content.indexOf(unreleasedHeading)

  if (unreleasedIndex === -1) {
    throw new Error('CHANGELOG.md is missing the "## [Unreleased]" heading')
  }

  const insertPosition = content.indexOf('\n', unreleasedIndex)
  if (insertPosition === -1) {
    throw new Error('Unable to locate insertion point in CHANGELOG.md')
  }

  const updatedContent = `${content.slice(0, insertPosition + 1)}\n${newSection}${content.slice(insertPosition + 1)}`
  fs.writeFileSync(filePath, updatedContent)
  console.log(`   Added CHANGELOG entry for ${version}`)
}

function hasChangelogSection(content, version) {
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const headingRegex = new RegExp(`^## \\[${escapedVersion}\\]$`, 'm')
  return headingRegex.test(content)
}

main().catch((error) => {
  console.error(`❌ ${error.message}`)
  process.exit(1)
})
