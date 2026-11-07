---
phase: 01-foundation-real-phone-spike
plan: 01
subsystem: infra
tags: [npm-workspaces, expo-sdk-58, spacetimedb, typescript]
requires: []
provides:
  - npm workspaces monorepo (server, shared, app) with one root package-lock.json
  - Trimmed Expo SDK 58 app that bundles for iOS and Android
  - Global Spacetime CLI config checksum baseline (.spacetime/global-cli.sha256, gitignored)
affects: [01-02, 01-03, 01-04, 01-05]
tech-stack:
  added: [spacetimedb@2.14.1, "@noble/curves@2.4.0", "@noble/hashes@2.4.0", expo@58.0.23, vitest@^3.2.4, typescript@~5.9.3]
  patterns: [workspace TS-source exports for @redphone/shared, single lockfile]
key-files:
  created: [package.json, package-lock.json, .nvmrc, server/package.json, shared/package.json, app/package.json, app/app.json, app/tsconfig.json, app/.gitignore, app/src/app/_layout.tsx, app/src/app/index.tsx]
  modified: []
key-decisions:
  - "Kept template deps (reanimated, gesture-handler, etc.) untouched; only routes/components trimmed"
  - "typedRoutes left enabled; tsc passes"
requirements-completed: [FND-01]
duration: ~10min
completed: 2026-11-07
---

# Phase 1 Plan 01: Monorepo scaffold Summary

Pinned npm-workspaces monorepo (server, shared, app) with one root lockfile and a trimmed Expo SDK 58 app that passes tsc and exports for ios and android.

## Tasks

1. Root workspace, server/shared manifests, CLI baseline: d392888
2. Expo app scaffold, trim, single install: eea2a19

## Resolved versions

expo 58.0.23, react-native 0.88.1, expo-secure-store 58.0.2, expo-crypto 58.0.7, expo-constants 58.0.15. `npm ls spacetimedb --all` shows only 2.14.1. Node 24.22.2.

## typedRoutes

Not disabled. tsc passes with `experiments.typedRoutes: true`.

## Deviations from Plan

None - plan executed as written. Notes: npm warns that esbuild/fsevents install scripts are not covered by allowScripts (informational, esbuild postinstall not approved; not needed so far). `npm audit` reports 8 vulnerabilities (transitive, not addressed, out of scope). The unused template images in `app/assets/images` (tabIcons, react-logo, etc.) were kept.

## Known Stubs

`app/src/app/index.tsx` is an intentional shell ("Red Phone" / "Phase 1 spike"); Plan 04 builds the spike screen.

## Self-Check: PASSED

Commits d392888 and eea2a19 exist; BUNDLE_OK, TSC_OK, `.spacetime/global-cli.sha256` present and gitignored; no app/.git, app/package-lock.json, metro.config.js, or spacetime.json.
