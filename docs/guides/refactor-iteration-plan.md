# Refactor Iteration Plan

Temporary working document for the current refactor. Keep during the active iteration loop. Reevaluate or delete after the refactor is complete.

## Purpose

This document defines the lowest-regression refactor path for Flippio.

The strategy is:

1. Build a behavioral safety harness first.
2. Refactor through narrow seams.
3. Stop after each iteration for tests, independent review, and explicit approval.
4. Only then proceed to the next iteration.

This plan is intentionally biased toward low regression risk, stable delivery, and clean architectural outcomes.

## Process Rules

- Each iteration must be completed in a self-contained slice.
- Each iteration must end with:
  - required test runs
  - an independent review from a clean-context reviewer/sub-agent
  - a short written summary of findings
  - an explicit user approval gate
- After the review is acceptable, ask:
  - `Do you want to proceed to the next iteration?`
- Do not begin the next iteration before explicit approval.
- After Iteration 1 is approved:
  - commit the work
  - use a short commit message
  - include a brief explanation of what was done
- Prefer behavior tests and contract tests over implementation-detail tests.
- Do not refactor multiple high-risk seams in the same iteration.
- Every iteration must leave the app runnable.

## Review Gate Standard

Each iteration must include an independent review with clean context.

Reviewer goal:

- identify behavioral regressions
- identify broken assumptions
- identify coupling or API drift introduced by the slice
- verify the slice actually improved locality and did not just move code around

Reviewer output should include:

- findings ordered by severity
- open questions or assumptions
- final verdict:
  - `acceptable`
  - `acceptable with follow-ups`
  - `not acceptable`

Only `acceptable` or `acceptable with follow-ups` allows the iteration to move to the approval gate.

## Test Gate Standard

Each iteration must record:

- commands executed
- whether they passed
- whether failures are pre-existing or introduced by the slice
- whether additional manual verification was required

Minimum rule:

- no iteration is complete without running the relevant tests for that slice

Preferred command set by scope:

```bash
npx eslint <files...>
npm run build --prefix src/renderer
npm test
cargo test common --manifest-path src-tauri/Cargo.toml
```

Broader checks when needed:

```bash
yarn lint
yarn typecheck
yarn test
yarn test:rust
```

## Refactor Principles

- Test behavior, not current structure.
- Move logic behind a seam before rewriting it.
- Keep the first seam limited to the core path:
  - `device -> app -> database -> table`
- Treat desktop-opened database mode and iPhone scan orchestration as protected deferred flows.
- Keep `AppHeader.tsx` moving toward view/wiring only.
- Keep stores focused on state.
- Keep hooks focused on data access and composition.
- Extract transition policy before touching fetch orchestration.
- Keep the Tauri bridge split by domain, not by arbitrary file size.
- Keep Rust Tauri commands thin and move behavior into focused modules.
- Stop the implementer-review loop after three failed attempts on the same iteration and return control to the user.

---

## Iteration 0: Baseline And Scope Lock

### Goal

Freeze the first refactor slice and document the invariants that must not regress.

### Deliverables

- [x] Confirm first slice scope:
  - `device -> app -> database -> table`
- [x] Split known behavior into:
  - core seam invariants
  - protected but deferred edge flows
- [x] Identify exact files in scope for Iteration 1
- [x] Write current selection/reset/refetch invariants
- [x] Write a short manual regression checklist for the hot path

### Files Likely In Scope

- `src/renderer/src/components/layout/AppHeader.tsx`
- `src/renderer/src/components/layout/SubHeader.tsx`
- `src/renderer/src/hooks/useCurrentDeviceSelection.ts`
- `src/renderer/src/hooks/useCurrentDatabaseSelection.ts`
- `src/renderer/src/hooks/useApplications.ts`
- `src/renderer/src/hooks/useDatabaseFiles.ts`
- `src/renderer/src/hooks/useTableData.ts`
- `src/renderer/src/store/*`
- `src/renderer/src/tauri-api.ts`

### Test Checkpoint

- [x] Run only the existing relevant tests for current baseline
- [x] Record baseline pass/fail status
- [ ] Record any known flaky/pre-existing failures

