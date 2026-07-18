# Refactor Iteration Plan

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
- Keep `AppHeader.tsx` moving toward view/wiring only.
- Keep stores focused on state.
- Keep hooks focused on data access and composition.
- Keep the Tauri bridge split by domain, not by arbitrary file size.
- Keep Rust Tauri commands thin and move behavior into focused modules.

---

## Iteration 0: Baseline And Scope Lock

### Goal

Freeze the first refactor slice and document the invariants that must not regress.

### Deliverables

- [ ] Confirm first slice scope:
  - `device -> app -> database -> table`
- [ ] Identify exact files in scope for Iteration 1
- [ ] Write current selection/reset/refetch invariants
- [ ] Write a short manual regression checklist for the hot path

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

- [ ] Run only the existing relevant tests for current baseline
- [ ] Record baseline pass/fail status
- [ ] Record any known flaky/pre-existing failures

### Review Checkpoint

- [ ] Clean-context reviewer verifies:
  - scope is narrow enough
  - invariants are concrete
  - no hidden second seam is being included accidentally

### Approval Gate

- [ ] Ask:
  - `Do you want to proceed to Iteration 1?`

---

## Iteration 1: Safety Harness For Selection Flow

### Goal

Create the behavioral and contract safety net before changing architecture.

### Deliverables

#### Renderer user-flow coverage

- [ ] Add test: selecting device updates downstream selection correctly
- [ ] Add test: selecting application resets dependent database/table state correctly
- [ ] Add test: selecting database resets table/row context correctly
- [ ] Add test: refresh/reconciliation handles missing device/app/database correctly
- [ ] Add test: fast switching does not leave stale visible state

#### Selection contract coverage

- [ ] Define transition table:
  - prior state
  - event
  - next state
  - invalidations
  - cleanup
- [ ] Add tests for:
  - `selectDevice`
  - `selectApplication`
  - `selectDatabase`
  - `refreshSelectionGraph`
  - `clearTableContext`

#### Bridge contract coverage

- [ ] Add tests for touched command names and parameter shapes
- [ ] Add tests for response normalization in touched paths
- [ ] Add tests for error mapping in touched paths

#### Rust domain coverage

- [ ] Add focused tests for touched selection-related database behavior where needed
- [ ] Avoid broad Rust refactor in this iteration

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
  - added touched bridge coverage

---

## Iteration 2: Extract `selection-session`

### Goal

Move selection transition policy out of `AppHeader.tsx` and into one seam.

### Deliverables

- [ ] Introduce `selection-session` module or hook
- [ ] Define public commands:
  - `selectDevice`
  - `selectApplication`
  - `selectDatabase`
  - `refreshSelectionGraph`
  - `clearTableContext`
- [ ] Move device-selection transition logic
- [ ] Move application-selection transition logic
- [ ] Move database-selection transition logic
- [ ] Move refresh/reconciliation logic
- [ ] Reduce `AppHeader.tsx` toward view and event wiring only

### Constraints

- Stores remain state holders
- Hooks remain data adapters
- No bridge split yet unless strictly necessary

### Test Checkpoint

- [ ] Run:
  - `npx eslint <changed files...>`
  - `npm test`
  - `npm run build --prefix src/renderer`
- [ ] Add targeted tests if new selection-session public APIs were introduced
- [ ] Record results

### Review Checkpoint

- [ ] Clean-context reviewer checks:
  - one module now owns transition policy
  - `AppHeader.tsx` got smaller in responsibility, not just line movement
  - reset/refetch logic is more local and easier to reason about
  - no new duplication was introduced between session module and stores
- [ ] Reviewer verdict recorded

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
- [ ] Move touched selection-related bridge methods into domain adapters
- [ ] Update `global.d.ts` and types for touched commands
- [ ] Replace touched `any` paths with explicit types

### Constraints

- Preserve runtime behavior
- Do not change backend command signatures unless required
- Do not start Rust module split in this iteration

### Test Checkpoint

- [ ] Run:
  - `npx eslint <changed files...>`
  - `npm test`
  - `npm run build --prefix src/renderer`
- [ ] Run any touched bridge-specific tests
- [ ] Record results

### Review Checkpoint

- [ ] Clean-context reviewer checks:
  - domain boundaries are clearer
  - contract drift risk is reduced
  - selection flow callers became simpler
  - bridge split improved architecture rather than just file count
- [ ] Reviewer verdict recorded

### Approval Gate

- [ ] Ask:
  - `Do you want to proceed to the next iteration?`

---

## Iteration 4: Normalize Selection State Boundaries

### Goal

Remove legacy overlap and make the state ownership model obvious.

### Deliverables

- [ ] Remove or archive legacy `appStore` if still overlapping active flow
- [ ] Normalize selection-related types across stores/hooks/adapters
- [ ] Remove overlapping “current selection” concepts where possible
- [ ] Verify stores contain state, not policy

### Test Checkpoint

- [ ] Run:
  - `npx eslint <changed files...>`
  - `npm test`
  - `npm run build --prefix src/renderer`
- [ ] Record results

### Review Checkpoint

- [ ] Clean-context reviewer checks:
  - state ownership is clearer
  - active selection concepts are not duplicated
  - no policy slipped back into the wrong layer
- [ ] Reviewer verdict recorded

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
