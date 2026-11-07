---
phase: 01-foundation-real-phone-spike
reviewed: 2026-11-07T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - .env.example
  - .gitignore
  - .nvmrc
  - CLAUDE.md
  - app/.gitignore
  - app/app.config.ts
  - app/app.json
  - app/package.json
  - app/src/app/_layout.tsx
  - app/src/app/index.tsx
  - app/src/components/ConnectionBadge.tsx
  - app/src/components/VerifyPanel.tsx
  - app/src/config.ts
  - app/src/polyfills.ts
  - app/src/spacetime/SpacetimeRoot.tsx
  - app/src/spacetime/connection.ts
  - app/src/spike/signAndVerify.ts
  - app/tsconfig.json
  - package.json
  - scripts/publish.sh
  - scripts/rp-spacetime.sh
  - scripts/smoke/live-smoke.test.ts
  - server/package.json
  - server/src/index.test.ts
  - server/src/index.ts
  - server/tsconfig.json
  - server/vitest.config.ts
  - shared/package.json
  - shared/src/index.test.ts
  - shared/src/index.ts
  - shared/tsconfig.json
findings:
  critical: 0
  warning: 6
  info: 4
  total: 10
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-11-07
**Depth:** standard
**Files Reviewed:** 27 source files read in full. The rest are config and docs.
**Status:** issues_found

## Summary

Core design is sound.
- Base tables are private. Views are per-sender and use `.filter()`, not `.iter()`.
- Server tests use `.isEqual()` for Identity.
- `verifySpikeSignature` is total, and its input checks are strict.
- The token is never echoed. `rp-spacetime.sh` passes `--config-path`, so the global `cli.toml` is not touched. Spacetime's `--help` lists that flag.
- `.env`, `.env.*` and `.spacetime/` are gitignored.

No blockers. The warnings are about token exposure in the process list, destructive publish defaults, a bad saved token that reconnects forever, an unbounded anonymous-identity write path, and a signing format with no replay protection.

I did not read `.env` or `.spacetime/cli.toml`. I did not run the code.

## Structural Findings (fallow)

None provided.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Token passed on the command line, visible in the process list

**File:** `scripts/rp-spacetime.sh:26`
**Issue:** `spacetime ... login --token "$SPACETIME_TOKEN"` puts the bearer token in argv. Any local user can read it with `ps` or `/proc/<pid>/cmdline` while the command runs. The `>/dev/null 2>&1` redirect hides output but not argv. This is a weaker handling than the project rule "token must never be echoed or logged".
**Fix:** Feed the token over stdin if the CLI supports it. Otherwise use a more private channel, such as writing `cli.toml` directly under `umask 077`. At minimum, document the argv exposure and run the script only on a single-user machine.

### WR-02: `.env` is sourced as shell code

**File:** `scripts/rp-spacetime.sh:18-21`
**Issue:** `. ./.env` runs arbitrary shell. A `$`, backtick, space or `;` in a value is executed or mangled. `set -a` also exports every variable in `.env` to the `spacetime` child process. The `sed` parsing in `publish.sh:17-18` is inconsistent with this. It does not strip quotes, CR or trailing comments, so `RP_DB_DEV="x"` yields a DB name with literal quotes.
**Fix:** Parse only the needed key with a strict reader, for example `SPACETIME_TOKEN="$(sed -n 's/^SPACETIME_TOKEN=//p' .env | head -1 | tr -d '\r')"`. Drop `set -a`. Use the same reader for the `RP_DB_*` keys in `publish.sh`.

### WR-03: Destructive publish with a `.env`-controlled target and no confirmation

**File:** `scripts/publish.sh:14-31`
**Issue:**
- The dev target runs `--delete-data=on-conflict -y`. If `RP_DB_DEV` in `.env` is set to the demo DB name, or the two names are swapped by mistake, one command silently wipes the demo database.
- The demo target publishes with `-y` and no prompt.
- `publish:dev` and `publish:demo` are one keystroke apart in `package.json`.
**Fix:** Refuse to run if `RP_DB_DEV == RP_DB_DEMO`. Require the dev name to end in `-dev` before using `--delete-data`. Add an interactive "type the DB name to confirm" step for the demo target.

### WR-04: Invalid saved token causes endless reconnects and is never cleared