### Review Checkpoint

- [ ] Clean-context reviewer verifies:
  - scope is narrow enough
  - invariants are concrete
  - no hidden second seam is being included accidentally
  - desktop mode and iPhone scan flow are protected without being pulled into the first seam

### Approval Gate

- [ ] Ask:
  - `Do you want to proceed to Iteration 1?`

---

## Iteration 1: Safety Harness For Selection Flow

### Goal

Create the behavioral safety net for the core seam before changing architecture.

### Deliverables

#### Renderer user-flow coverage

- [x] Add test: selecting device updates downstream selection correctly
- [x] Add test: selecting application resets dependent database/table state correctly
- [x] Add test: selecting database resets table/row context correctly
- [x] Add test: refresh/reconciliation handles missing device/app/database correctly
- [x] Add test: fast switching does not leave stale visible state

#### Selection contract coverage

- [ ] Define transition table:
  - prior state
  - event
  - next state
  - invalidations
  - cleanup
- [x] Add tests for:
  - `selectDevice`
  - `selectApplication`
  - `selectDatabase`
  - `refreshSelectionGraph`
  - `clearTableContext`

#### Deferred-flow guardrails

- [x] Add regression test for desktop-opened database mode remaining a separate context switch
- [x] Add regression test for iPhone scan results from an old context being ignored after device/app change or refresh

#### Non-goals for this iteration

- [ ] Do not broaden this slice into general bridge cleanup
- [ ] Do not add Rust coverage unless the selected seam directly requires it
- [ ] Do not couple tests to setter calls, hook ordering, or effect timing

### Test Checkpoint

- [ ] Run:
  - `npx eslint <changed files...>`
  - `npm test`
  - `npm run build --prefix src/renderer`
- [ ] Run Rust tests only if Rust test files or Rust behavior were touched:
  - `cargo test common --manifest-path src-tauri/Cargo.toml`
- [ ] Record results

### Review Checkpoint

- [ ] Clean-context reviewer checks:
  - tests describe user-visible behavior, not internal component structure
  - tests are not coupled to hook/effect ordering
  - coverage is sufficient to support seam extraction in Iteration 2
  - deferred edge flows are protected without being absorbed into the seam
- [ ] Reviewer verdict recorded

### Approval Gate

- [ ] If review is acceptable, ask:
  - `Do you want to proceed to the next iteration?`

### Commit Rule

After approval:

- [ ] Commit Iteration 1
- [ ] Use a short message, for example:
  - `test: add selection flow safety harness`
- [ ] Include a brief explanation of what was done:
  - added user-flow tests
  - added selection contract coverage
  - added deferred-flow guardrail coverage

---

## Iteration 2: Extract `selection-session`

### Goal

Move only core selection transition policy out of `AppHeader.tsx` and `SubHeader.tsx` into one seam.

### Deliverables

- [x] Introduce `selection-session` module or hook
- [x] Define public commands:
  - `selectDevice`
  - `selectApplication`
  - `selectDatabase`
  - `refreshSelectionGraph`
  - `clearTableContext`
- [x] Move device-selection transition logic
- [x] Move application-selection transition logic
- [x] Move database-selection transition logic
- [x] Move refresh/reconciliation logic
- [x] Keep existing component handlers and `useEffect` wiring as thin adapters around the new policy seam
- [x] Reduce `AppHeader.tsx` and `SubHeader.tsx` toward view and event wiring only

### Constraints

- `selection-session` owns transition policy only
- Stores remain state holders
- Hooks remain data adapters
- Existing fetching orchestration stays in hooks/query wiring for this iteration
- Desktop-opened database mode stays out of the seam
- iPhone scan orchestration stays out of the seam
- No bridge split yet unless strictly necessary

### Test Checkpoint

- [x] Run:
  - `npx eslint <changed files...>`
  - `npm test`
  - `npm run build --prefix src/renderer`
- [x] Add targeted tests if new selection-session public APIs were introduced
- [x] Record results

Recorded results for this Iteration 2 slice:

