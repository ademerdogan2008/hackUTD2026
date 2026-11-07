# Walking Skeleton — Red Phone

**Phase:** 1
**Generated:** 2026-11-07

## Capability Proven End-to-End

A developer opens the Expo Go app on a physical phone. The phone connects to the Red Phone module on Maincloud. It seeds 150 rows and sees them arrive live through a per-sender view. It shows a Live / Reconnecting badge that survives background, foreground, and airplane mode. It signs a message with an on-device Ed25519 key, and the published module verifies the signature and returns `ok = true`.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Repo shape | npm workspaces at root: `server/` (`@redphone/server`), `shared/` (`@redphone/shared`), `app/` (`@redphone/app`). One root `package-lock.json`. | One install and one lockfile. TypeScript runs on both sides. Research verified that Metro and the Spacetime bundler both resolve `@redphone/shared` TS source with no build step, no `metro.config.js`, and no sync script (D-01, D-05 fallback not needed). |
| Toolchain pins | `spacetimedb@2.14.1` exact (server + app), Spacetime CLI 2.14.1, Node >= 24.22.1 (`/opt/homebrew/opt/node@24/bin`), TypeScript `~5.9.3` in every workspace, vitest `^3.2.4`, `@noble/curves@2.4.0`, `@noble/hashes@2.4.0`, Expo SDK 58 | 2.11+ has the identity-impersonation fix. 2.13+ has views with arguments. CLI and npm lib must match. TS 5.9.3 is locked; ignore the Expo `typescript ~6.0.3` warning (D-02, Pitfall 5). |
| Module layout | Flat hand-written `server/` (`package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`). Do not use `spacetime init`. Do not commit `spacetime.json`. Every scripted CLI call passes explicit flags plus `--no-config`. | Research overrides D-03. Init nests the module and drops about 30 KB of agent rule files into the repo. |
| Data layer | SpacetimeDB on Maincloud. All tables are **private** (the default). Clients read only through `spacetimedb.view({ public: true })` views that use an **indexed** `filter(ctx.sender)` / `find(ctx.sender)`. Never `.iter()` in views. Never `anonymousView` for per-user data. Never RLS. | Server-enforced per-caller visibility. Phase 2 (AUD-05, UNL-03) builds directly on this pattern. |
| Databases | `redphone-hackutd26-dev` (may use `--delete-data=on-conflict`) and `redphone-hackutd26-demo` (never `--delete-data`). If a name is taken, the fallback is a short suffix, recorded in `.env.example` comments, in `scripts/publish.sh`, and in `app/app.config.ts`. | D-07, D-08. |
| Deployment | `npm run publish:dev` and `npm run publish:demo` call `scripts/publish.sh`. That script reads `SPACETIME_TOKEN` from the gitignored root `.env`, logs in silently, and publishes. All authenticated CLI calls go through `scripts/rp-spacetime.sh`. That wrapper always passes `--config-path .spacetime/cli.toml`, an isolated, gitignored, project-local CLI config. | User constraint: the machine's global `~/.config/spacetime/cli.toml` belongs to another project and must never be modified. |
| Secrets | Only `SPACETIME_TOKEN` is secret. It lives in root `.env` (gitignored) and in `.spacetime/cli.toml` (gitignored). It is never echoed, logged, committed, or copied into agent/MCP config. Scripts never use `set -x`, and login output goes to `/dev/null`. | D-06, PROJECT constraint. |
| Client identity (Phase 1) | SpacetimeDB anonymous identity token. On first connect it is persisted with `expo-secure-store` under key `rp.spacetime_token` with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. Phase 2 adds Ed25519 device keys and signed sessions on top. | D-15. A bearer token never goes in AsyncStorage. |
| Client connection | A single factory, `app/src/spacetime/connection.ts`: `DbConnection.builder().withUri(host).withDatabaseName(db).withToken(saved).withCompression('none').withAutomaticReconnect()`. `SpacetimeDBProvider` is built once, after the token loads. Reads use `useTable(tables.<view>)` and writes use `useReducer(reducers.<name>)`. | Hermes has no `DecompressionStream`, so compression must be off. The SDK owns reconnect: never write a custom retry timer. |
| Mobile lifecycle | `app/src/polyfills.ts` is the first import of `app/src/app/_layout.tsx`. It installs `crypto.getRandomValues` (from `expo-crypto`) and a `window.addEventListener` event bus. It also dispatches a synthetic `focus` on `AppState` `active`, so the SDK liveness check reconnects on resume. | D-14, D-16, research Pitfall 7. |
| Crypto | `@noble/curves/ed25519.js` and `@noble/hashes/utils.js` (subpaths need the `.js` suffix), used on both sides through `@redphone/shared`. Signed messages are ASCII strings with a versioned prefix (`redphone/v1|<purpose>|...`). The fixed test vector is checked in vitest on both sides. | One byte-exact format shared by phone and module. No `crypto.subtle` in the module. No `ctx.random` for secrets. |
| Bindings | `npm run gen` = `spacetime generate --lang typescript --out-dir app/src/module_bindings --module-path server -y`. Output is committed. Private tables are skipped, and only views and reducers are emitted. | D-04. |
| Routing | Expo Router. The router root is `app/src/app/`. The `@/*` alias points at `app/src/*`. Phase 1 has a single route, `index.tsx` (the spike screen). | Template default. |
| Tests | vitest in `shared/` (plain node) and `server/` (`spacetimedb/server/test-utils/vitest` plugin plus `createModuleTestHarness`; `TestAuth.fromJwtPayload(json, new ConnectionId(n))`). Root `npm test` runs both. The app is checked with `tsc --noEmit` and `expo export` for ios and android. | D-18. |