**File:** `app/src/spacetime/connection.ts:31-47`, `app/src/spacetime/SpacetimeRoot.tsx:48-54`
**Issue:** The builder is created once with `savedToken`. It uses `withAutomaticReconnect()`. If the stored token is rejected (a DB republished with a new issuer, or a corrupt value), every attempt reuses it. `onConnectError` only sets UI state and never deletes `TOKEN_KEY`. The UI sits on "Reconnecting…" forever, and the user has to reinstall the app.
**Fix:** In `onConnectError`, if the error looks like an auth failure, call `SecureStore.deleteItemAsync(TOKEN_KEY)`. Rebuild the builder without a token, for example by bumping a key on `Connected`. Add an escape hatch.

### WR-05: No replay protection or sender binding in the signing format

**File:** `shared/src/index.ts:6-16, 32-48`, `server/src/index.ts:55-68`
**Issue:** The message is `redphone/v1|spike|<client-chosen nonce>`. The module never checks nonce freshness or uniqueness, and the message is not bound to `ctx.sender`, the reducer name, or a server challenge. Any captured `(pubkey, message, sig)` triple verifies as `true` indefinitely, for any identity. The spike table is harmless. CLAUDE.md names this format as the model for "every sensitive reducer", and Phase 2 is likely to copy it. In that case, a stolen triple replays across identities.
**Fix:** Before reuse, bind the message to the sender and a server-issued or monotonic challenge, for example `redphone/v1|<action>|<senderHex>|<nonce>|<ts>`. Store consumed nonces. Add a note in the shared module saying the spike format is not for production reducers.

### WR-06: Unbounded writes from freshly minted anonymous identities

**File:** `server/src/index.ts:5-6, 30-42`
**Issue:** The per-owner cap of 1000 rows is keyed on `ctx.sender`. Anonymous identities are free to mint, so anyone who learns the public dev DB name can create unlimited identities and fill the module. `spikeVerify` has only per-call size limits and no rate limit. This is a spike DB on public Maincloud, so the risk is limited.
**Fix:** Add a global row cap (a count check in `spikeSeed`) or use `@spacetimedb/rate-limit`. Delete the spike reducers before demo publish, or gate them behind an enrolled-identity check.

## Info

### IN-01: Late callback can resolve the wrong tap

**File:** `app/src/components/VerifyPanel.tsx:19-31, 33-45`
**Issue:** `pending` is a single boolean. Any view insert or update flips it, including a delayed update from a previous tap that arrives after the next tap set `pending = true`. The "MATCH/MISMATCH" can then pair the new attempt with the old verdict. This is rare and matters only for the spike display.
**Fix:** Compare the row's `checkedAt` to the tap's `sentAt`, or use a monotonic tap id.

### IN-02: Smoke test can leak rows into the shared dev DB

**File:** `scripts/smoke/live-smoke.test.ts:67-123`
**Issue:** Tests share state sequentially. If a test fails after the 150-row seed, the cleanup (`spikeClear` in the last test) never runs. The anonymous token is discarded, so those rows become unreachable and permanently consume DB space. The suite also hits the dev DB by default, with no guard against pointing `RP_SMOKE_DB` at the demo DB.
**Fix:** Run `spikeClear` in `afterAll` using the stored token. Refuse a `RP_SMOKE_DB` that does not end in `-dev`.

### IN-03: Duplicated constants and defaults

**File:** `server/src/index.ts:58`, `shared/src/index.ts:8-11`, `app/app.config.ts:8-9`, `app/src/config.ts:5-6`, `scripts/publish.sh:14-15`
**Issue:**
- The length limits 64, 128 and 256 are hardcoded in the server and repeated as regexes and `MAX_MESSAGE_LEN` in shared.
- The host and DB defaults are repeated in `app.config.ts`, `config.ts`, `publish.sh` and the smoke test. They can drift.
- `server/src/index.ts:35` uses an unused loop variable `_` as a counter.
**Fix:** Export the limits from shared and import them in the server. Keep one source for the DB defaults.

### IN-04: Polyfill and script minor issues

**File:** `app/src/polyfills.ts:5-47`, `scripts/rp-spacetime.sh:33`
**Issue:**
- `g.window ??= g` creates a fake `window`. Libraries that sniff `window` for a browser may take web code paths.
- The `AppState` listener is never removed.
- The `console.log` is left in as a debug artifact.
- `spacetime server list | grep -q maincloud` under `set -o pipefail` can report failure through SIGPIPE. The fallback `server add ... || true` hides this.
- A stale `cli.toml` is never re-logged-in, because the script only logs in when the file is missing.
**Fix:** Remove the debug log once the phone test passes. Use `grep -c` or capture the output into a variable. Add a `--relogin` flag.

---

_Reviewed: 2026-11-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
