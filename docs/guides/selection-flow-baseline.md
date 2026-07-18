# Selection Flow Baseline

Keep during the active refactor as the behavior baseline. After the core seam is stable, reevaluate whether to trim this into a shorter permanent architecture note.

## Scope

This baseline locks the first refactor slice to the primary selection path:

`device -> app -> database -> table`

The goal of this document is to record the current behavior before Iteration 1 adds the dedicated safety harness.

For the first seam:

- in scope:
  - core device-mode selection policy
- protected but deferred:
  - desktop-opened database mode
  - iPhone physical-device scan orchestration

## Active Files In Scope

Renderer orchestration:

- `src/renderer/src/components/layout/AppHeader.tsx`
- `src/renderer/src/components/layout/SubHeader.tsx`

Data adapters:

- `src/renderer/src/hooks/useApplications.ts`
- `src/renderer/src/hooks/useDatabaseFiles.ts`

Selection and table state:

- `src/renderer/src/store/useCurrentDeviceSelection.ts`
- `src/renderer/src/store/useCurrentDatabaseSelection.ts`
- `src/renderer/src/store/useTableData.ts`
- `src/renderer/src/store/useRowEditingStore.ts`

Relevant existing tests:

- `src/renderer/src/components/layout/__tests__/AppHeader.test.tsx`
- `src/renderer/src/components/layout/__tests__/SubHeader.test.tsx`
- `src/renderer/src/hooks/__tests__/useApplications.test.ts`
- `src/renderer/src/hooks/__tests__/useDatabaseFiles.test.ts`
- `src/renderer/src/__tests__/integration/main-user-flow.test.tsx`
- `src/renderer/src/__tests__/integration/component-integration.test.tsx`

## Current Ownership Model

- `AppHeader.tsx` currently owns:
  - device refresh
  - device reconciliation after refresh
  - application reconciliation after app fetch
  - downstream reset policy for missing device/app
  - device/app selection handlers
- `SubHeader.tsx` currently owns:
  - database file selection cleanup
  - table selection
  - custom desktop-file flow
  - database refresh behavior
  - table data reset in several branches
- Zustand stores are passive containers.
- React Query hooks fetch data but do not own cross-cutting transition policy.

This is the core architectural reason the first seam should be a `selection-session` module that owns transition policy only.

## Current Invariants

These are the behaviors that must not regress during the first refactor slices.

## Core Seam Invariants

### Device-level invariants

- Selecting a different device immediately:
  - preserves no downstream selection
  - clears selected application
  - clears selected database file
  - clears selected table
  - clears table data to the initial empty state
  - clears selected row
  - starts loading the application list for the newly selected device
- If the selected device disappears from the refreshed device list:
  - selected device is cleared
  - selected application is cleared
  - selected database file is cleared
  - selected table is cleared
  - table data is cleared
  - selected row is cleared
- If the selected device still exists after refresh but the object instance changed:
  - selected device is replaced with the refreshed device object

### Application-level invariants

- Application queries are keyed by device id and device type.
- Selecting a different application on the same device:
  - preserves selected device
  - clears selected database file
  - clears selected table
  - clears table data to the initial empty state
  - clears selected row
  - starts loading database files for the newly selected application
- On iPhone physical devices, selecting an application starts a new incremental database discovery run for that app.
- If the selected application disappears from the fetched application list:
  - selected application is cleared
  - selected database file is cleared
  - selected table is cleared
  - table data is cleared
  - selected row is cleared
- If the selected application still exists after refetch but the object instance changed:
  - selected application is replaced with the refreshed application object
- Recently used apps are device-scoped, not global.

### Database-file invariants

- Database-file queries require both selected device and selected application.
- Selecting a new database file:
  - preserves selected device
  - preserves selected application
  - sets the selected database file
  - clears selected table
  - clears table data
  - clears selected row
  - keeps the grid empty until a table is selected
  - triggers `window.api.switchDatabase` when a file path exists
- If the previously selected database file no longer exists after refresh:
  - selected database file is cleared
  - selected table is cleared
  - table data is cleared
  - selected row is cleared

### Table-level invariants

- Selecting a table:
  - immediately switches the grid into the newly selected table context
  - may briefly show loading internally, but usually not visibly
  - stores the selected table
  - if the user switches tables quickly, the newest selection must win and stale results must not overwrite the grid
- If no selected database file exists:
  - selected table is cleared
  - table data is cleared
  - selected row is cleared
- Clearing a custom SQL query returns the view to the selected table’s default rows.

### Refresh invariants

