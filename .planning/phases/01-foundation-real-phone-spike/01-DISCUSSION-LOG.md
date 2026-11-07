# Phase 1: Foundation & Real-Phone Spike - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-07
**Phase:** 1-Foundation & Real-Phone Spike
**Areas discussed:** Repo layout, Secrets & publish, Spike module, Client spike, Push/EAS timing, Testing

Mode: `--auto` — recommended option auto-selected for every question.

---

[auto] Repo layout — Q: "Monorepo shape?" → Selected: "npm workspaces server/ shared/ app/" (recommended default)
[auto] Repo layout — Q: "Shared package resolution if bundlers fail?" → Selected: "sync-copy script guarded by test vector" (recommended default)
[auto] Secrets — Q: "How is the Spacetime token used?" → Selected: "root .env SPACETIME_TOKEN, publish script runs `spacetime login --token` non-interactively" (recommended default)
[auto] Secrets — Q: "Database naming?" → Selected: "redphone-hackutd26-dev / -demo" (recommended default)
[auto] Spike module — Q: "What does the >100-row view test use?" → Selected: "private spike_row + per-sender view my_spike_rows" (recommended default)
[auto] Spike module — Q: "Push procedure spike in Phase 1?" → Selected: "optional; defer to Phase 3 with eas init" (recommended default)
[auto] Client spike — Q: "Reconnect strategy?" → Selected: "AppState-driven reconnect + connection context" (recommended default)
[auto] Testing — Q: "Test runner?" → Selected: "vitest in shared/ and server/" (recommended default)

## Claude's Discretion

File names, spike screen styling, vitest config.

## Deferred Ideas

- eas init + push procedure → Phase 3
- Dev builds / APK → v2
