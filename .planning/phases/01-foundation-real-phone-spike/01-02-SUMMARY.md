---
phase: 01-foundation-real-phone-spike
plan: 02
subsystem: server-module
tags: [spacetimedb, ed25519, noble, vitest, views]
requires: [01-01]
provides:
  - "@redphone/shared signing contract (SPIKE_MSG_PREFIX, spikeMessageString, signSpikeMessage, verifySpikeSignature, SPIKE_TEST_VECTOR, RFC8032_TEST1)"
  - "Spike module: private tables spike_row / spike_verify_result, reducers spike_seed/touch/clear/verify, public per-sender views my_spike_rows / my_verify_results"
  - "Committed generated client bindings in app/src/module_bindings"
affects: [01-03, 01-04, 01-05]
tech-stack:
  added: []
  patterns: [private base tables + per-sender view with indexed owner.filter(ctx.sender), TDD red/green]
key-files:
  created:
    - shared/tsconfig.json
    - shared/src/index.ts
    - shared/src/index.test.ts
    - server/tsconfig.json
    - server/vitest.config.ts
    - server/src/index.ts
    - server/src/index.test.ts
    - app/src/module_bindings/ (index.ts, types.ts, types/reducers.ts, types/procedures.ts, my_spike_rows_table.ts, my_verify_results_table.ts, spike_clear_reducer.ts, spike_seed_reducer.ts, spike_touch_reducer.ts, spike_verify_reducer.ts)
  modified: []
key-decisions:
  - "Module imports only verifySpikeSignature from @redphone/shared (noble bundled transitively), so one shared code path runs on phone and in reducer"
requirements-completed: [FND-01, FND-02, FND-06]
duration: ~10min
completed: 2026-11-07
---

# Phase 1 Plan 02: Spike module and shared signing contract Summary

Shared Ed25519 signing contract (RFC 8032 TEST 1 key) verified identically in shared vitest and inside the module reducer, plus a spike module with private tables, per-sender views, and committed idempotent bindings.

## Tasks

1. Shared signing contract, RED 'test(01-02)' then GREEN: see git log (`test(01-02): add failing shared signing vector tests`, `feat(01-02): shared spike signing contract and test vectors`)
2. Spike module, RED then GREEN: `test(01-02): add failing spike module tests`, `feat(01-02): spike module (rows, view, verify) + generated bindings`

## Results

- Tests: shared 12 passing, server 9 passing (`npm test` exit 0). `tsc --noEmit` clean for shared, server, app.
- `npm run build` OK; `server/dist/bundle.js` contains `redphone/v1|spike|`.
- `SPIKE_TEST_VECTOR.signatureHex` = `fb78f4b1ec42c207f4a4c0768aae09d83f1e0b6bef840e2f2e704945a0726d9b6c12a45ef507b5b75149ef8dcd5f739cdfc71e7c603aae4ab101f4b96ebfd004` (message `redphone/v1|spike|00112233445566778899aabbccddeeff`, key = RFC 8032 TEST 1).
- Generated bindings (app/src/module_bindings): index.ts, types.ts, types/reducers.ts, types/procedures.ts, my_spike_rows_table.ts, my_verify_results_table.ts, spike_clear_reducer.ts, spike_seed_reducer.ts, spike_touch_reducer.ts, spike_verify_reducer.ts. No accessor for private base tables. `npm run gen` second run: no diff (idempotent).
- Gates: exactly 2 `public: true`, 0 `.iter()` in module, `.spacetime/global-cli.sha256` check OK, no spacetime.json.

## Deviations from Plan

None - plan executed as written. Note: `npm run build` prints the harmless "tsc not found" warning from spacetime; the root build script's app tsc step passes.

## Known Stubs

None.

## Self-Check: PASSED

Four commits exist (2 test RED, 2 feat GREEN); all listed files present.
