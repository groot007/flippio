# AGENTS.md

## Purpose

Flippio is a Tauri desktop app for inspecting and editing SQLite databases from Android devices and emulators, iOS simulators, iOS physical devices, and local desktop files.

## Stack

- Frontend: React 18, TypeScript, Chakra UI, Zustand, TanStack Query, AG Grid
- Backend: Tauri v2, Rust commands in `src-tauri/src/commands`
- Release path: tag-driven GitHub Actions workflow in `.github/workflows/tauri-release.yml`

## Important Paths

- `src/renderer/src/components/layout`: top-level selectors and app controls
- `src/renderer/src/components/data`: grid, footer, SQL modal, and device UI
- `src/renderer/src/components/SidePanel`: row details and editing
- `src/renderer/src/hooks`: React Query orchestration and device/database flow
- `src/renderer/src/store`: Zustand selection and table state
- `src/renderer/src/utils`: shared frontend helpers
- `src/renderer/src/tauri-api.ts`: frontend bridge to Tauri commands
- `src-tauri/src/commands`: Rust command implementations
- `src-tauri/src/main.rs`: Tauri command registration
- `scripts/generate-test-databases.js`: test fixture generation
- `scripts/update-version.js`: coordinated version bump helper

## Application Flow

Typical workflow:
1. Select device
2. Select app or package
3. Load database files
4. Select database
5. Select table
6. View or edit rows
7. Push changes back to the device when required

Most regressions come from selection-reset-refetch sequencing. Keep device state, database state, and table state aligned.

## Repo Rules

- Prefer changing existing hooks, stores, and components over adding parallel logic.
- If you add a backend command, update all required integration points:
  - Rust command implementation
  - `src-tauri/src/main.rs`
  - `src/renderer/src/tauri-api.ts`
  - `src/renderer/src/types/global.d.ts`
- For table, export, or edit features, verify both the grid UI and the `tableData` store behavior.
- Physical iPhone flows rely on scan or request-id sequencing and event-driven updates. Do not simplify them casually.
- Frontend tests rely on mocked `window.api`; new bridge methods usually require updates in `src/renderer/src/test-utils/setup.ts`.

## Communication Style

- Default to caveman-style communication for agent updates and summaries:
  - short sentences
  - simple words
  - direct statements
  - no fluff
- Keep technical accuracy high even when wording is simple.
- If nuance matters, still explain it, but keep the phrasing plain and easy to scan.

## Agent Workflow

- For implementation, refactor, or iteration work requested by the user, default to the `iteration-implementer` skill workflow.
- Treat that as the standard path:
  - implementation by worker sub-agent when available
  - required checks
  - clean-context review
  - plan/checklist patching
  - structured commit handoff
- Do not skip that workflow unless the user clearly asks for a one-off answer, a tiny non-iterative change, or sub-agents are unavailable.
- For commit requests, default to the `structured-commit` skill.
- When the user asks to commit changes, prepare scope and message through `structured-commit` before performing the git commit.

## Commands

Use the smallest relevant checks first:

```bash
npx eslint <files...>
npm run build --prefix src/renderer
npm test
cargo test common --manifest-path src-tauri/Cargo.toml
```

Common full checks:

```bash
yarn lint
yarn typecheck
yarn test
yarn test:rust
```

Useful workflows:

```bash
npm run tauri:dev
npm run tauri:build
npm run tauri:build:debug
npm run version:update -- 0.4.5
node scripts/generate-test-databases.js
```

## Release Notes

- macOS release builds are handled by `.github/workflows/tauri-release.yml`.
- The workflow is tag-driven and reads release notes from `CHANGELOG.md`.
- Updater signing uses `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- Apple signing and notarization values come from GitHub Actions secrets, not ad hoc local scripts.

## Known Gotchas

- `eslint` may not be on PATH; use `npx eslint`.
- Vitest uses mocked Tauri internals.
- Some integration tests emit React `act(...)` warnings but still pass.
- If the Expo dev build in `example_app` shows a blank screen, run:

```bash
cd /Users/mykolastanislavchuk/Home/Flippio/example_app
npx expo start --no-dev --minify
```
