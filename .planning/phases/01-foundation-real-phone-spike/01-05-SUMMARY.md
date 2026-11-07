---
phase: 01-foundation-real-phone-spike
plan: 05
subsystem: verification
tags: [expo, spacetimedb, maincloud, smoke-test]
requires: ["01-03", "01-04"]
provides:
  - app/server DB name aligned to published dev DB red-phone-6h786-dev
  - headless live smoke test (npm run smoke)
affects: [app/app.config.ts, app/src/config.ts, scripts/publish.sh, .env.example]
key-files:
  modified: [app/app.config.ts, app/src/config.ts, scripts/publish.sh, .env.example, .planning/phases/01-foundation-real-phone-spike/SKELETON.md]
  created: [scripts/smoke/live-smoke.test.ts]
decisions:
  - "Physical-phone Expo Go test deferred: no device/simulator available; remains outstanding human-verify."
metrics:
  completed: 2026-11-07
---

# Phase 1 Plan 05: Verification Summary

Automated gate and headless live verification pass against `red-phone-6h786-dev`; the physical-phone Expo Go test is NOT done and remains outstanding.

## Commits
- cfffb54 fix(01-05): point app at published dev database
- 5abaccd test(01-05): live Maincloud smoke test (orchestrator)
- acb7967 fix(01-05): never let SecureStore errors break the connection (orchestrator)

## Automated gate
Lockfile unchanged, `npm test` 9/9, typecheck, build, `npm run gen` no binding diff, `expo export` ios+android OK, spacetimedb pinned 2.14.1, node engine `>=24.22.1`, spacetime CLI 2.14.1, global CLI checksum OK. One transient "tsc not found" during first typecheck (masked by a pipe); not reproducible in two reruns.

## Headless live evidence (orchestrator-run)
- `npm run smoke` 6/6: live seed of 150 rows, live touch update, verify true (real sig) / false (tampered), other identity sees 0 rows, reconnect with saved token keeps identity + 150 rows.
- Expo web in headless Chrome: Live badge, Rows 0 -> 150, Touch, Sign & verify "Signed in 10 ms / Server verified: true / MATCH", tampered "false / MATCH", Clear. Polyfill line `native=true` (web), no `decompress failed`. Bug found and fixed: SecureStore rejection was uncaught on web (acb7967).

## Server-side SQL (red-phone-6h786-dev, via isolated wrapper)
- `SELECT COUNT(*) FROM spike_row`: n = 150
- `SELECT ok FROM spike_verify_result`: 3 rows, all `false`. No `true` row currently stored; the headless runs ended on tampered sends / true results were cleared. Verify-true was observed live in the smoke test and web UI, but is not present in stored rows now.
- Anonymous `SELECT * FROM my_spike_rows`: 0 rows
- Anonymous `SELECT * FROM spike_row`: error 400 "no such table ... may be marked private"

## Hygiene
Global CLI checksum OK; `.env` and `.spacetime` untracked; token not in tracked files or git history.

## OUTSTANDING (human-verify, not failures)
Expo Go on a physical device: Hermes runtime, native SecureStore persistence, AppState background/foreground resume, airplane-mode `Reconnecting…` badge, polyfill native branch on device, device sign time. Steps are in 01-05-PLAN.md Task 2. SKELETON.md records these unticked.

## Deviations
- Renamed DB defaults from `redphone-hackutd26-*` to `red-phone-6h786-dev` / `red-phone-6h786` in app config, `app/src/config.ts`, publish.sh and .env.example (Rule 3).
- Task 2 satisfied only partially by headless substitutes.

## Known Stubs
None.
