---
phase: 01-foundation-real-phone-spike
plan: 04
subsystem: app-client
tags: [expo, spacetimedb-react, securestore, ed25519]
requires: [01-01, 01-02]
provides:
  - "Expo client spike: polyfills, config, connection factory, provider root, badge, verify panel, spike screen"
affects: [01-05]
key-files:
  created:
    - app/app.config.ts
    - app/src/config.ts
    - app/src/polyfills.ts
    - app/src/spacetime/connection.ts
    - app/src/spacetime/SpacetimeRoot.tsx
    - app/src/components/ConnectionBadge.tsx
    - app/src/components/VerifyPanel.tsx
    - app/src/spike/signAndVerify.ts
  modified:
    - app/src/app/_layout.tsx
    - app/src/app/index.tsx
requirements-completed: [FND-04, FND-05, FND-06]
completed: 2026-11-07
---

# Phase 1 Plan 04: Expo client spike Summary

Expo Go spike screen: Maincloud connect (compression none, auto reconnect, SecureStore token), Live/Reconnecting badge, seed/touch/clear via per-sender view, AppState-to-focus bridge, and on-device Ed25519 sign with server verdict. Bundles for ios and android; phone proof is Plan 05.

## Commits
- d5024be: live-rows slice (Task 1)
- Task 2 commit: sign-and-verify slice (see git log `feat(01-04): sign-and-verify slice`)

## Bindings export names used
`DbConnection`, `tables.mySpikeRows`, `tables.myVerifyResults`, `reducers.spikeSeed({count})`, `reducers.spikeTouch()`, `reducers.spikeClear()`, `reducers.spikeVerify({pubkeyHex,message,sigHex})`.

## "Result updated after tap" detection
`VerifyPanel` sets a `pending` ref true right before calling `spikeVerify`. `useTable(tables.myVerifyResults, { onInsert, onUpdate })` callbacks, when `pending` is set, clear it and store `row.ok` in state. Until then UI shows "Waiting for server…". State is reset to null at each tap; a reducer error clears `pending`. Update fires even for identical `ok` because `checkedAt` changes.

## Verification
tsc clean; `expo export` ios + android OK; root `npm test` green (server 9 passing); all grep gates pass; no changes to bindings, manifests, lockfile.

## Deviations from Plan
**[Rule 1 - Bug] `spikeTouch`/`spikeClear` take no arguments** in generated bindings (plan said `({})`). Called as `touch()` / `clear()`.

Both tasks were written together then committed separately (Task 1 index.tsx without VerifyPanel, Task 2 added it).

## Known Stubs
None.

## Threat Flags
None.

## Self-Check: PASSED
