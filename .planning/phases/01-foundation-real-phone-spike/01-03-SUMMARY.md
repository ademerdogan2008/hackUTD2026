---
phase: 01-foundation-real-phone-spike
plan: 03
subsystem: infra
tags: [spacetimedb, maincloud, publish, cli]
requires: [01-02]
provides:
  - isolated-config spacetime wrapper (scripts/rp-spacetime.sh)
  - dev/demo publish script (scripts/publish.sh)
  - live dev and demo Maincloud databases
key-files:
  created: [scripts/rp-spacetime.sh, scripts/publish.sh, .env.example]
requirements: [FND-03]
completed: 2026-11-07
---

# Phase 1 Plan 03: Maincloud publish Summary

Spike module published to two Maincloud databases through a wrapper pinned to the project-local `.spacetime/cli.toml`; real write/read and anonymous isolation proven from the CLI.

## Database Names

- dev: `red-phone-6h786-dev` (identity c2001f72...ab4f4), created by publish
- demo: `red-phone-6h786` (identity c200619a...bd8a2), pre-created in dashboard, updated by publish

Names come from `RP_DB_DEV` / `RP_DB_DEMO` in gitignored `.env`. The defaults in `scripts/publish.sh` are still `redphone-hackutd26-*` (not used). Plan 05 copies the names above into `app/app.config.ts`.

## Results

- `maincloud` server nickname: already present in the isolated config (user had logged in via browser), so the wrapper did not need to add it. The wrapper only adds it if missing.
- Owner `SELECT COUNT(*) FROM spike_row` after `spike_seed 3`: n = 3.
- Owner `SELECT * FROM my_spike_rows`: 3 rows (ids 1-3, n = 0,1,2), all owned by the CLI identity. SQL on views works.
- Anonymous `SELECT * FROM spike_row`: `Error: no such table: spike_row. If the table exists, it may be marked private.` (HTTP 400)
- Anonymous `SELECT * FROM my_spike_rows`: 0 rows.
- `spike_clear` run on dev. Demo never seeded; `--delete-data` only used on dev.
- Global `~/.config/spacetime/cli.toml` checksum OK after publishing. `.spacetime/cli.toml` mode 600.
- `git ls-files .env .spacetime` empty. Token not found in tracked files or in git history (file-based `-F -f` scan).

## Commits

- f4455b7: feat(01-03): isolated-config spacetime wrapper, publish script, .env.example

## Deviations from Plan

- Names from `.env` overrides instead of the D-08 default names (orchestrator instruction; demo DB pre-existed).
- Publish printed "tsc not found in node_modules" before "Build finished successfully"; harmless, build succeeded.

## Self-Check: PASSED
