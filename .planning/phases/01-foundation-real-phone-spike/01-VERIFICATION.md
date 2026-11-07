---
phase: 01-foundation-real-phone-spike
verified: 2026-11-07T16:15:00Z
status: human_needed
score: 5/5 roadmap truths verified in code/live smoke; physical-device parts outstanding
human_verification:
  - test: "Open app in Expo Go on a physical phone (Hermes)"
    expected: "Badge shows Live; >100 rows (seed 150) visible from per-sender view; noble Ed25519 sign + server verify returns true"
    why_human: "Hermes runtime and Expo Go cannot be exercised without a device"
  - test: "Background app, foreground it"
    expected: "Live updates resume (AppState handler in app/src/polyfills.ts)"
    why_human: "Native AppState behavior"
  - test: "Toggle airplane mode on then off"
    expected: "Badge flips to Reconnecting then Live"
    why_human: "Real network drop on device"
  - test: "Kill and reopen app"
    expected: "Same identity restored from native SecureStore"
    why_human: "Native SecureStore persistence (smoke covers token reuse only)"
---

# Phase 1 Verification

**Goal:** pinned toolchain; phone in Expo Go talks live to published Maincloud module incl. on-device Ed25519 verify.
**Re-verification:** No.

## Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | build/test for server, shared, app from root; pinned 2.14.1; `npm run gen` works | VERIFIED | `npm test` 12+9 pass; `npm run typecheck` clean; `spacetimedb` 2.14.1 in server and app package.json; `npm run gen` succeeded and left git tree clean (bindings in sync) |
| 2 | Two Maincloud DBs, token from gitignored `.env`, no token committed | VERIFIED | `scripts/publish.sh dev\|demo` (dev `red-phone-6h786-dev`, demo `red-phone-6h786`); `.env` and cli.toml not tracked; no JWT-pattern in tracked files; SUMMARY 01-03 records both published. Demo-DB liveness not independently re-queried |
| 3 | Phone connects, compression off, >100 rows per-sender view, resumes after bg/fg | PARTIAL, human needed | Code: `.withCompression('none')` in connection.ts; AppState handler in polyfills.ts. Live smoke (`npm run smoke`, 6/6 pass): compression none, 150 seeded rows received live, other identity sees none, cold-restart token reuse. Not run on physical phone |
| 4 | Live/Reconnecting indicator flips | PARTIAL, human needed | ConnectionBadge.tsx renders both labels; summary reports headless-Chrome Expo-web check. Airplane-mode flip on device outstanding |
| 5 | Phone-made signature verifies in module vs shared vector (and vitest) | VERIFIED (server side) | server `verifySpikeSignature` from `@redphone/shared`; vitest passes; live smoke test "server verifies real Ed25519 signature (true) and rejects tampered (false)" passes against Maincloud. On-device Hermes signing not run |

## Requirements

| ID | Status |
|----|--------|
| FND-01 | SATISFIED |
| FND-02 | SATISFIED |
| FND-03 | SATISFIED |
| FND-04 | Code + live smoke satisfy; device run human_needed |
| FND-05 | Code + web run satisfy; device flip human_needed |
| FND-06 | SATISFIED live via bindings; on-device human_needed |

All six IDs appear in PLAN frontmatter (01-01..01-05); no orphans. REQUIREMENTS.md checkboxes still "Pending" — update after human sign-off.

## Anti-patterns
No TBD/FIXME blockers observed in spot checks. No gaps found.

## Gaps
None. Only physical-device checks remain, so status is human_needed.