- Device refresh is orchestrated from `AppHeader.tsx`.
- Database refresh is orchestrated from `SubHeader.tsx`.
- If the current selection path is still valid after refresh:
  - preserve the current selection
  - replace it with refreshed matching objects where needed
  - refresh visible data
- If part of the selection path becomes invalid after refresh:
  - reset only from the invalid level downward
  - preserve higher valid levels
- On iPhone physical device database refresh:
  - selected table is cleared
  - selected database file is cleared
  - table data is cleared
  - selected row is cleared
  - scan flow restarts

## Protected But Deferred Edge Flows

These flows are important and must stay behaviorally correct, but they should not be absorbed into the first `selection-session` seam.

### Desktop-opened database mode

- Opening a desktop database file is a full mode switch:
  - selected device is cleared to placeholder
  - selected application is cleared to placeholder
  - selected database file becomes the opened desktop file
  - selected table is cleared
  - table data is cleared
  - selected row is cleared
- Desktop mode behaves like its own context until the user explicitly selects a device again.

### iPhone physical-device scan invariants

- iPhone device scans are keyed by `scanKey = deviceId:bundleId`.
- Each scan run also carries a unique `scanRequestId`.
- Progress events are accepted only when both:
  - `payload.scanKey === current scanKey`
  - `payload.scanRequestId === current active scanRequestId`
- Changing iPhone device/app context cancels the previous scan when possible.
- Refresh restarting discovery cancels the previous scan when possible.
- Late results from an old scan must be ignored and must not be merged into the current database list.
- The first `documents-root` phase marks first-round scan completion.

## Manual Regression Checklist

This is the fallback checklist to use alongside automated tests until the new safety harness exists.

- [ ] Selecting a device enables app loading for that device only.
- [ ] Changing the device clears stale app/table/row context.
- [ ] Refreshing devices preserves the same device/app/database when all still exist.
- [ ] Refreshing devices clears downstream state when the device disappears.
- [ ] Refreshing devices clears downstream state when the app disappears.
- [ ] Refreshing devices clears database/table/row state when the DB file disappears.
- [ ] Selecting an application enables database-file loading for that app only.
- [ ] Selecting a database file clears prior table and row context.
- [ ] Selecting a table loads that table and resets visible rows to the new table context.
- [ ] Opening a custom desktop database clears device/app context but keeps the desktop database active.
- [ ] iPhone physical-device scan does not mix old and new scan results after switching app/device.

## Existing Coverage Baseline

### Focused baseline suite run

Command:

```bash
npm test -- --run \
  src/renderer/src/components/layout/__tests__/AppHeader.test.tsx \
  src/renderer/src/components/layout/__tests__/SubHeader.test.tsx \
  src/renderer/src/hooks/__tests__/useApplications.test.ts \
  src/renderer/src/hooks/__tests__/useDatabaseFiles.test.ts \
  src/renderer/src/__tests__/integration/main-user-flow.test.tsx \
  src/renderer/src/__tests__/integration/component-integration.test.tsx
```

Result:

- passed
- 6 test files
- 47 tests

### Lint slice

Command:

```bash
npx eslint \
  src/renderer/src/components/layout/AppHeader.tsx \
  src/renderer/src/components/layout/SubHeader.tsx \
  src/renderer/src/hooks/useApplications.ts \
  src/renderer/src/hooks/useDatabaseFiles.ts \
  src/renderer/src/store/useCurrentDeviceSelection.ts \
  src/renderer/src/store/useCurrentDatabaseSelection.ts \
  src/renderer/src/store/useTableData.ts \
  src/renderer/src/store/useRowEditingStore.ts
```

Result:

- passed

## Current Test Gaps

These are the reasons Iteration 1 still needs a dedicated safety harness.

- Many current integration tests drive stores directly instead of driving the UI transition path.
- The current tests do not centralize selection transition policy as a contract table.
- There is no single seam test for:
  - `selectDevice`
  - `selectApplication`
  - `selectDatabase`
  - `refreshSelectionGraph`
  - `clearTableContext`
- Physical iPhone scan sequencing is only partially protected by current tests.
- Desktop-opened database mode is not yet isolated as a dedicated later seam.
- The focused suite emits existing React `act(...)` warnings, especially around modal and async UI updates.

## Recommendation For Iteration 1

Iteration 1 should add a dedicated safety harness that tests:

- user-driven selection transitions from the UI perspective
- selection state transitions from a contract/seam perspective
- deferred-flow guardrails for desktop mode and iPhone scan invalidation

That should happen before moving transition logic out of `AppHeader.tsx` and `SubHeader.tsx`.
