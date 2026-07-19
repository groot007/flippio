# Flippio Architecture Priorities

Last updated: July 19, 2026

## Purpose

This is the current architecture guide for Flippio.

It replaces the old iteration plan and selection baseline notes.

Use this document to keep product work aimed at the right targets:

- reliability first
- workflow clarity second
- performance at serious data scale third
- cosmetic polish after that

## Current Product Verdict

Flippio is already useful.

The product direction makes sense.

The stack also makes sense:

- Tauri for device, filesystem, and native integration
- React for UI composition
- React Query for fetch orchestration
- Zustand for app state
- Rust for database and device commands

The main issue is not the stack.

The main issue is orchestration across the critical user path:

`device -> app -> database -> table -> row -> write-back`

Today this path works through a mix of:

- multiple Zustand stores
- React Query state
- selection helper functions
- component-owned effects
- bridge calls
- event-driven iPhone scan updates

That creates real product value, but it also creates regression risk.

## Priority Order

### P0: Make Selection Session A First-Class Model

This is the highest-priority architecture change.

The selection path should become one explicit session model instead of being coordinated across:

- `useCurrentDeviceSelection`
- `useCurrentDatabaseSelection`
- `useTableData`
- `useRowEditingStore`
- `AppHeader.tsx`
- `SubHeader.tsx`
- selection helpers
- fetch hooks

Target outcome:

- one place owns transition policy
- one place defines what resets on each event
- invalid states are hard or impossible to represent
- refresh reconciliation is explicit
- desktop mode and device mode become explicit workflow states

Why this matters:

- biggest reliability gain
- biggest UX consistency gain
- biggest reduction in future refactor risk

Risk of change:

- high

Expected payoff:

- very high

### P1: Reduce Manual Bridge Complexity

The Tauri bridge is useful but too manual.

The frontend command layer currently owns:

- command name mapping
- parameter name mapping
- retry behavior
- response reshaping
- frontend API compatibility behavior

Target outcome:

- move toward a typed command contract
- reduce stringly-typed command wiring
- reduce drift between Rust commands, frontend bridge, global types, and test mocks

Why this matters:

- easier backend changes
- fewer integration bugs
- clearer command ownership

Risk of change:

- medium

Expected payoff:

- high

### P1: Build For Large Tables And Real Device Workloads

Flippio must behave like a serious data tool, not only a small-table viewer.

Current risk areas:

- large client bundle
- full row loading into the renderer
- expensive client-side sizing and rendering assumptions
- refresh and push-back work coupled directly to UI flows

Target outcome:

- define a large-table strategy
- measure real data size limits
- page or stream where needed
- avoid full-grid work when not needed
- make sync and refresh costs visible

Why this matters:

- performance is part of trust
- heavy data workflows reveal architecture weaknesses fast

Risk of change:

- medium

Expected payoff:

- high

### P2: Strengthen User Trust Cues

The UI is understandable.

The bigger issue is that the app often knows more than it shows.

Users need clearer signals for:

- where the current database comes from
- whether data is local-only or device-backed
- whether a scan is partial, active, or finished
- whether edits are saved locally only or pushed back
- whether the current selection is stale, refreshed, or invalid

Target outcome:

- stronger state messaging
- clearer sync status
- fewer silent background transitions
- safer mutation UX

Risk of change:

- low to medium

Expected payoff:

- medium to high

### P3: Visual Polish And Secondary Flows

Visual cleanup matters, but it is not the core issue right now.

Do not prioritize broad styling work over workflow hardening.

Risk of change:

- low

Expected payoff:

- moderate

## What Must Stay True

These are the core product rules.

Any architecture work should preserve them.

### Selection Rules

- Changing device clears invalid downstream selection.
- Changing app clears invalid downstream database, table, row, and grid state.
- Changing database clears invalid table, row, and grid state.
- Refresh should preserve valid higher-level context and reset only from the invalid point downward.
- Fast switching must not let stale results overwrite the newest context.

### Device Rules

- Android, iOS simulator, iPhone physical device, and desktop-opened DB flows are different modes.
- Those modes should stay explicit in the architecture.
- iPhone scan flow must ignore late results from old scan context.
- Pull/push behavior must stay traceable and predictable.

