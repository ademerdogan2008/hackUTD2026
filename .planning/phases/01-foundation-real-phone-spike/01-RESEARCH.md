# Phase 1: Foundation & Real-Phone Spike - Research

**Researched:** 2026-11-07
**Domain:** npm-workspaces monorepo; SpacetimeDB 2.14.1 TS module on Maincloud; Expo SDK 58 client in Expo Go
**Confidence:** HIGH for toolchain/layout/module/bundling (all executed in a scratch workspace). MEDIUM for on-device behavior (reconnect, `login --token` output): cannot be tested without a phone or login.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** npm workspaces at repo root: `server/` (Spacetime TS module), `shared/` (`@redphone/shared`: signing format, hashing, test vectors), `app/` (Expo SDK 58, Expo Router, TypeScript ~5.9.3). Root `package.json` scripts: `build`, `test`, `gen`, `publish:dev`, `publish:demo`.
- **D-02:** Pin `spacetimedb@2.14.1` exactly in `server/` and `app/`; Spacetime CLI is already switched to 2.14.1. Add `"engines": {"node": ">=24.22.1"}` and an `.nvmrc`-style note; every script invocation assumes `PATH=/opt/homebrew/opt/node@24/bin:$PATH`.
- **D-03:** Scaffold the module with `spacetime init --lang typescript --server-only` (or equivalent hand-written layout if init insists on its own dir), app with `create-expo-app` (default Expo Router template, trimmed).
- **D-04:** `npm run gen` = `spacetime generate --lang typescript --out-dir app/src/module_bindings --module-path server`. Bindings are committed.
- **D-05:** If Metro or the Spacetime bundler can't resolve the `shared/` workspace package, fall back to a `scripts/sync-shared.mjs` copy step, guarded by the shared test vector test on both sides.
- **D-06:** Root `.env` (gitignored, already covered by `.gitignore`) holds `SPACETIME_TOKEN=...`. Commit `.env.example` with empty values. Token is never echoed, logged, committed, or written into agent/MCP config.
- **D-07:** `scripts/publish.sh <dev|demo>` loads `.env`, runs `spacetime login --token "$SPACETIME_TOKEN"` (non-interactive, output suppressed), then `spacetime publish --server maincloud <db-name> --module-path server -y`. No `--delete-data` on the demo DB ever; dev DB may use it.
- **D-08:** Database names: `redphone-hackutd26-dev` and `redphone-hackutd26-demo` (Maincloud names are global; if taken, append a short suffix and record it in `.env.example` comments + app config).
- **D-09:** App connection config is non-secret and lives in `app/app.config.ts` / `EXPO_PUBLIC_SPACETIME_HOST` (`wss://maincloud.spacetimedb.com`) and `EXPO_PUBLIC_SPACETIME_DB`.
- **D-10:** Private table `spike_row` (id autoInc PK, owner Identity btree-indexed, n u32, created_at Timestamp). Reducer `spike_seed(count)` inserts `count` rows owned by `ctx.sender` (cap 500). Reducer `spike_touch()` updates one row to prove live updates.
- **D-11:** Public view `my_spike_rows` returns rows via `ctx.db.spike_row.owner.filter(ctx.sender)` - indexed lookup only, no `.iter()`. Anonymous/other identities see only their own rows.
- **D-12:** Reducer `spike_verify(pubkeyHex, message, sigHex)` verifies with `@noble/curves/ed25519.js` and writes the boolean result to private table `spike_verify_result` exposed through view `my_verify_results`. Also verifies the fixed shared test vector at module level in vitest.
- **D-13:** Push-procedure spike is **optional** in Phase 1; otherwise moves to Phase 3. `eas init` deferred to Phase 3.
- **D-14:** `app/src/polyfills.ts` imported first in the root layout: `crypto.getRandomValues` from `expo-crypto`; guarded `window.addEventListener/removeEventListener` no-ops if missing; add `react-native-url-polyfill` only if the URL setter test fails.
- **D-15:** Single connection factory `app/src/spacetime/connection.ts` using `DbConnection.builder().withUri(host).withDatabaseName(db).withCompression('none').withToken(savedToken)`; token persisted with `expo-secure-store` (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`, key `rp.spacetime_token`) on connect.
- **D-16:** Reconnect driven by `AppState` (foreground -> reconnect if closed). Connection state exposed via a small React context; header shows "Live" (green) / "Reconnecting..." (amber).
- **D-17:** One spike screen: connection badge, "Seed 150 rows", row count + live list, "Touch a row", "Sign & verify".
- **D-18:** vitest in `shared/` and `server/` (via `spacetimedb/server/test-utils` if it works under 2.14.1; otherwise pure-function tests). Root `npm test` runs both.

### Claude's Discretion
Exact file names inside `server/src/` and `app/src/`, styling of the spike screen, vitest config details, whether `spike_*` lives in its own module file.

### Deferred Ideas (OUT OF SCOPE)
- `eas init` / EAS projectId and real push procedure -> Phase 3.
- Android preview APK / dev builds -> v2 (V2-07).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FND-01 | Monorepo builds/tests, pinned 2.14.1, Node >= 24.22.1 | Verified workspace layout, install, build, vitest, Metro export (sections Standard Stack, Architecture, Pitfalls 1-4) |
| FND-02 | `npm run gen` regenerates bindings | Exact verified command + output layout (Code Examples) |
| FND-03 | Publish dev + demo DBs from `.env` token | Exact publish flags; login caveats (Pitfall 6) |
| FND-04 | Expo Go phone: connect, compression off, live view rows, reconnect | Builder API names, hooks, liveness listener mechanism (Pitfall 7) |
| FND-05 | Live / Reconnecting indicator | `useSpacetimeDB()` state + `onDisconnect` args (Code Examples) |
| FND-06 | Phone Ed25519 sig verifies in module | noble bundles in module, verified; shared message builder; vitest test (Code Examples) |
</phase_requirements>

## Summary

Everything in the toolchain path was executed in a scratch workspace and works on Node 24.22.2 + CLI 2.14.1: a flat `server/` module (not `spacetime init`'s nested layout) builds with `spacetime build`, bundles `@noble/curves` and the `@redphone/shared` TS workspace package into `dist/bundle.js`, passes `tsc --noEmit`, and passes vitest through `spacetimedb/server/test-utils` (it exists in 2.14.1). `spacetime generate --module-path server -y` emits client bindings with no login or server needed. A scratch Expo SDK 58 app inside the same npm workspace exported an iOS Hermes bundle (`expo export --platform ios`) with **no `metro.config.js`**, resolving `@redphone/shared` (TS source), `@noble/curves/ed25519.js`, `spacetimedb/react`, and the generated bindings.

Real risks remaining are device-only: (a) whether RN's `window.addEventListener` exists (SDK touches `window`/`document` only for liveness listeners) and whether AppState resume actually reaches the SDK, (b) `spacetime login --token` output/overwrite behavior (not run; user already has a saved login in `~/.config/spacetime/cli.toml`), (c) Ed25519 on Hermes.

**Primary recommendation:** Hand-write flat `server/` (do not use `spacetime init` output), no Metro config, one `scripts/publish.sh` using explicit flags + `--no-config`, and bridge AppState to the SDK by dispatching a synthetic `focus` event through a polyfilled `window.addEventListener`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-sender row visibility | Database/Module (view on private table) | - | Server enforces; client only subscribes |
| Ed25519 sign | Client (phone) | - | Key never leaves device |
| Ed25519 verify | Module (reducer) | shared (message format) | Trusted check; format shared byte-for-byte |
| Token persistence | Client (SecureStore) | - | Bearer credential |
| Reconnect/indicator | Client (SDK auto-reconnect + AppState bridge) | - | Mobile lifecycle |
| Bindings generation | Dev tooling (`spacetime generate`) | - | Committed output |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `spacetimedb` | 2.14.1 exact (server + app) | Module SDK, client SDK, `/react`, `/server/test-utils` | Locked. `[VERIFIED: npm install + build in scratch]` |
| Spacetime CLI | 2.14.1 (`spacetime version list` shows current) | build/generate/publish | `[VERIFIED: CLI]` |
| `@noble/curves` | 2.4.0 | Ed25519 sign (app) + verify (module) | Bundled into module successfully `[VERIFIED: build + grep bundle + vitest]` |
| `@noble/hashes` | 2.4.0 | `hexToBytes`/`bytesToHex` from `@noble/hashes/utils.js`, sha256 | Same family `[VERIFIED]` |
| `expo` | ~58.0.23 (template dist-tag `sdk-58` = template 58.0.32) | App runtime | `[VERIFIED: npm view]` |
| `expo-secure-store`, `expo-crypto` | via `npx expo install` | token store; `getRandomValues` | `[VERIFIED: expo install added config plugin]` |
| `vitest` | ^3.2.4 (resolved 3.2.7) | tests server + shared | Works with module plugin `[VERIFIED]` |
| `typescript` | ~5.9.3 | Server + shared + app | See Pitfall 5 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Flat `server/` | `spacetime init` nested `server/spacetimedb/` | Init also drops ~30 KB each of AGENTS.md/CLAUDE.md/.windsurfrules/.cursor/.github rules into `server/`; a nested CLAUDE.md would clutter agent context. Skip. |
| `scripts/sync-shared.mjs` | workspace import | NOT needed: both bundlers resolve `@redphone/shared`. D-05 fallback is unused. |

**Installation (root, after hand-writing package.json files):**
```bash
export PATH=/opt/homebrew/opt/node@24/bin:$HOME/.local/bin:$PATH
npm install                                   # root; installs all workspaces
cd app && npx expo install expo-secure-store expo-crypto && cd ..   # adds SDK-matched versions + config plugin
```

## Package Legitimacy Audit

slopcheck not run (not installed; best-effort skipped). All packages below are tagged per provenance rule: all are named by project-level research (STACK.md) from official docs/skills and resolved by `npm install` in this session; none are newly discovered by web search.

| Package | Registry | Source | slopcheck | Disposition |
|---------|----------|--------|-----------|-------------|
| spacetimedb 2.14.1 | npm | official Clockwork, in official skills/docs | not run | Approved (official docs) |
| @noble/curves, @noble/hashes 2.4.0 | npm | paulmillr, referenced by official skill ecosystem | not run | Approved |
| expo, expo-secure-store, expo-crypto, expo-router | npm | Expo official | not run | Approved |
| vitest ^3.2.4, typescript ~5.9.3 | npm | official skill pins | not run | Approved |

Packages removed: none. Flagged suspicious: none. `npm install` emitted only the esbuild/fsevents install-script notice (expected, benign).

## Architecture Patterns

### Verified repo layout
```
/ (root)
├── package.json            # private, workspaces ["server","shared","app"], engines node >=24.22.1, scripts
├── .nvmrc                  # 24.22.2 (documentation; scripts still prefix PATH)
├── .env.example            # SPACETIME_TOKEN=   (comments: db names)
├── scripts/publish.sh
├── server/                 # FLAT module: package.json, tsconfig.json, vitest.config.ts, src/index.ts, src/*.test.ts
├── shared/                 # package.json (main/exports -> src/index.ts), src/index.ts, src/*.test.ts
└── app/                    # create-expo-app output, router in app/src/app/
    └── src/module_bindings/  # generated, committed
```
`dist/` under `server/` is a build artifact: add `server/dist/` to `.gitignore` (existing `dist/` rule already covers it).

### Root package.json (verified shape)
```json
{
  "name": "redphone", "private": true,
  "engines": { "node": ">=24.22.1" },
  "workspaces": ["server", "shared", "app"],
  "scripts": {
    "build": "spacetime build --module-path server",
    "gen": "spacetime generate --lang typescript --out-dir app/src/module_bindings --module-path server -y",
    "test": "npm test -w @redphone/shared && npm test -w @redphone/server",
    "typecheck": "npm exec -w @redphone/server -- tsc --noEmit && npm exec -w @redphone/app -- tsc --noEmit",
    "publish:dev": "bash scripts/publish.sh dev",
    "publish:demo": "bash scripts/publish.sh demo"
  }
}
```
(`tsc` is hoisted under `app/node_modules` / `server/node_modules`, not root; invoke per-workspace.)

### server/package.json (verified)
```json
{ "name": "@redphone/server", "private": true, "type": "module", "version": "0.0.0",
  "scripts": { "test": "vitest run" },
  "dependencies": { "spacetimedb": "2.14.1", "@noble/curves": "2.4.0", "@noble/hashes": "2.4.0", "@redphone/shared": "*" },
  "devDependencies": { "typescript": "~5.9.3", "vitest": "^3.2.4" } }
```
Use `tsconfig.json` copied from init (strict, `moduleResolution: bundler`, `target ESNext`, `lib ["ES2021","dom"]`, `module ESNext`, `isolatedModules`, `noEmit`, `include ["./**/*"]`). `[VERIFIED: init output]`. Add `"vitest.config.ts"` is covered by include.

### shared/package.json (verified)
```json
{ "name": "@redphone/shared", "private": true, "type": "module", "version": "0.0.0",
  "main": "src/index.ts", "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run" },
  "dependencies": { "@noble/curves": "2.4.0", "@noble/hashes": "2.4.0" },
  "devDependencies": { "vitest": "^3.2.4" } }