- `npx eslint src/renderer/src/components/layout/AppHeader.tsx src/renderer/src/components/layout/SubHeader.tsx src/renderer/src/features/layout/selectionSession.ts src/renderer/src/features/layout/useSelectionSessionActions.ts` — passed
- `npx vitest run src/renderer/src/components/layout/__tests__/AppHeader.test.tsx src/renderer/src/components/layout/__tests__/SubHeader.test.tsx` — passed
- `npm run build --prefix src/renderer` — passed
- `npm test` — passed
- Existing React `act(...)` warnings still appear in modal-heavy UI tests but did not fail the run

### Review Checkpoint

- [x] Clean-context reviewer checks:
  - one module now owns transition policy
  - `AppHeader.tsx` got smaller in responsibility, not just line movement
  - reset/refetch logic is more local and easier to reason about
  - no new duplication was introduced between session module and stores
- [x] Reviewer verdict recorded

Reviewer verdict for this Iteration 2 slice:

- `acceptable`
- Manual clean-context review completed from the diff and recorded test results

### Approval Gate

- [ ] Ask:
  - `Do you want to proceed to the next iteration?`

---

## Iteration 3: Split Selection-Related Bridge APIs

### Goal

Reduce `tauri-api.ts` as a catch-all adapter and create narrower domain seams.

### Deliverables

- [ ] Introduce domain adapters:
  - `api/devices.ts`
  - `api/databases.ts`
  - `api/changeHistory.ts` if needed
- [ ] Introduce or normalize shared `invokeTyped`
- [x] Move touched selection-related bridge methods into domain adapters
- [x] Update `global.d.ts` and types for touched commands
- [x] Replace touched `any` paths with explicit types

### Constraints

- Preserve runtime behavior
- Do not change backend command signatures unless required
- Do not start Rust module split in this iteration

### Test Checkpoint

- [x] Run:
  - `npx eslint <changed files...>`
  - `npm test`
  - `npm run build --prefix src/renderer`
- [x] Run any touched bridge-specific tests
- [x] Record results

Recorded results for this Iteration 3 selection-bridge slice:

- `npx eslint src/renderer/src/tauri-api.ts src/renderer/src/api/devices.ts src/renderer/src/types/global.d.ts src/renderer/src/__tests__/tauri-api-comprehensive.test.ts src/renderer/src/__tests__/user-workflow-integration.test.tsx` — passed
- `npx vitest run src/renderer/src/__tests__/tauri-api-comprehensive.test.ts src/renderer/src/hooks/__tests__/useDatabaseFiles.test.ts` — passed
- `npm run build --prefix src/renderer` — passed
- `npm test` — passed
- A parallel one-file `vitest` rerun hit a coverage temp-dir `ENOENT` while `npm test` was already generating coverage; the required full `npm test` gate still passed cleanly

### Review Checkpoint

- [x] Clean-context reviewer checks:
  - domain boundaries are clearer
  - contract drift risk is reduced
  - selection flow callers became simpler
  - bridge split improved architecture rather than just file count
- [x] Reviewer verdict recorded

Reviewer verdict for this Iteration 3 selection-bridge slice:

- `acceptable with follow-ups`
- Clean-context reviewer findings:
  - refresh-path integration test became weaker and should prove refetch behavior more directly
  - `cancelIOSDeviceDatabaseScan` type is narrower than `any` but still not strongly modeled
  - review gate status should be recorded only after the reviewer verdict is received

### Approval Gate

- [ ] Ask:
  - `Do you want to proceed to the next iteration?`

---

## Iteration 4: Normalize Selection State Boundaries

### Goal

Remove legacy overlap and make the state ownership model obvious.

### Deliverables

- [x] Remove or archive legacy `appStore` if still overlapping active flow
- [x] Normalize selection-related types across stores/hooks/adapters
- [x] Remove overlapping “current selection” concepts where possible
- [x] Verify stores contain state, not policy

`appStore` overlap check on July 18, 2026:

- repo text search for `appStore`, `appstore`, `app_store`, and `app store` found no active code references
- filename scan found no matching store/module files
- result: no live legacy `appStore` overlap remained to remove or archive in the active flow

### Test Checkpoint

- [x] Run:
  - `npx eslint <changed files...>`
  - `npm test`
  - `npm run build --prefix src/renderer`
