# End-to-End Testing

Flippio E2E tests run the real Tauri application through WebdriverIO and `@wdio/tauri-service`. Device behavior is mocked at the Tauri command boundary so tests stay deterministic and do not require hardware.

## Commands

```bash
yarn test:e2e
yarn test:e2e:clean
yarn test:e2e:debug
```

The preparation step builds the renderer and Rust app with `VITE_E2E_MODE=true`.

## Test Model

- Scenarios own devices, apps, database files, tables, rows, delays, failures, and command history.
- Each test receives fresh scenario state.
- Mock Tauri commands, not React hooks.
- Assert both visible UI outcome and command order/arguments.
- Cover stale, delayed, cancelled, failed, and reordered responses for selection and refresh flows.

## Priority Flows

1. App launch and device selection
2. Device -> app -> database -> table -> rows
3. Edit, add, delete, and clear with push-back
4. Local file open and export
5. Physical iOS progressive scan and refresh
6. SQLCipher unlock success, rejection, and retry
7. Failure recovery without stale selection

Real-device automation is a separate integration layer. Do not make the mocked E2E gate depend on ADB, simulators, or physical devices.
