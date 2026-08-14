# Development Setup

## Prerequisites

- Node.js 20+
- Rust stable
- Tauri v2 prerequisites for macOS
- Xcode command-line tools for iOS work
- Android SDK Platform Tools with `adb` on `PATH` for Android work

Install dependencies from the repository root:

```bash
npm install
```

## Run and Build

```bash
npm run tauri:dev
npm run tauri:build
npm run tauri:build:debug
npm run build:renderer
```

The Tauri configuration starts and builds the renderer automatically for desktop commands.

## Validation

Start with changed-file and focused tests:

```bash
npx eslint <changed-files...>
yarn typecheck
yarn test <optional-filter>
cargo test <optional-filter> --manifest-path src-tauri/Cargo.toml
```

Full local gate:

```bash
yarn lint
yarn typecheck
yarn test
yarn test:rust
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
git diff --check
```

Example-app tests run separately:

```bash
cd example_app
npx jest --watchAll=false --runInBand --watchman=false
```

## Fixtures and Versions

```bash
node scripts/generate-test-databases.js
npm run version:update -- <version>
```

The version helper updates coordinated package and Tauri version files. Review every generated diff before staging it.