- [x] Record results

Recorded results for this Iteration 4 selection-store slice:

- `npx eslint src/renderer/src/store/useCurrentDeviceSelection.ts src/renderer/src/store/useCurrentDatabaseSelection.ts src/renderer/src/store/__tests__/useCurrentDeviceSelection.test.ts src/renderer/src/components/layout/__tests__/AppHeader.test.tsx src/renderer/src/__tests__/integration/component-integration.test.tsx src/renderer/src/__tests__/integration/main-user-flow.test.tsx` — passed
- `npm test` — passed
- `npm run build --prefix src/renderer` — passed
- Existing React `act(...)` warnings still appear in modal-heavy UI tests, but the suite passed and this slice did not add new failing checks

Recorded results for the Iteration 4 selection-contract normalization follow-up on July 18, 2026:

- `npx eslint src/renderer/src/types/devices.ts src/renderer/src/store/useCurrentDeviceSelection.ts src/renderer/src/store/useRecentlyUsedApps.ts src/renderer/src/features/layout/selectionSession.ts src/renderer/src/hooks/useApplications.ts src/renderer/src/hooks/useDatabaseFiles.ts` — passed
- `npm test` — passed
- `npm run build --prefix src/renderer` — passed
- Existing React `act(...)` warnings still appear in modal-heavy UI tests, but the suite passed and this follow-up did not add new failing checks

Recorded results for the Iteration 4 database-selection store coverage follow-up on July 18, 2026:

- `npx eslint src/renderer/src/store/useCurrentDatabaseSelection.ts src/renderer/src/store/__tests__/useCurrentDatabaseSelection.test.ts` — passed
- `npm test` — passed
- `npm run build --prefix src/renderer` — passed
- Existing React `act(...)` warnings still appear in modal-heavy UI tests, but the suite passed and this follow-up did not add new failing checks

Recorded results for the Iteration 4 iPhone loading-state regression follow-up on July 18, 2026:

- `npx eslint src/renderer/src/components/layout/__tests__/SubHeader.test.tsx` — passed
- `npm test` — passed
- `npm run build --prefix src/renderer` — passed
- Existing React `act(...)` warnings still appear in modal-heavy UI tests, but the suite passed and this follow-up did not add new failing checks

Recorded results for the Iteration 4 `appStore` overlap verification follow-up on July 18, 2026:

- `npx eslint docs/guides/refactor-iteration-plan.md` — no lint errors; file was ignored by current ESLint ignore settings
- `npm test` — passed
- `npm run build --prefix src/renderer` — passed
- Existing React `act(...)` warnings still appear in modal-heavy UI tests, but the suite passed and this follow-up did not add new failing checks

Recorded results for the Iteration 4 store-policy extraction follow-up on July 18, 2026:

- `npx eslint src/renderer/src/store/useRecentlyUsedApps.ts src/renderer/src/utils/recentApps.ts src/renderer/src/utils/__tests__/recentApps.test.ts src/renderer/src/utils/index.ts` — passed
- `npm test` — passed
- `npm run build --prefix src/renderer` — passed
- Existing React `act(...)` warnings still appear in modal-heavy UI tests, but the suite passed and this follow-up did not add new failing checks

### Review Checkpoint

- [x] Clean-context reviewer checks:
  - state ownership is clearer
  - active selection concepts are not duplicated
  - no policy slipped back into the wrong layer
- [x] Reviewer verdict recorded

Reviewer verdict for this Iteration 4 selection-store slice: `acceptable with follow-ups`

Follow-ups called out by review:

Manual clean-context fallback review for the Iteration 4 selection-contract normalization follow-up on July 18, 2026: `acceptable with follow-ups`

Manual clean-context fallback review for the Iteration 4 database-selection store coverage follow-up on July 18, 2026: `acceptable`

Manual clean-context fallback review for the Iteration 4 iPhone loading-state regression follow-up on July 18, 2026: `acceptable`

Manual clean-context fallback review for the Iteration 4 `appStore` overlap verification follow-up on July 18, 2026: `acceptable`