### Editing Rules

- A user should always understand whether a mutation changed:
  - local temp copy only
  - active device-backed database
  - pushed-back device state
- Refresh after write must be predictable.
- Change history should match the active context.

## Current Architecture Risks

### 1. Split State Ownership

The most important workflow state is split across multiple stores and component effects.

Risk:

- hard-to-debug regressions
- stale state races
- hidden invalid states

### 2. Component-Owned Transition Policy

`AppHeader.tsx` and `SubHeader.tsx` still own too much workflow logic.

Risk:

- poor locality
- high churn in top-level UI files
- harder UI redesign later

### 3. Manual Command Contract

The bridge is not unsafe by default, but it is expensive to maintain.

Risk:

- integration drift
- repeated boilerplate
- slower feature delivery

### 4. Incomplete Trust-Surface Test Coverage

The repo has many passing tests, but weak coverage remains in critical trust surfaces like:

- footer behavior
- change history UI
- mutation coordination
- context-key paths
- some workflow utility layers

Risk:

- refactors feel safe until user-facing coordination changes

### 5. Performance Not Yet Proven Under Heavy Scale

The app likely performs well on moderate data.

It is not yet proven as a heavy-duty data explorer for large SQLite tables on real devices.

Risk:

- delayed performance pain
- UX degradation under real-world workload

## Recommended Execution Order

### 1. Formalize Selection Session

Do first.

Suggested direction:

- introduce one session object or reducer for the active workflow
- define explicit events
- define explicit resets and reconciliation rules
- keep device mode differences explicit

### 2. Move Component Logic Behind That Session

After the session model exists:

- keep `AppHeader.tsx` mostly as a view and event source
- keep `SubHeader.tsx` mostly as a view and event source
- keep component effects narrow

### 3. Clean Up Bridge Contract

After the main workflow model is clearer:

- reduce command mapping drift
- strengthen types
- simplify test mocking shape

### 4. Add Performance Guardrails

After correctness work starts landing:

- define acceptable row-count and latency targets
- measure large-table loading
- measure push-back cost by device type
- split or lazy-load large frontend areas where useful

### 5. Polish Trust UX

After correctness and performance are more stable:

- improve status labels
- improve source and sync visibility
- improve mutation feedback

## What Not To Do

- Do not start with a pure UI restyle.
- Do not split the selection workflow into more small helper modules without first deepening the ownership model.
- Do not add more manual bridge compatibility layers unless there is no alternative.
- Do not treat desktop mode and iPhone physical-device scanning as small edge cases. They are core product complexity.

## Files To Watch Closely

These files sit on or near the critical path:

- `src/renderer/src/components/layout/AppHeader.tsx`
- `src/renderer/src/components/layout/SubHeader.tsx`
- `src/renderer/src/features/layout/selectionSession.ts`
- `src/renderer/src/features/layout/useSelectionSessionActions.ts`
- `src/renderer/src/hooks/useDatabaseFiles.ts`
- `src/renderer/src/hooks/useDatabaseTables.ts`
- `src/renderer/src/hooks/useTableDataQuery.ts`
- `src/renderer/src/store/useCurrentDeviceSelection.ts`
- `src/renderer/src/store/useCurrentDatabaseSelection.ts`
- `src/renderer/src/store/useTableData.ts`
- `src/renderer/src/store/useRowEditingStore.ts`
- `src/renderer/src/tauri-api.ts`
- `src-tauri/src/main.rs`
- `src-tauri/src/commands/database/commands.rs`
- `src-tauri/src/commands/database/connection_manager.rs`
- `src-tauri/src/commands/device/ios/database.rs`

## Success Criteria

Flippio moves closer to top-tier quality when:

- selection and refresh behavior become easier to reason about
- stale-state bugs become harder to introduce
- device sync behavior becomes clearer to users
- large-data workflows stay responsive
- backend/frontend command changes require less manual synchronization
- top-level UI files become thinner and more stable

## Related Documents

- `docs/flippio-architecture-audit-2026-07-19.html`
- `AGENTS.md`
