# Phase 1: Foundation & Real-Phone Spike - Context

**Gathered:** 2026-11-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up the real monorepo (not throwaway) pinned to SpacetimeDB 2.14.1 and prove the three risky runtime paths on a physical phone in Expo Go: (1) live subscription to a private-table-backed per-sender view on Maincloud with compression off, (2) on-device Ed25519 signature verified inside the published module, (3) reconnect/indicator behavior. No enrollment, roles, incidents, or real product screens; those start in Phase 2. Spike tables/reducers are namespaced `spike_*` and removed or left inert later.

</domain>

<decisions>
## Implementation Decisions

### Repo layout & tooling
- **D-01:** npm workspaces at repo root: `server/` (Spacetime TS module), `shared/` (`@redphone/shared`: signing format, hashing, test vectors), `app/` (Expo SDK 58, Expo Router, TypeScript ~5.9.3). Root `package.json` scripts: `build`, `test`, `gen`, `publish:dev`, `publish:demo`.
- **D-02:** Pin `spacetimedb@2.14.1` exactly in `server/` and `app/`; Spacetime CLI is already switched to 2.14.1. Add `"engines": {"node": ">=24.22.1"}` and an `.nvmrc`-style note; every script invocation assumes `PATH=/opt/homebrew/opt/node@24/bin:$PATH`.
- **D-03:** Scaffold the module with `spacetime init --lang typescript --server-only` (or equivalent hand-written layout if init insists on its own dir), app with `create-expo-app` (default Expo Router template, trimmed).
- **D-04:** `npm run gen` = `spacetime generate --lang typescript --out-dir app/src/module_bindings --module-path server`. Bindings are committed.
- **D-05:** If Metro or the Spacetime bundler can't resolve the `shared/` workspace package, fall back to a `scripts/sync-shared.mjs` copy step, guarded by the shared test vector test on both sides.

### Secrets & environment
- **D-06:** Root `.env` (gitignored, already covered by `.gitignore`) holds `SPACETIME_TOKEN=...`. Commit `.env.example` with empty values. Token is never echoed, logged, committed, or written into agent/MCP config.
- **D-07:** `scripts/publish.sh <dev|demo>` loads `.env`, runs `spacetime login --token "$SPACETIME_TOKEN"` (non-interactive, output suppressed), then `spacetime publish --server maincloud <db-name> --module-path server -y`. No `--delete-data` on the demo DB ever; dev DB may use it.
- **D-08:** Database names: `redphone-hackutd26-dev` and `redphone-hackutd26-demo` (Maincloud names are global; if taken, append a short suffix and record it in `.env.example` comments + app config).
- **D-09:** App connection config is non-secret and lives in `app/app.config.ts` / `EXPO_PUBLIC_SPACETIME_HOST` (`wss://maincloud.spacetimedb.com`) and `EXPO_PUBLIC_SPACETIME_DB`.

### Spike module
- **D-10:** Private table `spike_row` (id autoInc PK, owner Identity btree-indexed, n u32, created_at Timestamp). Reducer `spike_seed(count)` inserts `count` rows owned by `ctx.sender` (cap 500). Reducer `spike_touch()` updates one row to prove live updates.
- **D-11:** Public view `my_spike_rows` returns rows via `ctx.db.spike_row.owner.filter(ctx.sender)` — indexed lookup only, no `.iter()`. Anonymous/other identities see only their own rows (proves the per-sender pattern Phase 2 depends on).
- **D-12:** Reducer `spike_verify(pubkeyHex, message, sigHex)` verifies with `@noble/curves/ed25519.js` and writes the boolean result to private table `spike_verify_result` exposed through view `my_verify_results`. Also verifies the fixed shared test vector at module level in vitest.
- **D-13:** Push-procedure spike (scheduled procedure → `exp.host`) is **optional** in Phase 1; attempt only if time allows, otherwise it moves to Phase 3. `eas init` requires the user's Expo login; defer it to Phase 3 and ask the user then.

### Client spike
- **D-14:** `app/src/polyfills.ts` imported first in the root layout: `crypto.getRandomValues` from `expo-crypto`; guarded `window.addEventListener/removeEventListener` no-ops if missing; add `react-native-url-polyfill` only if the URL setter test fails.
- **D-15:** Single connection factory `app/src/spacetime/connection.ts` using `DbConnection.builder().withUri(host).withDatabaseName(db).withCompression('none').withToken(savedToken)`; token persisted with `expo-secure-store` (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`, key `rp.spacetime_token`) on connect.
- **D-16:** Reconnect driven by `AppState` (foreground → reconnect if closed). Connection state exposed via a small React context; header shows "Live" (green) / "Reconnecting…" (amber).
- **D-17:** One spike screen: connection badge, "Seed 150 rows", row count + live list, "Touch a row", "Sign & verify" (generates Ed25519 key with `@noble/curves`, signs a canonical message from `shared/`, calls `spike_verify`, shows server result).

### Testing
- **D-18:** vitest in `shared/` (test vector + canonical format) and `server/` (via `spacetimedb/server/test-utils` if it works under 2.14.1; otherwise pure-function tests of the verify helper). Root `npm test` runs both.

### Claude's Discretion
- Exact file names inside `server/src/` and `app/src/`, styling of the spike screen, vitest config details, whether `spike_*` lives in its own module file.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project
- `plan.md` — full product spec (schema, reducers, flows)
- `.planning/PROJECT.md` — constraints, key decisions
- `.planning/REQUIREMENTS.md` — FND-01..06
- `.planning/ROADMAP.md` §Phase 1 — goal, success criteria, planning notes

### Research
- `.planning/research/SUMMARY.md` — consolidated findings and resolved conflicts
- `.planning/research/STACK.md` — pinned versions, install commands, client connection snippet, Expo Go matrix
- `.planning/research/ARCHITECTURE.md` — repo layout, views, identity model, build order
- `.planning/research/PITFALLS.md` — Hermes/SDK pitfalls 1–3, version drift, `.isEqual()`

### SpacetimeDB official skills (authoritative over training data)
- `~/.agents/skills/concepts/SKILL.md`
- `~/.agents/skills/typescript-server/SKILL.md`
- `~/.agents/skills/typescript-client/SKILL.md`
- `~/.agents/skills/cli/SKILL.md`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield repo (only `plan.md`, `.gitignore`, `.gitattributes`, `CLAUDE.md`, `.planning/`).

### Established Patterns
- `.gitignore` already excludes `.env`, `.env.*` (except `.env.example`), `node_modules/`, `.expo/`, `dist/`, `build/`.

### Integration Points
- Spacetime CLI 2.14.1 at `~/.local/bin/spacetime`; default server `maincloud`.
- Node 24.22.2 at `/opt/homebrew/opt/node@24/bin` (system Node 24.18 is too old).

</code_context>

<specifics>
## Specific Ideas

- Demo distribution decided: Expo Go + in-app alert. The app must run fully in Expo Go (no custom native modules).
- User will provide the Spacetime token when asked; orchestrator writes it to `.env`. Plans must include a clear checkpoint before the first `publish` step.

</specifics>

<deferred>
## Deferred Ideas

- `eas init` / EAS projectId and real push procedure → Phase 3 (needs user's Expo login).
- Android preview APK / dev builds → v2 (V2-07).

</deferred>

---

*Phase: 01-foundation-real-phone-spike*
*Context gathered: 2026-11-07*