```
Point `main`/`exports` at TS source: no build step. Spacetime bundler (esbuild) and Metro both consume it `[VERIFIED]`. Shared vitest needs no plugin (plain node).

### app tweaks to the `create-expo-app` output
- Command: `npx --yes create-expo-app@5.0.0 app --template default --no-install --no-agents-md -y` run from a temp dir, then move into repo `app/`. `[VERIFIED]` Template `default` yields SDK 58 (`expo ~58.0.23`, RN 0.88.1, React 19.3.0).
- **Delete `app/.git`** (create-expo-app initializes a nested git repo; verified). Also drop `app/LICENSE`, `README.md`, `.vscode`, `scripts/reset-project.js` as desired.
- Router root is **`app/src/app/`** (not `app/app/`): put `import '../polyfills'` as the first import in `app/src/app/_layout.tsx`. Keep `@/*` path alias.
- Package name: rename to `@redphone/app`; add deps `spacetimedb` `2.14.1`, `@redphone/shared` `*`, `@noble/curves` `2.4.0`, `@noble/hashes` `2.4.0`.
- `app.json`: remove `web.output: "server"` (web not needed); template enables `experiments.reactCompiler` and `typedRoutes` (bundle worked with both). To satisfy D-09 add `app.config.ts` that spreads `app.json`; plain `EXPO_PUBLIC_*` env vars need no config at all (inlined by Expo from env/`.env`; the app can read a root `.env` only if copied to `app/.env`; prefer `app/.env` with only the two non-secret EXPO_PUBLIC vars, or hardcode defaults in `app.config.ts` `extra`).
- Template TS is `~6.0.3`; see Pitfall 5.

### Metro + monorepo
**No `metro.config.js` needed.** Expo SDK 58's default Metro config auto-detects workspaces `[VERIFIED: expo export --platform ios succeeded in a root workspace with a sibling `shared/` TS package, `@noble/curves/ed25519.js` subpath, `spacetimedb/react`, generated bindings; Hermes bytecode 4.2 MB]`. Keep root `node_modules` hoisting (default npm). Do not add `nodeLinker`/`.npmrc` hacks.

### Module code (verified: builds, tsc clean, vitest passes)
```typescript
// server/src/index.ts  (Source: scratch workspace executed on 2.14.1)
import { schema, table, t, SenderError } from 'spacetimedb/server';
import { ed25519 } from '@noble/curves/ed25519.js';
import { hexToBytes } from '@noble/hashes/utils.js';
import { SPIKE_MSG_PREFIX } from '@redphone/shared';

const spikeRow = table(
  { name: 'spike_row' },                       // private by default
  {
    id: t.u64().primaryKey().autoInc(),
    owner: t.identity().index('btree'),        // inline index -> ctx.db.spikeRow.owner.filter(...)
    n: t.u32(),
    createdAt: t.timestamp(),                  // column wire name created_at
  }
);
const spikeVerifyResult = table(
  { name: 'spike_verify_result' },
  { owner: t.identity().primaryKey(), ok: t.bool(), checkedAt: t.timestamp() }
);

const spacetimedb = schema({ spikeRow, spikeVerifyResult });
export default spacetimedb;

export const spikeSeed = spacetimedb.reducer({ count: t.u32() }, (ctx, { count }) => {
  if (count > 500) throw new SenderError('count cap 500');
  for (let i = 0; i < count; i++)
    ctx.db.spikeRow.insert({ id: 0n, owner: ctx.sender, n: i, createdAt: ctx.timestamp });
});

export const spikeTouch = spacetimedb.reducer((ctx) => {
  const row = [...ctx.db.spikeRow.owner.filter(ctx.sender)][0];
  if (!row) throw new SenderError('no rows');
  ctx.db.spikeRow.id.update({ ...row, n: row.n + 1 });
});

export const spikeVerify = spacetimedb.reducer(
  { pubkeyHex: t.string(), message: t.string(), sigHex: t.string() },
  (ctx, { pubkeyHex, message, sigHex }) => {
    let ok = false;
    try {
      if (!message.startsWith(SPIKE_MSG_PREFIX)) throw new SenderError('bad prefix');
      ok = ed25519.verify(hexToBytes(sigHex), new TextEncoder().encode(message), hexToBytes(pubkeyHex));
    } catch { ok = false; }
    const prev = ctx.db.spikeVerifyResult.owner.find(ctx.sender);   // PK/unique index: find/update, NOT filter
    if (prev) ctx.db.spikeVerifyResult.owner.update({ ...prev, ok, checkedAt: ctx.timestamp });
    else ctx.db.spikeVerifyResult.insert({ owner: ctx.sender, ok, checkedAt: ctx.timestamp });
  }
);

export const mySpikeRows = spacetimedb.view(
  { name: 'my_spike_rows', public: true },
  t.array(spikeRow.rowType),
  (ctx) => [...ctx.db.spikeRow.owner.filter(ctx.sender)]   // indexed lookup only
);
export const myVerifyResults = spacetimedb.view(
  { name: 'my_verify_results', public: true },
  t.array(spikeVerifyResult.rowType),
  (ctx) => { const r = ctx.db.spikeVerifyResult.owner.find(ctx.sender); return r ? [r] : []; }
);
```
Facts `[VERIFIED: executed]`:
- Reducer export `spikeSeed` -> wire/reducer name `spike_seed`; client `conn.reducers.spikeSeed({ count: 150 })`; React `useReducer(reducers.spikeSeed)`.
- `ctx.sender` is `Identity` (has `.equals`, `.toHexString()`); compare with `.isEqual`/`.equals`, never `===` (see PITFALLS).
- Column `createdAt` -> client row field `createdAt`, wire `created_at`.
- `generate` prints "Skipping private tables during codegen: spike_row, spike_verify_result" (correct; only views `my_spike_rows`, `my_verify_results` are emitted). Client: `tables.mySpikeRows`, `tables.myVerifyResults`.
- Do NOT `throw SenderError` inside the try-catch swallow if you want the client to see an error; the above stores `ok=false` instead (intended for the spike). The bad-prefix throw is caught and yields `false`.
- `spacetime build` prints a warning "tsc not found in node_modules" because TypeScript is hoisted / lives in `server/node_modules`; build still succeeds (esbuild bundle, no typecheck). Typecheck separately with `tsc --noEmit`. Harmless. `[VERIFIED]`
- Bundle is ~1.6 MB (includes spacetimedb runtime + noble + shared). Built bundle contains the shared prefix string `[VERIFIED: grep]`.
- Public view on private table: private tables stay hidden; only the view rows reach the client.

### Vitest (module) - verified working in 2.14.1
`spacetimedb/server/test-utils` and `/vitest` exports exist. `server/vitest.config.ts`:
```typescript
import { defineConfig, type Plugin } from 'vitest/config';
import { spacetimedbModuleTestPlugin } from 'spacetimedb/server/test-utils/vitest';
export default defineConfig({
  plugins: [spacetimedbModuleTestPlugin() as unknown as Plugin],
  test: { environment: 'node' },
});
```
```typescript
// server/src/index.test.ts  (passes: 2 tests)
import { expect, it } from 'vitest';
import { ConnectionId } from 'spacetimedb';
import { createModuleTestHarness, TestAuth } from 'spacetimedb/server/test-utils';
import spacetimedb, * as m from './index';

const alice = TestAuth.fromJwtPayload(JSON.stringify({ iss: 'test', sub: 'alice' }), new ConnectionId(1n));
it('seeds', () => {
  const test = createModuleTestHarness(spacetimedb, m);
  test.withReducerTx(alice, ctx => { m.spikeSeed(ctx, { count: 3 }); });
  expect(test.db.spikeRow.count()).toBe(3n);
});
```
**Gotcha:** `TestAuth.fromJwtPayload(payload, connectionId)` REQUIRES the second arg (`ConnectionId`) in 2.14.1; the skill snippet omits it and the call throws "authenticated test auth requires a JWT payload and connection id". `TestAuth.internal()` does not represent a client sender. Reducers are invoked directly as `m.spikeSeed(ctx, args)`. Table reads: `test.db.<accessor>.count()` returns `bigint`, `.iter()` available. Views/subscriptions aren't simulated by the harness for the live path; the per-sender isolation of the view is only provable live (see Verification).

### Shared test vector (FND-06)
`shared/src/index.ts` exports: `SPIKE_MSG_PREFIX = 'redphone/v1|spike|'`, `spikeMessage(nonce): Uint8Array`, and a fixed vector `{ secretKeyHex, publicKeyHex, message, signatureHex }` (generate once with noble, hardcode; Ed25519 is deterministic per RFC 8032 so `sign` output is stable). `shared` vitest asserts `ed25519.verify(sig, spikeMessage, pk)` and `ed25519.sign` reproduces `signatureHex`. Server vitest imports the same vector and runs `spikeVerify` expecting `ok === true`, plus a tampered-message case expecting `false`. Because the reducer receives `message` as a string, keep the message ASCII/UTF-8 and hex nonce (no JSON, no bigint).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ed25519 | Anything custom | `@noble/curves/ed25519.js` | Bundles in module; verified |
| Hex codec | custom | `@noble/hashes/utils.js` `hexToBytes`/`bytesToHex` | exact |
| Monorepo resolution | `sync-shared.mjs`, metro.config.js | workspace import | Verified unnecessary |
| Reconnect backoff | own timer | `.withAutomaticReconnect()` | SDK docs warn against parallel retry timers |
| Per-user filtering | RLS | `view` with indexed `filter(ctx.sender)` | RLS experimental |
| Token storage | AsyncStorage | `expo-secure-store` | locked D-15 |

## Runtime State Inventory
Not a rename phase (greenfield). None.

## Common Pitfalls

### Pitfall 1: `spacetime init` nested layout and rule-file clutter
Init with `--project-path ./server` creates `server/spacetimedb/{package.json,tsconfig.json,src/index.ts}` plus `server/spacetime.json` (`{"server":"maincloud","module-path":"./spacetimedb"}`), `server/spacetime.local.json` (random db name `redphone-xxxxx`), and 30 KB duplicated `AGENTS.md`/`CLAUDE.md`/`.windsurfrules`/`.cursor/`/`.github/` rule files. It also does not install deps and uses `"spacetimedb": "2.14.*"` and `typescript ~5.6.2`. **Avoid:** hand-write the flat layout (D-03 permits). `--module-path server` then works for build/generate/publish (verified).

### Pitfall 2: `spacetime.json` / `spacetime.local.json` interfering
Config discovery can pick up stray configs and prompt. Use explicit flags plus `--no-config` in every scripted call, and do not commit any `spacetime.json`. `[VERIFIED: --no-config flag exists on publish and generate]` (`--no-config` accepted with `publish ... --help`; real publish not run).

### Pitfall 3: `generate` runs a build
`spacetime generate --module-path server` builds the module first (so it needs `node_modules` installed and Node 24.22.x). It needs no login or server. `-y` avoids prompts. Output: `index.ts`, `types.ts`, `types/reducers.ts`, `types/procedures.ts`, `spike_*_reducer.ts`, `my_*_table.ts` (verified). Re-run on every schema change and commit. Generated imports use no extension (`--import-extension none` default) which Metro accepts.

### Pitfall 4: `vitest` `fromJwtPayload` needs a ConnectionId (see above).

### Pitfall 5: TypeScript version conflict
Template ships `typescript ~6.0.3`; `npx expo install --check` reports "typescript@5.9.3 - expected version: ~6.0.3" when the app pins 5.9.3 (warning only; Metro does not typecheck). Locked decision is ~5.9.3, so pin `typescript ~5.9.3` in all three workspaces and tolerate/ignore that warning (do not run `expo install --fix` blindly: it will bump TS). Alternative if the warning matters: leave app on TS ~6.0.3 and only server/shared on ~5.9.3 (npm nests both); shared source must then typecheck under both. Flag for planner: keep locked 5.9.3.

### Pitfall 6: `spacetime login --token` (NOT executed; behavior unverified)
- Flag: `--token <spacetimedb-token>` ("Bypass the login flow and use a login token directly"); `--no-browser` also exists; `login show --token` prints the saved token (never run that in a log).
- Saved to `~/.config/spacetime/cli.toml` key `spacetimedb_token` (plus `web_session_token`, `default_server`). `[VERIFIED: key names only, values not read]`
- **This machine already has a saved login** (`spacetime login show` prints "You are logged in as ..."). `login --token` will overwrite `spacetimedb_token` with the supplied token. The publish step therefore may work without the login step, but D-07 wants the `.env` token to be the identity that owns the DBs. Whether the CLI echoes the token on success is not documented in the docs I fetched; mitigate by always `>/dev/null 2>&1` and never `set -x`.
- Plan a checkpoint: user confirms `.env` token is for the account that should own `redphone-hackutd26-*` (a mismatch would publish under the wrong owner and later publishes by the other identity fail with permission errors).

### Pitfall 7: Reconnect on resume in RN
The SDK's automatic-reconnect liveness code (`#installLivenessListeners`) uses `typeof document`/`typeof window` guards, then calls `win?.addEventListener("focus"|"online"|"pageshow", ...)`, and `doc?.addEventListener(...)` (`document` is undefined in RN, so only `window`). `[VERIFIED: sdk/index.mjs lines ~6368-6392]`. Consequences:
- If RN defines `window` but `window.addEventListener` is undefined, builder `.build()`/connect could throw: that is exactly why D-14 polyfills it. Do the polyfill as a real minimal event bus, not a no-op: store handlers per event name; `removeEventListener` deletes them.
- RN fires nothing on app resume, so the SDK never learns of a zombie socket. Bridge: `AppState.addEventListener('change', s => { if (s === 'active') bus.dispatch('focus'); })`. The SDK's `#handleLivenessResume` then (a) if `isSocketClosed`, treats as connection loss and schedules reconnect, (b) if a backoff timer is pending, clears it and reconnects immediately. This replaces writing own reconnect. `[CITED: sdk source; device behavior unverified -> ASSUMED works, device test required]`
- Requires automatic reconnect enabled: the React `SpacetimeDBProvider` forces `withAutomaticReconnect` (per connection_manager docs), and the skill says to set it explicitly for direct connections. Set it explicitly anyway.
- Fallback if the bridge fails on device: plain SDK exponential backoff (min 1 s, max 30 s) will still reconnect; AppState handler may then call `conn.disconnect()` and let the React provider rebuild (provider rebuilds only on terminal failure; avoid manual rebuild while recovery pending per skill).

### Pitfall 8: bigint / readonly / null token
`id` and counts are `bigint`: render with `Number()`/`String()`. `useTable` rows are readonly: copy before sort. Never auto-retry reducers on `UnknownCallResultError`.

### Pitfall 9: connection builder created per render
`SpacetimeDBProvider connectionBuilder={...}` must receive a stable builder (create once, e.g. module scope after the token is loaded, or `useMemo`). The token is loaded async from SecureStore, so render a splash until it resolves, then build once.

### Pitfall 10: view requires a sender-independent first connect
A brand-new anonymous identity (no saved token) still gets a token via `onConnect(conn, identity, token)`; persist it there. The identity (and thus visible rows) changes if the token is lost; test "uninstall/clear secure store => zero rows seen" as an AUD-05 preview.

## Code Examples

### publish script (`scripts/publish.sh`) - flags verified via `--help`
```bash
#!/usr/bin/env bash
set -euo pipefail                         # NOT set -x
export PATH=/opt/homebrew/opt/node@24/bin:$HOME/.local/bin:$PATH
cd "$(dirname "$0")/.."
case "${1:-}" in dev) DB=redphone-hackutd26-dev ;; demo) DB=redphone-hackutd26-demo ;; *) echo "usage: publish.sh dev|demo" >&2; exit 2 ;; esac
set -a; . ./.env; set +a
[ -n "${SPACETIME_TOKEN:-}" ] || { echo "SPACETIME_TOKEN missing in .env" >&2; exit 1; }
spacetime login --token "$SPACETIME_TOKEN" >/dev/null 2>&1 || { echo "login failed" >&2; exit 1; }
# DEV may add: --delete-data=always ; NEVER on demo
spacetime publish "$DB" --server maincloud --module-path server --no-config -y
```
Flag facts `[VERIFIED: spacetime publish --help]`: DB name is the positional (`[name|identity]`), must match `^[a-z0-9]+(-[a-z0-9]+)*$` (the planned names comply); `-p/--module-path`; `-s/--server`; `-y/--yes[=all|remote|migrate|break-clients|skip-login|delete-data]` (bare `-y` = all, must attach values with `=`; place `-y` after the DB name or use `--yes` at the end, since `--yes my-db` would treat my-db as the value-less flag's next positional... the help states the value must be attached with `=`); `-c/--delete-data[=always|on-conflict|never]`; `--no-config`; `--break-clients`. Note `-y` (all) includes `delete-data` confirmations skip, but data is only destroyed if `--delete-data` is passed. Env vars at publish are optional (no module env declared in Phase 1).
Name collision: Maincloud returns an error if the name is owned by another identity; D-08 suffix fallback applies. First publish creates the DB owned by the token's identity.

### generate
`spacetime generate --lang typescript --out-dir app/src/module_bindings --module-path server -y` `[VERIFIED executed, "Generate finished successfully."]`. Flags: `-l/--lang`, `-o/--out-dir`, `-p/--module-path`, `-y`, `--no-config`, `--include-private` (unneeded), `--import-extension none|js|ts`.

### polyfills (`app/src/polyfills.ts`)
```typescript
import { getRandomValues } from 'expo-crypto';
import { AppState } from 'react-native';
const g = globalThis as any;
g.crypto ??= {};
g.crypto.getRandomValues ??= getRandomValues;      // noble keygen
if (typeof g.TextDecoder === 'undefined') throw new Error('TextDecoder missing');
const w = (g.window ??= g);
if (typeof w.addEventListener !== 'function') {
  const handlers = new Map<string, Set<(e: any) => void>>();
  w.addEventListener = (type: string, fn: (e: any) => void) => {
    if (!handlers.has(type)) handlers.set(type, new Set());
    handlers.get(type)!.add(fn);
  };
  w.removeEventListener = (type: string, fn: (e: any) => void) => handlers.get(type)?.delete(fn);
  AppState.addEventListener('change', (s) => {
    if (s === 'active') handlers.get('focus')?.forEach((fn) => fn({ type: 'focus' }));
  });
}
```
(If `window.addEventListener` already exists in RN 0.88, additionally dispatch via `w.dispatchEvent?.(new Event('focus'))` only if `Event` exists; verify on device and log which branch ran.) Must be imported before any `spacetimedb` import (first line of `_layout.tsx`).

### connection factory (names `[VERIFIED: d.ts]`)
```typescript
// app/src/spacetime/connection.ts
import * as SecureStore from 'expo-secure-store';
import { DbConnection } from '../module_bindings';
export const TOKEN_KEY = 'rp.spacetime_token';
export function makeBuilder(host: string, db: string, savedToken?: string) {
  return DbConnection.builder()
    .withUri(host)
    .withDatabaseName(db)
    .withToken(savedToken)
    .withCompression('none')            // 'gzip' | 'brotli' | 'none'
    .withAutomaticReconnect()           // optional { minDelayMs, maxDelayMs }
    .onConnect((_c, _id, token) => {
      void SecureStore.setItemAsync(TOKEN_KEY, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    })
    .onDisconnect((_ctx, _err, nextAttempt, delayMs) => { /* nextAttempt !== undefined => "Reconnecting" */ })
    .onConnectError((_ctx, err, nextAttempt) => { /* log */ });
}
```
Other builder methods present: `withWSFn`, `withLightMode`, `withConfirmedReads`, `withTokenProvider`, `onAutomaticReconnect`. `DbConnection.builder().withUri/withDatabaseName` (not `withModuleName`).

### React usage
```tsx
import { SpacetimeDBProvider, useSpacetimeDB, useTable, useReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings';
// <SpacetimeDBProvider connectionBuilder={builder}>
const { isActive, identity, connectionError, getConnection } = useSpacetimeDB();   // ConnectionState + getConnection()
const [rows, ready] = useTable(tables.mySpikeRows);        // view subscribes like a table; [readonly rows, isReady]
const seed = useReducer(reducers.spikeSeed);               // (args) => Promise<void>; seed({ count: 150 })
```
Indicator logic: "Live" iff `isActive && ready`; otherwise "Reconnecting...". `getConnection()?.isReconnecting` (public getter) gives explicit recovery state. `useTable` supports callbacks `{onInsert,onDelete,onUpdate,enabled}`. Raw SQL view subscription is only needed for views with arguments (not used here).

### Verified sign/verify flow (phone)
`sk = getRandomBytes(32)` (expo-crypto); `pk = ed25519.getPublicKey(sk)`; `msg = spikeMessage(nonceHex)`; `sig = ed25519.sign(msg, sk)`; call `spikeVerify({ pubkeyHex: bytesToHex(pk), message: new TextDecoder().decode(msg), sigHex: bytesToHex(sig) })`; read `tables.myVerifyResults` row `ok`. Noble v2 API name: `ed25519.utils.randomSecretKey()` (v2, not `randomPrivateKey`), but on device use expo-crypto bytes.

## State of the Art

| Old | Current | Impact |
|-----|---------|--------|
| `spacetime init` template as-is | hand flat layout | avoids nested module + agent-rule clutter |
| `metro.config.js` monorepo wiring | automatic in SDK 58 | none needed (verified) |
| skill: `TestAuth.fromJwtPayload(json)` | needs `(json, ConnectionId)` | tests |
| tutorial `withModuleName` | `withDatabaseName` | 2.x API |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `spacetime login --token` does not print the token on success; saves to `cli.toml` `spacetimedb_token` | Pitfall 6 | Token leaks to logs; mitigated by `>/dev/null 2>&1` regardless |
| A2 | Synthetic `focus` dispatch via polyfilled `window.addEventListener` triggers SDK reconnect on AppState `active` | Pitfall 7 | Device test fails; fall back to SDK backoff (max 30 s) which still reconnects |
| A3 | RN 0.88 may or may not define `window.addEventListener` natively | Pitfall 7 | Polyfill handles both; log branch |
| A4 | `publish -y` with remote server needs no extra confirm flag (`-y` = all incl. `remote`) | publish script | Script hangs on prompt; add `--yes=all` explicitly |
| A5 | Ed25519 sign on Hermes is fast enough (tens of ms) | Sign flow | UI lag only |
| A6 | A fresh DB name is free on Maincloud | D-08 | Use suffix fallback |
| A7 | Expo Go store build for SDK 58 is installed on the user's phone and supports tunnel/LAN | Device test | Cannot run device criteria |

## Open Questions (RESOLVED)

1. **Does the `.env` token belong to the same account already logged in locally?** RESOLVED: No — user confirmed it is a different account. All authenticated calls use isolated `spacetime --config-path .spacetime/cli.toml`; the global login is never touched (checksum-verified).
2. **TS ~5.9.3 vs template ~6.0.3** - RESOLVED: keep locked 5.9.3; accept `expo install --check` warning.
3. **Push-procedure spike (D-13)** - RESOLVED: deferred to Phase 3.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node (homebrew node@24) | all | yes | 24.22.2 at `/opt/homebrew/opt/node@24/bin` (system 24.18 too old) | - |
| npm | workspaces | yes | with Node 24 | - |
| Spacetime CLI | build/gen/publish | yes | 2.14.1 current (2.12.0 also installed) | - |
| Spacetime login | publish | yes (existing saved login) | - | token from `.env` |
| Expo Go on phone + same network/tunnel | FND-04/05/06 device criteria | unknown (human) | - | none (manual checkpoint) |
| Maincloud reachability | publish/connect | not tested (no network calls to it) | - | - |

`expo start` needs a human + phone; automation can only run `expo export`.

## Verification (nyquist_validation is false in config; validation commands per criterion)

All commands assume `export PATH=/opt/homebrew/opt/node@24/bin:$HOME/.local/bin:$PATH` from repo root.

| Req | Check | Command | Type |
|-----|-------|---------|------|
| FND-01 | install + typecheck + tests + module build + Metro bundle | `npm install && npm test && npm run typecheck && npm run build && (cd app && CI=1 npx expo export --platform ios --output-dir /tmp/rp-export)` then delete `/tmp/rp-export` (or use scratch dir) | automated |
| FND-01 | engines/pins | `node -e "..."` assert `spacetimedb` is exactly `2.14.1` in server and app package.json; `spacetime --version` prints 2.14.1 | automated |
| FND-02 | gen is idempotent | `npm run gen && git diff --exit-code app/src/module_bindings` | automated |
| FND-03 | both DBs exist | `npm run publish:dev`, `npm run publish:demo` (after checkpoint); then `spacetime describe redphone-hackutd26-dev --json --server maincloud >/dev/null` and same for demo; `spacetime list` | automated after token (needs checkpoint) |
| FND-04 | live view rows, compression off, reconnect | Manual on phone: seed 150 -> row count 150 and list renders; second device/anon identity sees 0; background app 30 s -> foreground -> badge returns to Live; check no "decompress failed" in logs. Server-side confirm: `spacetime logs redphone-hackutd26-dev -n 50` and `spacetime sql redphone-hackutd26-dev "SELECT count(*) FROM spike_row"` (owner-only; run as publisher) | manual (human-verify checkpoint) + automated confirm |
| FND-05 | indicator | Manual: toggle airplane mode -> amber "Reconnecting..." -> green after restore | manual |
| FND-06 | sig verify | Unit: server vitest (vector -> `ok === true`, tampered -> `false`); live: tap Sign & verify -> UI shows true; `spacetime sql ... "SELECT * FROM spike_verify_result"` | automated + manual |
| Anonymous isolation (preview of AUD-05) | `spacetime sql <db> "SELECT * FROM spike_row" --anonymous` should be denied/empty; subscribe to view as anon sees nothing | automated (command semantics `--anonymous` flag exists on publish; confirm for sql with `--help`) |

Test framework: vitest ^3.2.4 in `shared/` and `server/`; quick run `npm test`; no Wave-0 gaps except creating configs/tests (`server/vitest.config.ts`, `server/src/index.test.ts`, `shared/src/index.test.ts`).

## Security Domain

| ASVS | Applies | Control |
|------|---------|---------|
| V2/V3 | partial (token only) | SpacetimeDB anonymous token in SecureStore `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; never log |
| V4 Access control | yes | private tables + `view` on `ctx.sender` index |
| V5 Input | yes | reducer arg caps (`count` <= 500), try/catch around hex decode |
| V6 Crypto | yes | noble Ed25519 only; no `ctx.random` for secrets |

Threats: token leak via shell echo/`set -x` (use redirects, no tracing); committing `.env` (already ignored; add pre-commit grep `SPACETIME_TOKEN=.` in verification); wrong-owner publish (checkpoint); public view leaking all rows if `.iter()`/anonymousView used (use `view` + indexed filter only).

## Sources

### Primary (HIGH) - executed in scratch workspace this session
- `spacetime init/publish/generate/build/login --help`, `spacetime init --lang typescript --server-only --project-path ./server --non-interactive` (layout captured)
- `spacetime build` and `spacetime generate` on a hand-written flat module; `tsc --noEmit`; `vitest run` with `spacetimedb/server/test-utils`
- `npx create-expo-app@5.0.0 app --template default --no-install --no-agents-md -y`; `npm install` in workspace; `npx expo install`; `CI=1 npx expo export --platform ios`
- `spacetimedb@2.14.1` dist: `sdk/db_connection_builder.d.ts`, `sdk/connection_manager.d.ts`, `sdk/index.mjs` (liveness listeners), `react/*.d.ts`
- Official skills at `~/.agents/skills/{typescript-server,typescript-client,cli}/SKILL.md`
- `npm view expo-template-default dist-tags`, `npm view create-expo-app version` (5.0.0)

### Secondary (MEDIUM)
- https://spacetimedb.com/docs/cli-reference/ (login `--token`, `login show --token`)

### Tertiary (LOW)
- None used.

## Metadata

**Confidence breakdown:**
- Standard stack / layout / module / bundling: HIGH - all executed
- Reconnect/AppState bridge and `login --token` output: MEDIUM/LOW - source-read only
- Pitfalls: HIGH for 1-5, MEDIUM for 6-7

**Research date:** 2026-11-07
**Valid until:** 2026-11-08 (hackathon; pins fixed)
