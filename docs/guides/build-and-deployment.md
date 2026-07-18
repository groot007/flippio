# Build And Deployment

## Local Builds

Current local commands:

```bash
npm run tauri:dev
npm run tauri:build
npm run tauri:build:debug
```

`src-tauri/tauri.conf.json` already wires the frontend build through `beforeDevCommand` and `beforeBuildCommand`, so there is no supported post-bundle script in the current workflow.

## Release Workflow

The supported release path is GitHub Actions:

- Workflow: `.github/workflows/tauri-release.yml`
- Trigger: git tags matching `v*`
- Release notes source: `CHANGELOG.md`
- Build target today: `universal-apple-darwin`

Before tagging a release:

```bash
npm run version:update -- 0.4.5
yarn lint
yarn typecheck
yarn test
yarn test:rust
```

Then create and push a tag:

```bash
git tag v0.4.5
git push origin v0.4.5
```

## Required Release Secrets

The active workflow expects these secrets:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `MAC_CERTIFICATE`
- `MAC_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`
- `VITE_POSTHOG_API_KEY`

## Updater Notes

- Auto-updater configuration lives in `src-tauri/tauri.conf.json`.
- Release signing is handled by the GitHub Actions workflow, not local helper scripts.
- If updater keys change, update the workflow secrets and the `plugins.updater.pubkey` value in `src-tauri/tauri.conf.json` together.

## What Was Removed

This repository no longer treats ad hoc local signing or notarization scripts as the canonical release path. If you need to change the release process, update the GitHub workflow and this guide together.
