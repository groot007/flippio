# Architecture Priorities

## System Shape

Flippio has four explicit operating modes: desktop file, Android, iOS simulator, and physical iOS device. They share database UI but differ in discovery, file ownership, refresh, and push-back behavior.

The renderer owns workflow state and orchestration. Rust owns device access, filesystem work, SQLite/SQLCipher connections, and native commands. `window.api` is the contract between them.

## Invariants

- Selection follows `device -> app -> database -> table -> rows -> selected row`.
- Upstream changes clear invalid downstream state.
- Refresh preserves valid context and ignores late results from older requests.
- Physical iOS results stream progressively and are scoped by scan request ID.
- A mutation is complete only when local state and required device push-back have a clear outcome.
- SQLCipher access is credential-aware; keys are not logged or persisted.

## Current Priorities

### 1. Typed command contract

Reduce drift between Rust signatures, command registration, frontend mappings, global types, and mocks. Prefer generated or shared contracts over new stringly typed compatibility layers.

### 2. Large-table behavior

Measure row-count, memory, and latency limits. Add pagination or streaming before full-table loading becomes a user-facing reliability problem.

### 3. Sync trust

Show whether a database is local, pulled, refreshing, modified, or successfully pushed. Errors must distinguish local write success from device sync failure.

### 4. Critical-path coverage

Keep regression tests around selection reconciliation, progressive iOS scans, mutation push-back, SQLCipher lifecycle, and command mapping.

## Change Guidance

- Put transition policy in `src/renderer/src/features/layout`, not ad hoc component effects.
- Keep query orchestration in hooks and durable UI selection in stores.
- Keep backend connection lifecycle in `src-tauri/src/commands/database`.
- Do not hide platform differences behind assumptions that only fit one device type.
- Avoid broad formatting or generated-file churn in functional commits.

## Files with High Blast Radius

- `src/renderer/src/features/layout/selectionSession.ts`
- `src/renderer/src/components/layout/AppHeader.tsx`
- `src/renderer/src/components/layout/SubHeader.tsx`
- `src/renderer/src/hooks/useDatabaseFiles.ts`
- `src/renderer/src/hooks/useDatabaseTables.ts`
- `src/renderer/src/hooks/useTableDataQuery.ts`
- `src/renderer/src/tauri-api.ts`
- `src-tauri/src/commands/database`
- `src-tauri/src/commands/device`
- `src-tauri/src/main.rs`
