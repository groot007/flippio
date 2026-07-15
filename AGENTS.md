# AGENTS.md

## Flippio At A Glance

Flippio is a Tauri desktop app for inspecting and editing SQLite databases from:
- Android devices and emulators
- iOS simulators
- iOS physical devices
- local desktop database files

Frontend:
- React 18 + TypeScript
- Chakra UI
- Zustand for app state
- TanStack Query for async data
- AG Grid for table display/editing

Backend:
- Tauri v2
- Rust commands under `src-tauri/src/commands`

## Important Paths

- `src/renderer/src/components/layout`: top-level app controls like device/app/db selectors
- `src/renderer/src/components/data`: grid, footer, SQL modal, virtual device UI
- `src/renderer/src/components/SidePanel`: row details and row editing
- `src/renderer/src/hooks`: React Query hooks and UI-side orchestration
- `src/renderer/src/store`: Zustand stores for selections and table state
- `src/renderer/src/utils`: shared frontend helpers
- `src/renderer/src/tauri-api.ts`: frontend bridge to Tauri commands
- `src-tauri/src/commands`: Rust command implementations
- `src-tauri/src/main.rs`: Tauri command registration

## How The App Flows

Typical flow:
1. Select device
2. Select app/package
3. Load database files
4. Select database
5. Select table
6. View/edit rows
7. Push changes back to device when needed

When changing behavior, keep device state, database state, and table state in sync. Most regressions in this repo come from selection/reset/refetch sequencing.

## Working Rules For This Repo

- Prefer changing existing hooks/stores/components over adding parallel logic.
- If a new backend command is added, update all three places:
  - Rust command implementation
  - `src-tauri/src/main.rs`
  - `src/renderer/src/tauri-api.ts` and `src/renderer/src/types/global.d.ts`
- For table/export/edit features, check both the grid UI and the underlying `tableData` store behavior.
- For iPhone physical-device flows, expect scan/request-id logic and event-driven updates. Do not simplify that casually.
- Tests rely heavily on mocked `window.api`; if you add a new frontend API method, update test mocks.

## Validation

Use the smallest relevant checks first:

```bash
npx eslint <files...>
npm run build --prefix src/renderer
npm test
cargo test common --manifest-path src-tauri/Cargo.toml
```

Useful full checks:

```bash
yarn lint
yarn typecheck
yarn test
yarn test:rust
```

## Known Gotchas

- `eslint` may not be on PATH; use `npx eslint`.
- Vitest uses mocked Tauri internals. New API/event behavior often requires updates in `src/renderer/src/test-utils/setup.ts`.
- Some integration tests emit React `act(...)` warnings but still pass; treat test failures separately from existing warnings.
- There is also an `AGENT.md` note for Expo dev-build debugging in `example_app`. Keep it if working on the React Native example app.

## Example App Note

If the Expo dev build in `example_app` shows a blank screen, run:

```bash
cd /Users/mykolastanislavchuk/Home/Flippio/example_app
npx expo start --no-dev --minify
```
