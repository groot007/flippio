# User Flow and Data Path

## Main Flow

```text
device -> app -> database file -> unlock/open -> table -> rows -> mutation -> device sync
```

Desktop files enter at `database file` and do not require a device or app.

## Renderer Responsibilities

- `AppHeader`: device and app selection
- `SubHeader`: database and table selection, refresh, SQL, open, and export
- `selectionSession`: transition and reconciliation policy
- `useDatabaseFiles`: database discovery and progressive physical-iOS scan state
- `useDatabaseTables`: database open and table discovery
- `useTableDataQuery`: row and column loading
- mutation hooks and `RowEditor`: writes, refresh, and push-back coordination
- Zustand stores: active selection, table data, and row editing state

An upstream selection change clears invalid state to its right. A refresh keeps a selection only when identity reconciliation finds the same item in the refreshed context.

## Tauri Boundary

The renderer calls `window.api`, implemented in `src/renderer/src/tauri-api.ts`. That layer validates inputs, maps commands and parameters, normalizes responses, and chooses device-specific push commands.

When adding or changing a command, review:

1. Rust implementation
2. Tauri registration
3. frontend command and parameter maps
4. global TypeScript API declarations
5. renderer test mocks
6. E2E scenario handlers

## Backend Responsibilities

- Database commands manage SQLite/SQLCipher pools, schemas, reads, writes, and change history.
- Android commands use ADB for discovery, pull, and push.
- iOS simulator commands work with simulator containers.
- Physical iOS commands discover app containers, stream scan progress, pull files, and push edits where permitted.

SQLCipher connections are keyed by path and credential identity. An active encrypted pool must survive idle cleanup and must be used to checkpoint a file before device sync.

## Refresh Rules

- Device or app change starts a new context and clears old database results.
- Physical iOS refresh keeps existing results visible and appends discoveries in place.
- Scan events with an old request ID are ignored.
- Database refresh preserves the selected table only if the database and table remain valid.
- A failed unlock or reopen cannot fall back to an older active pool.

## Mutation Rules

1. Resolve the active database file.
2. Write through the active database connection.
3. If device-backed, checkpoint and push the file with the platform-specific command.
4. Report local-write and push outcomes separately.
5. Refetch the active table and change history.

## Reading Order

1. `src/renderer/src/pages/Main.tsx`
2. `src/renderer/src/features/layout/selectionSession.ts`
3. `src/renderer/src/components/layout/AppHeader.tsx`
4. `src/renderer/src/components/layout/SubHeader.tsx`
5. `src/renderer/src/hooks/useDatabaseFiles.ts`
6. `src/renderer/src/tauri-api.ts`
7. `src-tauri/src/commands/database`
8. `src-tauri/src/commands/device`