## Directory Layout

```
/ (repo root)
├── package.json            # workspaces, engines, scripts: build gen test typecheck publish:dev publish:demo
├── package-lock.json       # the ONLY lockfile
├── .nvmrc                  # 24.22.2
├── .env                    # gitignored: SPACETIME_TOKEN=
├── .env.example            # committed, empty values + db-name comments
├── .spacetime/             # gitignored: project-local CLI config (cli.toml), global checksum baseline
├── scripts/
│   ├── rp-spacetime.sh     # spacetime --config-path .spacetime/cli.toml "$@"
│   └── publish.sh          # dev|demo
├── shared/src/index.ts     # message formats, sign/verify helpers, test vectors
├── server/src/index.ts     # schema, reducers, views (spike_* in Phase 1)
└── app/
    ├── app.config.ts       # extra.spacetime { host, db } from EXPO_PUBLIC_* with defaults
    └── src/
        ├── polyfills.ts
        ├── config.ts
        ├── spacetime/{connection.ts, SpacetimeRoot.tsx}
        ├── components/ConnectionBadge.tsx
        ├── module_bindings/  # generated, committed
        └── app/{_layout.tsx, index.tsx}
```

## Stack Touched in Phase 1

- [x] Project scaffold: npm workspaces, Expo SDK 58 app, flat module, vitest, tsc (Plan 01) -- 01-05: npm test 9/9, typecheck, build, expo export ios+android OK
- [x] Routing: one real route `app/src/app/index.tsx` (Plan 04) -- 01-05: route rendered in Expo web (headless Chrome)
- [x] Database: a real write (`spike_seed`, `spike_touch`, `spike_verify`) and a real read (views `my_spike_rows`, `my_verify_results`) (Plans 02, 03) -- 01-05: npm run smoke 6/6 on red-phone-6h786-dev; owner SQL COUNT(*)=150; anonymous my_spike_rows empty, spike_row private
- [x] UI: Seed / Touch / Sign & verify buttons wired to reducers, a live list, and a connection badge (Plan 04) -- 01-05: Expo web headless Chrome: Live, Rows 0->150, Touch, verify true/false MATCH. Reconnecting badge NOT yet seen on device
- [x] Deployment: published to Maincloud dev and demo databases (Plan 03) -- 01-05: dev DB exercised headlessly
- [ ] OUTSTANDING (human-verify): exercise from a physical phone in Expo Go (Hermes, native SecureStore, AppState background/foreground, airplane-mode Reconnecting badge)

Device: NOT RUN (no physical phone/simulator available); web polyfill native=true, sign 10 ms (web)

## Out of Scope (Deferred to Later Slices)

- Enrollment, roles, invites, PIN/biometric unlock, and signed sessions (Phase 2)
- Hash-chained audit log and `guard()` (Phase 2)
- Push procedure to `exp.host`, `eas init` / EAS projectId, and notification permissions (Phase 3, D-13)
- Incidents, alarm, chat, playbooks, and the status board (Phases 3-4)
- Real product screens and visual design system (Phase 2 onward)
- Android preview APK / dev builds (v2, V2-07)
- `react-native-url-polyfill`. Add it only if the device test shows that the URL setter fails (D-14).

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: An Admin enrolls a member in person by QR. The member unlocks with PIN plus biometrics and gets a signed session. Every change is recorded in the audit chain.
- Phase 3: Two people confirm an attack, every phone alarms, and responders check in and chat.
- Phase 4: The Lead picks Ransomware, and each role sees its next pre-approved task and a live status board.
- Phase 5: The Admin verifies the audit chain, resets the demo, and judges run the tabletop on their own phones.
