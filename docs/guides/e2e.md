# End-to-End Testing Decision

Date: July 18, 2026

## Status

Accepted

## Decision

Flippio end-to-end testing will use a real Tauri application with WebdriverIO and `@wdio/tauri-service`.

The UI, renderer state, dialogs, selection flow, and Tauri bridge will run for real. Device-facing behavior for Android and iOS will be mocked at the Tauri command boundary.

## Why

- We want real desktop-app interaction, not jsdom-only coverage.
- We do not want phase-one E2E to depend on physical devices, emulators, ADB, or iOS tooling.
- The highest-risk regressions are in selection-reset-refetch flow, mutation flow, and command sequencing.
- Tauri-specific WebdriverIO support gives us command mocking and command-level inspection in the real app.

## Scope Rules

- Phase one is mocked E2E only.
- Real-device automation is out of scope for now.
- Local macOS execution comes first. CI comes later after the harness is stable.

## Mocking Model

- Mock at the Tauri command boundary, not at React hook level.
- Use stateful, scenario-driven mocks.
- Seed scenarios from real SQLite fixture databases plus small metadata overlays.
- Give every test a fresh in-memory scenario state.
- Record command history for assertions.
- Support delayed, cancelled, failed, and reordered async responses for race-condition coverage.

## Scenario Shape

Each scenario should define enough state to drive the main user flows:

- devices
- applications by device
- database files by device and application
- tables by database file
- rows by database file and table
- behavior flags for refresh, push, failure, delay, cancellation, and replacement cases

## Test Assertions

Critical-path E2E tests must assert both:

- visible UI outcome
- Tauri command history, including call order and arguments

## First Milestone

Phase one should include only:

1. WebdriverIO + Tauri E2E harness setup
2. Test-only E2E mode and scenario engine skeleton
3. Stable test selectors for critical controls
4. One smoke test for mocked device selection in the real app

## Planned Test Order After Phase One

1. Smoke test: app launch and device selection
2. Backbone read flow: device -> app -> database file -> table -> rows visible
3. Edit row + push success
4. Add row
5. Delete row
6. Clear table
7. Open file from local filesystem
8. iOS refresh and selected-file replacement edge cases
9. Failure paths such as scan cancellation, push failure, stale selection, and empty results
