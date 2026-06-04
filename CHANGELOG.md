# Changelog

All notable changes to this project should be documented in this file.

The release workflow publishes the section matching the git tag version from this file.
For example, tag `v0.4.1` publishes the `## [0.4.1]` section as the GitHub release body and updater changelog.

## [Unreleased]

## [0.4.2]

fix changelog modal


## [0.4.1]

added the changelog modal
set dark theme as a default


- No unreleased notes yet.

## [0.4.0]

### Added

- In-app update flow with release note support.
- Post-update changelog modal shown after restart.
- Theme switcher in Settings with explicit light and dark icons.

### Changed

- Default theme now starts in dark mode for fresh installs.
- iOS bundled tool validation now prefers launchable bundled binaries over broken system installs.
- Update metadata lookup degrades safely when release updater artifacts are missing.
- AG Grid row selection updated to the current API shape.
