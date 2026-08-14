# AGENTS.md

## Project

Flippio is a Tauri desktop app for inspecting and editing SQLite databases from Android devices and emulators, iOS simulators, physical iOS devices, and local files.

- Renderer: React 18, TypeScript, Chakra UI, Zustand, TanStack Query, AG Grid
- Backend: Tauri v2 and Rust
- Releases: tag-driven GitHub Actions in `.github/workflows/tauri-release.yml`

## Critical Workflow

The dependency chain is:

`device -> app -> database -> table -> rows -> selected row`

An upstream change invalidates downstream state. Refresh may preserve a selection only when the refreshed item still matches the active context. Late async results must never overwrite a newer selection.

Physical iOS scans are request-ID based and stream partial results. Preserve visible results during an in-context refresh, ignore stale events, and clear results when device or app context changes.

## Code Map

- `src/renderer/src/features/layout`: selection transitions and effects
- `src/renderer/src/components/layout`: device, app, database, and table controls
- `src/renderer/src/components/data`: grid and SQL UI
- `src/renderer/src/components/SidePanel`: row details and editing
- `src/renderer/src/hooks`: query and mutation orchestration
- `src/renderer/src/store`: Zustand state
- `src/renderer/src/tauri-api.ts`: frontend command bridge
- `src-tauri/src/commands/database`: SQLite and SQLCipher behavior
- `src-tauri/src/commands/device`: pull, scan, and push behavior
- `src-tauri/src/main.rs`: Tauri state and command registration
- `e2e`: WebdriverIO scenarios and helpers

## Change Rules

- Extend existing workflow boundaries. Do not duplicate selection, refresh, cache, or bridge logic.
- Keep desktop, Android, iOS simulator, and physical iOS modes explicit.
- Backend command changes must update command registration, bridge mapping, global types, mocks, and tests as applicable.
- New `window.api` methods usually require `src/renderer/src/test-utils/setup.ts` updates.
- Table and mutation changes must keep React Query state, `tableData`, selection state, and device push-back aligned.
- SQLCipher keys must not be logged or persisted. Cache identity must include credentials, and device sync must use the unlocked connection.
- Treat generated lockfiles and native project metadata as intentional changes; avoid unrelated formatting churn.
- Preserve unrelated user changes in a dirty worktree.

## Validation

Run the smallest relevant checks first:

```bash
npx eslint <changed-files...>
yarn typecheck
yarn test <optional-filter>
cargo test <optional-filter> --manifest-path src-tauri/Cargo.toml
```

Before a broad handoff, use:

```bash
yarn lint
yarn typecheck
yarn test
yarn test:rust
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
git diff --check
```

Known test noise: some React integration tests emit existing `act(...)` warnings while passing. Evaluate exit status and assertions.

## Agent Workflow

- Use CodeGraph first when `.codegraph/` exists and code relationships need investigation.
- Use `iteration-implementer` only for an explicit bounded plan.
- Use `structured-commit` for commit preparation and commit only after user approval.
- Keep review loops bounded: run one clean review and one correction pass. Stop after checks unless the user explicitly asks for another review round.
- Keep updates short, factual, and specific about checks, risks, and remaining work.

## Documentation

- User-facing setup and troubleshooting: `README.md`
- Developer setup and checks: `docs/guides/development-setup.md`
- Current architecture: `docs/guides/architecture-priorities.md`
- Release process: `docs/guides/build-and-deployment.md`
- E2E design and commands: `docs/guides/e2e.md`