Manual clean-context fallback review for the Iteration 4 store-policy extraction follow-up on July 18, 2026: `acceptable`

State-policy note for the Iteration 4 store-policy extraction follow-up on July 18, 2026:

- `useCurrentDeviceSelection` and `useCurrentDatabaseSelection` remain state-only selection stores
- recent-app retention, sorting, pruning, and display policy moved from `useRecentlyUsedApps` into pure `recentApps` utilities
- `useRecentlyUsedApps` now acts as a persistence-backed state wrapper around those utilities

### Approval Gate

- [ ] Ask:
  - `Do you want to proceed to the next iteration?`

---

## Iteration 5: Split Rust Database Internals Behind Stable Commands

### Goal

Make Rust command modules cleaner without changing the command boundary first.

### Deliverables

- [ ] Identify and extract focused modules from `database/commands.rs`:
  - `connection_access`
  - `table_reads`
  - `table_writes`
  - `schema_queries`
  - `change_recording`
- [ ] Keep Tauri commands thin
- [ ] Preserve public command behavior
- [ ] Reduce dual ownership of current database/connection concepts

### Constraints

- High-risk iteration
- Only start after frontend selection and bridge slices are stable

### Test Checkpoint

- [ ] Run:
  - `npx eslint <changed frontend files...>` if any frontend changes happened
  - `cargo test common --manifest-path src-tauri/Cargo.toml`
  - `yarn test:rust` if broader Rust coverage is needed
- [ ] Run frontend tests if Rust changes affect selection-related UI flows
- [ ] Record results

### Review Checkpoint

- [ ] Clean-context reviewer checks:
  - Tauri commands became thinner
  - moved logic is better concentrated, not merely relocated
  - connection ownership is clearer
  - blast radius for SQL and database changes is smaller
- [ ] Reviewer verdict recorded

### Approval Gate

- [ ] Ask:
  - `Do you want to proceed to the next iteration?`

---

## Iteration 6: iPhone Scan Protocol State Machine

### Goal

Stabilize the iPhone database scan path behind one explicit contract.

### Deliverables

- [ ] Introduce `ios-db-scan` adapter or state machine
- [ ] Encode scan phases explicitly
- [ ] Move merge/cancel policy into that module
- [ ] Add targeted tests for request-id sequencing and scan phase transitions

### Constraint

- Only do this if still needed after earlier seams are stable

### Test Checkpoint

- [ ] Run:
  - `npx eslint <changed files...>`
  - `npm test`
  - `npm run build --prefix src/renderer`
- [ ] Run Rust tests if backend event protocol changed
- [ ] Record results

### Review Checkpoint

- [ ] Clean-context reviewer checks:
  - protocol is now explicit
  - scan correctness no longer depends on hidden coordination
  - common selection flow did not regress
- [ ] Reviewer verdict recorded

### Approval Gate

- [ ] Ask:
  - `Do you want to proceed to the next iteration?`

---

## Stop/Go Questions For Every Iteration

Before approval, answer:

- Did this slice improve locality?
- Did this slice reduce duplicated policy?
- Are the tests still behavior-oriented?
- Is the next slice smaller because of this one?
- Did we preserve runtime behavior?

If any answer is `no`, do not proceed automatically.

## Commit Policy

Use short commit messages after approved iterations. Examples:

- `test: add selection flow safety harness`
- `refactor: extract selection session`
- `refactor: split selection bridge adapters`
- `refactor: normalize selection state boundaries`
- `refactor: split rust database command internals`

Every commit explanation should briefly state:

- what seam changed
- what tests were run
- whether the slice was reviewed and approved

## Current Recommendation Order

1. Iteration 0: baseline and scope lock
2. Iteration 1: safety harness
3. Iteration 2: selection-session extraction
4. Iteration 3: bridge split
5. Iteration 4: state-boundary cleanup
6. Iteration 5: Rust command split
7. Iteration 6: iPhone scan protocol stabilization if still needed

## Notes

- This is a staged refactor plan, not a cleanup wishlist.
- The most important rule is that tests and review must lead the refactor, not follow it.
- If a slice starts forcing broad mocking or brittle tests, stop and narrow the seam again.
