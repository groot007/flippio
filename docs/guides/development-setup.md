# Development Setup

## Purpose

Use this guide for the current local development workflow only. Architectural guidance belongs in `AGENTS.md`.

## Requirements

- Node.js 20+
- Rust stable
- Tauri CLI v2
- `npm install` at the repo root

Platform tools:

- macOS and iOS work: Xcode command line tools, `xcrun simctl`, bundled `libimobiledevice` binaries in `src-tauri/macos-deps`
- Android work: Android SDK platform tools with `adb` on `PATH`

## Install

```bash
npm install
```

Optional local verification:

```bash
node --version
cargo --version
cargo tauri --version
adb version
xcrun simctl list devices
```

## Core Commands

```bash
npm run tauri:dev
npm run tauri:build
npm run tauri:build:debug
npm run build:renderer
npm run test
npm run test:rust
npm run version:update -- 0.4.5
```

## Focused Validation

Use the smallest relevant checks first:

```bash
npx eslint <files...>
npm run build --prefix src/renderer
npm test
cargo test common --manifest-path src-tauri/Cargo.toml
```

Broader validation:

```bash
yarn lint
yarn typecheck
yarn test
yarn test:rust
```

## Test Fixtures

Generate or refresh SQLite fixtures with:

```bash
node scripts/generate-test-databases.js
```

The generated databases are used by backend tests under `src-tauri/tests/fixtures/databases`.
