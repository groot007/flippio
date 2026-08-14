# Build and Deployment

## Local Builds

```bash
npm run tauri:dev
npm run tauri:build
npm run tauri:build:debug
```

`src-tauri/tauri.conf.json` owns the renderer build hooks. Do not add a second post-bundle path unless the release workflow requires it.

## Release Gate

1. Update `CHANGELOG.md` for the exact release version.
2. Run `npm run version:update -- <version>`.
3. Review generated package, Cargo, and Tauri version changes.
4. Run lint, typecheck, frontend tests, Rust tests, and a production build.
5. Commit the release changes, then push a `v<version>` tag.

The workflow in `.github/workflows/tauri-release.yml` builds a universal macOS artifact, signs it, notarizes it, publishes the GitHub release, and includes updater metadata.

## Required Secrets

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `MAC_CERTIFICATE`
- `MAC_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`
- `VITE_POSTHOG_API_KEY`

The workflow also consumes the existing `FLIPPIO` secret when writing its build environment.

## Updater Contract

- Updater configuration and public key live in `src-tauri/tauri.conf.json`.
- Private signing keys live only in repository secrets.
- If signing keys rotate, update the workflow secrets and updater public key together.
- Release notes are extracted from the matching `CHANGELOG.md` section; a missing section fails the release.
