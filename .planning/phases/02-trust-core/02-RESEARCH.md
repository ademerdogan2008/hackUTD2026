# Phase 2: Trust Core - Research

**Researched:** 2026-11-07
**Domain:** SpacetimeDB 2.14.1 TS module (identity, sessions, hash-chained audit, views) + Expo SDK 58 client (device key vault, QR enroll, biometrics)
**Confidence:** HIGH on module mechanics (built + unit-tested in a scratch module against installed 2.14.1); MEDIUM on Expo APIs (official docs, not run on a device); LOW on Hermes PBKDF2 timing (estimate only)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
(D-01..D-22 copied by reference; planner must read `/Users/adem/Documents/GitHub/hackUTD2026/.planning/phases/02-trust-core/02-CONTEXT.md` `<decisions>` verbatim. Key ones: roles/levels D-01, canInvite D-02, setup code via `scripts/gen-setup-code.mjs` + env var D-03, bootstrap max 2 admins D-04, PBKDF2 + xchacha20poly1305 vault D-05, PIN 6 digits + biometrics then PIN D-06, challenge/session D-08, `guard` D-09, SessionManager D-10, scheduled `expire_sessions` + disconnect cleanup D-11, invites D-12/D-13, fingerprint D-14, 2-admin proposals D-15, branch revoke D-16, lockdown D-17, audit chain D-18/D-19, all tables private + views D-20, Expo Router gates D-21, spike moves to `/dev/spike` D-22.)

### Claude's Discretion
File split within `server/src/` (recommend `roles.ts`, `audit.ts`, `guard.ts`, `enroll.ts`, `session.ts`, `admin.ts`, `views.ts`), component structure, exact copy text.

### Deferred Ideas (OUT OF SCOPE)
- Duress PIN -> Phase 5 (STR-04)
- Audit chain verifier UI -> Phase 5 (AUD-03)
- Guest auto-expiry -> v2
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUD-01 | Every state-changing reducer appends audit entry in same tx | `appendAudit(ctx,...)` helper called inside each reducer; head singleton; seq PK (Pattern 4) |
| AUD-02 | Failed security checks recorded, not rolled back | Reducer must RETURN (not throw) after `appendAudit`; throw = tx rollback (Pitfall 1) |
| AUD-04 | Fingerprints visible | `fingerprint` column on member; `roster`/`my_member` views; `fingerprintOf()` in shared |
| AUD-05 | Anonymous sees zero rows | All tables private (default); views gate on member+session via indexed `find`/`filter` (Pattern 5) |
| ENR-01 | Setup-code bootstrap, hash only, dead after 2 admins | Declared module env var `RP_SETUP_CODE_HASH` (Pattern 1) |
| ENR-02..05 | Invite QR, expiry, single-use, downward-only, atomic redeem | Invite table + `canInvite` + PoP (Pattern 6), expo-camera + qrcode-svg (Client) |
| ENR-06..07 | 2-admin approval for promote/demote/revoke admin | `admin_proposal` + `admin_approval` (D-15) |
| ENR-08..09 | Branch revoke, lockdown | Iterative walk on `member.invitedBy` btree; `config.lockdown` in guard |
| UNL-01 | PIN + biometrics, PIN never leaves phone | Vault (Pattern 8), `expo-local-authentication` |
| UNL-02..04 | Challenge-signed session bound to connection, fresh for high-risk | Session keyed by connectionId (Pattern 3), guard `fresh` |
</phase_requirements>

## Summary

All five module-side unknowns resolved against the installed 2.14.1. Module env vars ARE supported and are the right mechanism for D-03: declare `schema({...tables}, { env: { RP_SETUP_CODE_HASH: t.string() } })`, read `ctx.env.RP_SETUP_CODE_HASH` in a reducer, supply at publish as a **process environment variable** of the same name. `--no-config` (used by `scripts/publish.sh`) does not block process env. The fallback (owner-only reducer) is not needed. Two traps: `--delete-data` (used by `publish:dev`) clears env values so the var must be supplied every publish, and the unit-test harness stubs `env_get` to throw, so env-reading code must be a thin wrapper around a pure function.

Four findings change the CONTEXT sketches and the planner must apply them: (1) `Range` index scans do not work inside the vitest harness (instanceof across duplicate bundles) and primary-key indexes have no `filter`; so "last N audit entries" is a `find(seq)` loop from a head counter, and expiry sweeps use `.iter()` in the reducer (tiny table). (2) Views have no `connectionId` (ViewCtx = `sender`, `db`, `env`, `from`), so a view can only check "caller has any live session" by identity; key `session` by `connectionId` (PK) with a btree index on `identity`, not the reverse. (3) `init` runs only on first publish / data reset, so the scheduled timer row must also be ensured idempotently (the existing dev and demo DBs were created in Phase 1 without it). (4) Hermes PBKDF2 speed is unmeasured and likely 10-50x slower than Node (119 ms for 100k iterations in Node 24); calibrate on device and store the iteration count inside the sealed blob.

**Primary recommendation:** Build `shared/` (roles, canInvite, canonical audit hashing, fingerprint, vault seal/open, message formats) first with test vectors; module files per CONTEXT; keep every Range/env/lifecycle-dependent line behind a thin wrapper so the vitest harness covers all logic; extend `scripts/publish.sh` to export `RP_SETUP_CODE_HASH` from `.env`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Device key generation, PIN vault, signing | Phone (app) | `shared/` crypto helpers | Secret never leaves device (UNL-01) |
| Setup code hash storage | Module env var (host) | `scripts/` generator | Never in tables/git |
| Invite secret generation + QR | Inviter phone | Module stores SHA-256 only | ENR-02 |
| Signature verification, session, guard, role checks | Module reducers | `shared/` (canInvite, message builders) | Single source of truth for rules |
| Audit chain | Module (same tx) | `shared/` canonicalization (Phase 5 verifier) | AUD-01 byte-for-byte reuse |
| Read access control | Module views | Private tables | AUD-05 |
| Session refresh / reconnect re-challenge | App `SessionManager` | Module challenge/session tables | D-10 |
| Expiry sweep | Module scheduled reducer | `onDisconnect` hook | D-11 |

## Standard Stack

### Core (module)
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| spacetimedb | 2.14.1 (installed, pinned) | Module + client SDK | Project pin |
| @noble/hashes | 2.4.0 (installed) | `sha256`, `bytesToHex`, `utf8ToBytes`, `pbkdf2` | Already used; pure JS, runs in module runtime and Hermes |
| @noble/curves | 2.4.0 (installed) | Ed25519 verify | Phase 1 proven |
| vitest | ^3.2.4 (installed) | Module tests | Phase 1 |

### Core (app/shared, NEW)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| @noble/ciphers | 2.4.0 | `xchacha20poly1305` from `@noble/ciphers/chacha.js` | `[VERIFIED: npm view]` 2.4.0, MIT, no deps, paulmillr (same author as installed noble libs), no postinstall. Imports end in `.js`. Wrong key throws `invalid tag` (verified in Node). Add to `shared/` (vault lives there so it is Node-testable) and `app/`. |
| expo-camera | ~58.0.14 | `CameraView` QR scan | Bundled native module list for SDK 58 `[VERIFIED: expo/bundledNativeModules.json]` |
| expo-local-authentication | ~58.0.2 | biometric/passcode gate | same |
| expo-haptics | ~58.0.7 | tactile feedback on scan/unlock | same |
| react-native-svg | 15.16.0 (Expo pin; NOT npm latest 15.16.1) | peer of qrcode-svg | same; install via `expo install` |
| react-native-qrcode-svg | 6.3.54 | inviter QR | `[VERIFIED: npm view]`; deps `qrcode`, `prop-types`, `text-encoding`; peer `react-native-svg >=14`; Expensify repo, since 2016 |
| expo-clipboard | ~58.0.4 | optional fingerprint copy | optional |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| hand-rolled `timingSafeEqual` | `@spacetimedb/crypto@0.1.0` | Not installed; adds a dep for a 6-line function. Compare is on equal-length SHA-256 hex, so hand-roll (see Code Examples). |
| scrypt fallback | lower PBKDF2 iterations | scrypt in pure JS is slower than PBKDF2 on Hermes; do not use. |

**Installation (from repo root; Node via `/opt/homebrew/opt/node@24/bin`):**
```bash
npm install -w @redphone/shared -w @redphone/app @noble/ciphers@2.4.0
cd app && npx expo install expo-camera expo-local-authentication expo-haptics react-native-svg
npm install -w @redphone/app react-native-qrcode-svg@6.3.54
# optional: npx expo install expo-clipboard
```
Verify afterwards: `grep '"react-native-svg"' app/package.json` must be `15.16.0` (or `~`-range that resolves to it), then `npx expo-doctor` (or `npx expo install --check`).

**app.json plugins to add:** `["expo-camera", {"cameraPermission": "Red Phone scans invite QR codes in person."}]`, `["expo-local-authentication", {"faceIDPermission": "Unlock Red Phone"}]`. Expo Go ignores them; they matter for any dev/prod build. `[CITED: docs.expo.dev/versions/latest/sdk/camera, /local-authentication]`

## Package Legitimacy Audit

slopcheck could not be installed (pip install denied in this environment), so per protocol every NEW package is tagged `[ASSUMED]` for provenance; registry facts below were checked with `npm view`. Planner: add one `checkpoint:human-verify` before the install task (a single checkpoint covering all rows is sufficient given the evidence).

| Package | Registry | Age | Source Repo | postinstall | slopcheck | Disposition |
|---------|----------|-----|-------------|-------------|-----------|-------------|
| @noble/ciphers | npm | since 2023-06 | github.com/paulmillr/noble-ciphers | none | not run | Approved w/ checkpoint [ASSUMED] |
| expo-camera / expo-local-authentication / expo-haptics / expo-clipboard | npm | 2018-2019 | github.com/expo/expo | none | not run | Approved w/ checkpoint (Expo first party, in bundledNativeModules) |
| react-native-svg | npm | since 2015 | github.com/software-mansion/react-native-svg | none | not run | Approved w/ checkpoint |
| react-native-qrcode-svg | npm | since 2016 | github.com/Expensify/react-native-qrcode-svg | none | not run | Approved w/ checkpoint [ASSUMED] (named only in project STACK research) |

**Removed [SLOP]:** none (unchecked). **Flagged [SUS]:** none (unchecked).

## Architecture Patterns

### System Architecture Diagram

```
 Phone A (inviter)                      Maincloud DB                          Phone B (invitee)
 ---------------                        ------------                          ---------------
 unlock: biometric -> PIN                                                    scan QR (expo-camera)
   -> PBKDF2 -> decrypt device key                                             parse redphone://invite?...
 SessionManager:
  onConnect/12min --request_challenge--> guard: active member
                                          insert challenge{conn,nonce,exp60s}
        <--- my_challenge view -----------
  sign redphone/v1|challenge|nonce|id
        --verify_challenge(sig)--------> check pubkey, delete challenge,
                                          upsert session{conn PK, identity, createdAt, expiresAt}
                                          appendAudit  --------------+
  create_invite(role,name,secretHash) --> guard{fresh,minRole}       |  audit_log (seq PK)
  show QR(secret in QR only)              canInvite() ; insert invite  +- audit_head {seq,hash}
                                                                      (hash chain, same tx)
                                                                      B: gen Ed25519 key, set PIN,
                                       <--redeem_invite(id,secret,pub,PoP)--  seal key with PIN
                                          hash cmp (timing-safe), !used, !expired,
                                          canInvite re-check, verify PoP,
                                          insert member + mark used + audit
 views (public, indexed lookups only, empty unless active member + live session):
  my_member roster my_challenge my_invites admin_proposals audit_feed app_config
 scheduled expire_sessions (60 s, isInternal) + clientDisconnected cleanup + lockdown/revoke deletes sessions
 Failures: appendAudit('security.<reason>') then RETURN (no throw)
```

### Recommended Project Structure
```
shared/src/ roles.ts  audit.ts  messages.ts  fingerprint.ts  vault.ts  index.ts  (+ *.test.ts, test vectors)
server/src/ index.ts(schema+export all)  roles.ts? (re-export from shared)  audit.ts  guard.ts  enroll.ts  session.ts  admin.ts  views.ts
app/src/ crypto/ (keystore.ts, session-manager.ts)  app/(gate)/ app/(app)/ app/dev/spike.tsx
scripts/ gen-setup-code.mjs  publish.sh (export env)
```
Caveat: the schema value (`export default spacetimedb`) must be defined in one module and imported by the others; reducer helpers take `ctx` typed as `ReducerCtx<InferSchema<typeof spacetimedb>>` (see typescript-server skill). All reducers/views/lifecycle hooks MUST be `export const` from the entry file (re-export from `index.ts`).

### Pattern 1: Module env var (D-03) `[VERIFIED: built with spacetime build 2.14.1; CITED: ~/.agents/skills/typescript-server + cli SKILL]`
```ts
const spacetimedb = schema({ config, member, /* ... */ }, {
  env: { RP_SETUP_CODE_HASH: t.string() },   // required: publish fails without a value
});
// reducer wrapper (untestable line) -> pure function (testable)
export const bootstrapAdmin = spacetimedb.reducer(
  { setupCode: t.string(), displayName: t.string(), pubkeyHex: t.string(), popSigHex: t.string() },
  (ctx, a) => doBootstrap(ctx, a, ctx.env.RP_SETUP_CODE_HASH),
);
```
Publish: `RP_SETUP_CODE_HASH=<hex> spacetime ... publish ...`. Precedence: process env > spacetime.json `env` map > stored value. `--no-config` only ignores spacetime.json; the process env still applies. Update only the env: `... publish <db> --env-only`. Values are read from the host on every access (not cached), so rotating via `--env-only` takes effect without re-publish. `ctx.env` also exists in ViewCtx. Never log or return it.
- `scripts/rp-spacetime.sh` reads `.env` through `env_get` and does NOT export it; `scripts/publish.sh` must read `RP_SETUP_CODE_HASH` from `.env` (`sed -n 's/^RP_SETUP_CODE_HASH=//p' .env | head -1`, do not echo) and `export` it before calling `rp-spacetime.sh publish`. Fail early with a clear message if empty (do not print the value).
- `--delete-data` (publish:dev uses `=on-conflict`) clears env values: supply on every publish. The demo DB (no delete) keeps stored value; still supply when first adding the declaration.
- Because config.setupCodeHash (D-17) is no longer needed, drop it; compare `sha256(setupCode)` against `ctx.env` directly. Keep `config.adminCount` or count via a btree index on `member.role`.
- Fallback if ever needed: `init` runs with `ctx.sender` = database owner (publisher) and `ctx.senderAuth.isInternal === false` there `[CITED: reducers.d.ts]`; but `init` only runs on first publish/reset.

### Pattern 2: Lifecycle, connectionId, time `[VERIFIED: tsc + vitest in scratch]`
```ts
export const onConnect = spacetimedb.clientConnected((ctx) => { ensureExpireTimer(ctx); });
export const onDisconnect = spacetimedb.clientDisconnected((ctx) => {
  if (!ctx.connectionId) return;                       // type is ConnectionId | null
  const s = ctx.db.session.connectionId.find(ctx.connectionId);
  if (s) ctx.db.session.connectionId.delete(ctx.connectionId);
  for (const c of [...ctx.db.challenge.connectionId.filter(ctx.connectionId)]) ctx.db.challenge.id.delete(c.id);
});
// time: Timestamp has no .add(); do micros arithmetic
const plus = (ts: Timestamp, micros: bigint) => new Timestamp(ts.microsSinceUnixEpoch + micros);
const expiresAt = plus(ctx.timestamp, 15n * 60n * 1_000_000n);
const expired = (exp: Timestamp, now: Timestamp) => exp.microsSinceUnixEpoch <= now.microsSinceUnixEpoch;
```
`ConnectionId` has `.isEqual()/.equals()`, `.toHexString()`; column `t.connectionId()` works as PK and `.index('btree')`. `Timestamp.since(other)` returns `TimeDuration` (`.micros`). All lifecycle hooks must be `export const`. Required reducer rule: always null-check `ctx.connectionId` (null for scheduled/internal callers).

### Pattern 3: Session keyed by connection (differs from CONTEXT sketch)
```ts
const session = table({ name: 'session' }, {
  connectionId: t.connectionId().primaryKey(),
  identity: t.identity().index('btree'),
  createdAt: t.timestamp(), expiresAt: t.timestamp(),
});
```
Why: `guard` looks up by `ctx.connectionId` (PK `find`); views (no connectionId) look up `session.identity.filter(ctx.sender)` and accept any live session. Same identity on two phones/tabs works; reconnect = new connectionId = new challenge. `verify_challenge` upserts (`find` then `update` / `insert`).
Same shape for `challenge` (autoInc `id` PK, btree on `connectionId`, btree `identity`).

### Pattern 4: Scheduled expiry (D-11) `[VERIFIED: builds; harness call with TestAuth.internal() passes]`
```ts
const expireTimer = table({ name: 'expire_timer' }, {
  scheduledId: t.u64().primaryKey().autoInc(), scheduledAt: t.scheduleAt(),
});
export const expireSessions = spacetimedb.reducer(
  { onSchedule: expireTimer }, { timer: expireTimer.rowType },
  (ctx, _a) => {
    if (!ctx.senderAuth.isInternal) throw new SenderError('internal only'); // throw is fine: nothing to audit
    for (const s of [...ctx.db.session.iter()])              // iter() OK in reducers; table is tiny
      if (s.expiresAt.microsSinceUnixEpoch <= ctx.timestamp.microsSinceUnixEpoch) ctx.db.session.connectionId.delete(s.connectionId);
    /* also expired challenges and invites */
  });
function ensureExpireTimer(ctx) {
  if (ctx.db.expireTimer.count() === 0n)
    ctx.db.expireTimer.insert({ scheduledId: 0n, scheduledAt: ScheduleAt.interval(60_000_000n) });
}
```
Call `ensureExpireTimer` from BOTH `init` and `clientConnected`: Phase 1's dev/demo DBs already exist, `init` will not re-run on a republish, and `--delete-data=on-conflict` only resets on breaking changes. `ScheduleAt`, `Timestamp`, `ConnectionId` import from `'spacetimedb'`; `schema/table/t/SenderError` from `'spacetimedb/server'`. `ctx.senderAuth.isInternal` is true for scheduled reducers and false for `init`. Interval timers are not auto-deleted. A scheduled table is private; bindings will not include it (no client ever needs it).

### Pattern 5: Views, no scan (D-20) `[VERIFIED: tsc + harness; CITED: spacetimedb.com/docs/functions/views]`
- Docs: procedural views may use indexed `find`/`filter` and `count()`, "not through `.iter()` which scans all rows". Views re-run whenever something they READ changes (not incremental), so deleting the session/member row empties the view for that client automatically; the typescript-server skill states the same.
- `PK` indexes expose only `find` (+`update`/`delete`) in 2.14.1 types: no `filter`, no range. Btree non-unique indexes expose `filter(point | Range)`.
- Range scans: `new Range({tag:'included',value}, null)` from `spacetimedb/server` type-checks, but in the vitest harness it throws `Cannot convert undefined to a BigInt` (duplicate module copies break `instanceof Range` inside the harness runtime). Observed and reproduced. Rule: NO `Range` in any code the unit tests execute. Not needed anyway:
- **Last N audit entries (admin only):** keep `audit_head{id:0, seq}`; view loops `for (s = head.seq; s > head.seq - N && s >= 1; s--) out.push(auditLog.seq.find(s))`. N = 50. Verified in harness: returns exactly 50 rows newest first, reads only 51 indexed rows. Read set includes `audit_head`, so the view refreshes on every append (fine for <=a few admins).
- Roster: `member.status` as `t.string().index('btree')` and `ctx.db.member.status.filter('active')` (verified). Use the same btree-on-status for invites (`invite.status`) and proposals.
- Caller gate helper used by every view: `member.identity.find(ctx.sender)` active, not revoked, and `[...session.identity.filter(ctx.sender)].length > 0`. Lockdown deletes non-admin sessions so non-admin views empty out; ALSO check `config.lockdown` for non-admins in the helper (new sessions cannot be created during lockdown anyway).
- Column-subset rows (roster must not expose pubkey): `const RosterRow = t.row('RosterRow', { identity: t.identity().primaryKey(), displayName: t.string(), role: t.string(), fingerprint: t.string() })` and return `t.array(RosterRow)`. The row name must not equal the PascalCased view name (`roster` -> `Roster`). Verified compiling and running. Option-returning views: `t.option(member.rowType)` returning `x ?? undefined`.
- Anonymous callers: `ctx.sender` is a real (token) identity; they get `[]` because no member/session row exists. `app_config` may use `anonymousView` returning `{lockdown}` only.

### Pattern 6: Audit (AUD-01/02) and failure rule
```ts
export function appendAudit(ctx, action: string, fields: Record<string, string|bigint|Uint8Array>) { 
  const head = ctx.db.auditHead.id.find(0) ?? genesis;           // {seq:0n, hash:'0'.repeat(64)}
  const seq = head.seq + 1n; const at = ctx.timestamp;
  const dataHash = sha256Hex(canonicalData(fields));              // from shared/
  const hash = sha256Hex(`redphone/v1|audit|${seq}|${at.microsSinceUnixEpoch}|${ctx.sender.toHexString()}|${action}|${dataHash}|${head.hash}`);
  ctx.db.auditLog.insert({ seq, at, actor: ctx.sender, action, dataHash, prevHash: head.hash, hash });
  upsert head
}
function securityEvent(ctx, reason: string, f = {}) { appendAudit(ctx, `security.${reason}`, f); } // then `return`
```
Throwing (including `SenderError`) rolls back the whole transaction including the audit row, so for D-19 every security failure must append and `return`. Only programmer errors / malformed-type input (before any state touched) may throw. Put the pure hash function in `shared/` (`computeAuditHash`, `canonicalData`) with fixed test vectors (genesis + 2 entries) so Phase 5's verifier matches. Same-transaction atomicity gives AUD-01 for free. Bound all string inputs (e.g. displayName <= 40, hex lengths exact) before hashing.

### Pattern 7: Guard
Order: member exists -> `status==='active'` -> `ctx.connectionId` non-null -> `session.connectionId.find(ctx.connectionId)` exists, `session.identity` equals sender, not expired -> lockdown (non-admin blocked) -> role level >= minRole -> `fresh`: `createdAt` within 5 min. Return `{ok:false}` + audit rather than throwing (D-19). Use `.isEqual()` for Identity (`==` is wrong).

### Pattern 8: Device key vault (UNL-01, D-05) `[VERIFIED in Node; Hermes timing ASSUMED]`
```ts
// shared/src/vault.ts (pure, Node-testable)
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js'; import { sha256 } from '@noble/hashes/sha2.js';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
// blob = [ver:1][iter:u32be][salt:16][nonce:24][ct = 32 key + 16 tag]  (~93 bytes, hex ~186 chars; well under SecureStore limits)
const key = await pbkdf2Async(sha256, pin, salt, { c: iter, dkLen: 32, asyncTick: 10 });
const ct = xchacha20poly1305(key, nonce).encrypt(secretKey);          // wrong PIN -> decrypt throws 'invalid tag'
```
- `pbkdf2Async` yields via `setTimeout(0)` every `asyncTick` ms (verified in @noble/hashes 2.4.0 `nextTick`), so the unlock spinner animates in Hermes; use it in the app, sync `pbkdf2` in tests.
- Node 24 timing: 10k iter = 26 ms, 100k = 119 ms (measured). Hermes has no JIT: expect roughly 10-50x slower, i.e. 1-6 s for 100k `[ASSUMED, LOW]`. So the iteration count is NOT a pure constant: store it in the blob header, and at enrollment calibrate: time 2,000 iterations on-device, scale to a ~250 ms target, clamp to [10_000, 100_000]; `PBKDF2_ITERATIONS_MAX = 100_000` in shared/. Unlock reads the count from the blob. Note honestly in the UI-less docs that a 6-digit PIN has only 10^6 values, so the KDF slows offline guessing only; the real protection is SecureStore hardware wrapping + biometric gate + 5-try lockout. Include a Task to record the real device figure in SUMMARY (no device available so far).
- Domain-separate the salt/info; reserve a version byte so the Phase 5 duress PIN can add a second blob (D-07 hook: `sealSecretKey(pin, sk, opts)` takes an optional `slot` param, unused).
- Store: `SecureStore.setItemAsync('rp.device_key', hex, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY })`; SecureStore failures must never crash (Phase 1 learned: wrap in try/catch).
- Randomness: `expo-crypto` `getRandomBytes(32)` for secret key, salt, nonce, invite secret (polyfilled `crypto.getRandomValues` already installed in `app/src/polyfills.ts`).
- Local lockout: 5 wrong PINs -> 30 s; persist attempt counter + `lockedUntil` in SecureStore so an app restart doesn't reset it.

### Pattern 9: Expo client APIs `[CITED: docs.expo.dev SDK 58]`
```tsx
const [perm, requestPerm] = useCameraPermissions();         // perm is null while loading; check perm.granted
const locked = useRef(false);
<CameraView style={{flex:1}} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
  onBarcodeScanned={(r) => { if (locked.current) return; locked.current = true; Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); handle(r.data); }} />
```
The docs do not say the callback fires once, so the `useRef` lock (already in D-21) is mandatory; reset the lock only on explicit "scan again". Parse with `new URL`-safe manual parsing (Hermes URL is polyfilled in SDK 58 but validate each param by regex: `v=1`, `id` decimal, `s` 64 hex, `db` `^[a-z0-9]+(-[a-z0-9]+)*$`; reject otherwise). Expo Go has scheme `exp://`, so `redphone://` QR codes cannot be opened by the native camera app; scanning must happen inside the app (matches D-21).
Biometrics: `hasHardwareAsync()`, `isEnrolledAsync()`, `authenticateAsync({ promptMessage, fallbackLabel?, disableDeviceFallback: false })` -> `{success:true}` or `{success:false, error:'user_cancel'|'not_enrolled'|'lockout'|'authentication_failed'}`. Face ID does not work in Expo Go (falls back to passcode) - acceptable per D-06. If no hardware and not enrolled, `authenticateAsync` can fail with `not_enrolled`: treat as "proceed to PIN only" and show a notice (device passcode is the fallback; do not hard-block enrolment).
QR display: `<QRCode value={uri} size={280} ecl="M" backgroundColor="white" color="black" />` (invite URI ~130 chars). Haptics: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)`, `notificationAsync(NotificationFeedbackType.Warning|Success|Error)`.
App lifecycle: `AppState` background timestamp; on foreground if >60 s wipe in-memory key (D-10).

### Anti-Patterns to Avoid
- Throwing from a security-failure path (rolls back the audit row, violates AUD-02).
- `Identity ==` comparison; Use `.isEqual()`.
- `.iter()` inside views; `Range` in anything covered by tests; env reads in unit-tested functions.
- Session keyed by identity (breaks multi-connection and cannot tie to connection in guard).
- Trusting `ctx.connectionId` non-null.
- Exposing `pubkeyHex`, `secretHash`, or `nonceHex` of others through views.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ed25519 | custom | `@noble/curves` `ed25519` | Phase 1 proven; RFC8032 vector |
| SHA-256 / PBKDF2 | custom | `@noble/hashes` | audited |
| AEAD | custom | `@noble/ciphers` xchacha20poly1305 | random 24-byte nonce safe |
| Secure random | `Math.random` | `expo-crypto` `getRandomBytes` | CSPRNG |
| Secret storage | AsyncStorage | `expo-secure-store` | keychain/keystore |
| QR render/scan | custom | react-native-qrcode-svg / expo-camera | |
| Tamper-evident ordering | timestamps | seq + prevHash chain | D-18 |
| Timing-safe compare | `===` on secret hashes | 6-line XOR loop (below) | `@spacetimedb/crypto` not installed |

## Runtime State Inventory
Not a rename phase. One migration-flavoured note: dev (`red-phone-6h786-dev`) and demo (`red-phone-6h786`) are existing Phase 1 databases. Adding tables/views/env/schedule is a non-breaking publish for demo (no `--delete-data`); verify with `spacetime publish` prompt output; `init` will NOT re-run, hence `ensureExpireTimer` in `clientConnected`. First publish after adding the required env declaration fails unless `RP_SETUP_CODE_HASH` is exported. Spike tables stay (inert) per D-22. Stored data/OS state/build artifacts: none beyond that.

## Common Pitfalls

### Pitfall 1: Rollback erases audit of failures
Throw => rollback. Use record-and-return. Test: after failed redeem, `auditLog.count()` increased and no member row.

### Pitfall 2: Required env var missing at publish
`publish:dev` runs `--delete-data=on-conflict` which clears env; publish.sh must export the var each time. Warning sign: publish error naming `RP_SETUP_CODE_HASH`.

### Pitfall 3: Timer never created on existing DBs
See Pattern 4. Verify live: sessions older than 15 min disappear (or check `expire_timer` count via dashboard/logs).

### Pitfall 4: View cannot see connectionId
Do not try to bind views to a connection; connection binding is enforced by reducers (guard). Views = "identity has some live session".

### Pitfall 5: Hermes KDF freeze
100k PBKDF2 may take seconds on Hermes. Calibrate, store iterations in blob, use `pbkdf2Async`.

### Pitfall 6: Expo SDK package pins
Use `expo install` for expo-* and react-native-svg (15.16.0, not latest 15.16.1).

### Pitfall 7: Camera scan fires repeatedly
`useRef` lock; unmount the camera after success.

### Pitfall 8: Admin-count race / third bootstrap
Count admins inside the same tx (`member.role` btree filter 'admin' or `config.adminCount`); third attempt -> `security.bootstrap_closed`, return.

### Pitfall 9: Request spam
`request_challenge` for non-members must not insert rows (record `security.challenge_nonmember` and return; consider capping audit spam by only auditing once per identity per minute, or skip auditing unknown identities). Cap challenges per connection to 1 (replace existing).

### Pitfall 10: Revoke walk
Iterative BFS over `member.invitedBy.filter(id)` with a visited set (cycles impossible but guard anyway); never revoke admins via branch walk (D-16: stop at admin descendants and require D-15 path; record `security.revoke_admin_branch_skipped`).

## Code Examples

### Constant-time hex compare (module and shared)
```ts
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
```

### Harness patterns for multiple identities/connections and scheduled/lifecycle `[VERIFIED in scratch]`
```ts
const A1 = TestAuth.fromJwtPayload(JSON.stringify({ iss: 'test', sub: 'alice' }), new ConnectionId(1n));
const A2 = TestAuth.fromJwtPayload(JSON.stringify({ iss: 'test', sub: 'alice' }), new ConnectionId(2n)); // same identity, 2nd connection
const SYS = TestAuth.internal();                                                // isInternal === true
test.withReducerTx(A1, (ctx) => m.requestChallenge(ctx, {}));
test.clock.advance(new TimeDuration(14n * 60n * 1_000_000n));                  // TimeDuration from 'spacetimedb'
test.withReducerTx(SYS, (ctx) => m.expireSessions(ctx, { timer } as any));      // scheduled reducers: call directly
test.withReducerTx(A1, (ctx) => (m.onDisconnect as any)(ctx));                  // lifecycle: call directly
const rows = m.roster(test.viewContext(A1));                                    // views: call the export with a ctx
test.db.member.insert({ ... });                                                 // direct seeding bypasses reducers
```
Harness facts (verified): identity comes from JWT `iss`+`sub`; `ctx.sender.isEqual(...)`; `withReducerTx` commits on return, rolls back on throw; `test.rng`/`test.clock` controllable; lifecycle, scheduling, subscriptions and `ctx.env` are NOT simulated (`env_get` throws "Unsupported SpacetimeDB host syscall"). Create a fresh harness per test.

### Canonical message builders (shared/)
`redphone/v1|challenge|<nonceHex>|<identityHex>` and `redphone/v1|redeem|<inviteId>|<identityHex>|<pubkeyHex>`; add `redphone/v1|bootstrap|<identityHex>|<pubkeyHex>` for D-04 (CONTEXT says same PoP style; define it explicitly). Validate with strict regexes before verifying; never throw on bad input in verify functions (Phase 1 pattern). Provide fixed vectors reusing `RFC8032_TEST1` key.

## State of the Art
| Old | Current | Impact |
|-----|---------|--------|
| ad-hoc secrets in tables | declared module env vars (2.x) | use `ctx.env` |
| `scheduled: () => fn` forward refs | `{ onSchedule: table }` on reducer | use new form |
| views with `.iter()` | indexed lookups only | see Pattern 5 |

## Assumptions Log
| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Hermes PBKDF2 is 10-50x slower than Node (1-6 s at 100k) | Pattern 8 | Calibration handles it; if far worse, lower clamp floor |
| A2 | Host rejects/penalizes `.iter()` in views (docs say not allowed); not exercised live (no publish done) | Pattern 5 | Avoided by design |
| A3 | View re-evaluates and empties on session delete (docs + skill; not exercised live) | Pattern 5 | Add a live smoke assertion (below) |
| A4 | New packages not slopchecked | Audit | Human checkpoint before install |
| A5 | `Range` works in the real host bundle (it fails only in the harness) | Pattern 5 | Not used |
| A6 | SecureStore handles ~190-char value on iOS/Android | Pattern 8 | Low (limit ~2 KB) |

## Open Questions
1. **Hermes PBKDF2 real cost** - no device available (Phase 1 phone test still outstanding). Recommendation: calibrate on-device (Pattern 8), log timing in a dev screen; do not hardcode 100k.
2. **Live bootstrap smoke needs the setup code** (only the hash is in `.env`). Recommendation: smoke test reads `RP_SMOKE_SETUP_CODE` from env (skip test if absent) and expects a freshly reset dev DB (`publish:dev` with `--delete-data=always`, add a `publish:dev:reset` script); it consumes both admin slots.
3. **Deep link scanning outside the app** is not supported in Expo Go (see Pattern 9); accept.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all | yes | 24 (`/opt/homebrew/opt/node@24/bin`) | none needed |
| spacetime CLI | build/publish/gen | yes | 2.14.1 | none |
| Maincloud network | live smoke | assumed yes (Phase 1 smoke) | - | skip live tests |
| Physical phone / Hermes | KDF timing, camera | no | - | calibrate-at-runtime; human-verify checkpoint |
| slopcheck | package audit | no (install denied) | - | human-verify checkpoint |
| hermes VM binary | benchmark | no (`hermesc` is compile-only, `-exec` unsupported) | - | estimate |

## Verification Commands (nyquist_validation is false; commands listed for the planner)

Framework: vitest ^3.2.4 (`npm test` = shared + server), `npm run typecheck`, `npm run build`, `npm run gen`, `npm run smoke`.

| Req | Behavior | Command | Notes |
|-----|----------|---------|-------|
| D-02/ENR-04 | canInvite full role x role matrix | `npm test -w @redphone/shared` | table-driven, all 10x10 |
| AUD-01 | each state-changing reducer adds exactly one audit row; chain verifies (recompute from genesis) | `npm test -w @redphone/server` | helper `verifyChain(test.db.auditLog)` |
| AUD-01 | canonical hash test vectors | `npm test -w @redphone/shared` | genesis + 2 |
| AUD-02 | bad sig / expired / used invite / unauthorized role -> `security.*` audit row, no state change, no throw | server tests | `expect(() => ...).not.toThrow()` |
| AUD-04 | fingerprint = first 16 hex of sha256(pubkey) grouped 4x4 | shared | |
| AUD-05 | stranger auth: every view returns [] ; seeded members + no session -> [] | server (`viewContext`) | |
| ENR-01 | bootstrap succeeds twice, third records `security.bootstrap_closed`; wrong code rejected; (inner fn takes hash param) | server | env not testable in harness |
| ENR-02/03 | create_invite stores hash only; expires at 10 min (`clock.advance`); second redeem fails | server | |
| ENR-05 | redeem atomically creates member, marks used, audit row | server | |
| ENR-06/07 | proposer + second distinct admin executes; target cannot approve; same admin twice no-op | server | |
| ENR-08 | revoke descendants (3-deep tree), sessions/invites deleted, admin descendants handled | server | |
| ENR-09 | lockdown blocks non-admins; sessions removed; admin still works; lift restores | server | |
| UNL-02/03 | no signature -> no session; wrong key sig fails; challenge single-use, expires 60 s; session bound to ConnectionId(1) rejects ConnectionId(2) of same identity | server | |
| UNL-04 | fresh action fails at 6 min, passes at 4 min | server (`clock.advance`) | |
| D-11 | `expire_sessions` removes expired, rejects non-internal; disconnect hook cleans | server | |
| UNL-01 | vault seal/open round trip, wrong PIN throws, iteration header honored | shared (sync pbkdf2) | |
| Build | module + bindings + app compile | `npm run build && npm run gen && npm run typecheck` | `gen` must produce views, not private tables |
| Live | publish dev then `npm run smoke` extended: anonymous connect sees 0 rows in all subscribed views (AUD-05/UNL-03), token-only caller reducers fail, bootstrap with `RP_SMOKE_SETUP_CODE` then challenge->session->roster non-empty; disconnect then roster empty; session older than expiry vanishes | `npm run publish:dev && npm run smoke` | publish only on explicit user go-ahead |
| Manual (human-verify) | phone: scan QR, PIN, biometric prompt, KDF timing, background wipe >60 s | Expo Go | outstanding from Phase 1 too |

Wave 0: `shared/` test files for roles, audit vectors, vault; server test helper `makeWorld()` (admins A1/A2, lead, member, ConnectionIds) and `verifyChain`; install packages (needs checkpoint).

## Security Domain

| ASVS | Applies | Control |
|------|---------|---------|
| V2 Authentication | yes | Ed25519 challenge-response PoP; Spacetime token alone insufficient |
| V3 Session | yes | connection-bound session, 15 min, fresh 5 min, server expiry sweep |
| V4 Access Control | yes | `guard`, `canInvite`, views gated on member+session |
| V5 Input Validation | yes | strict hex/length regexes, display name bounds, `t.*` typed args |
| V6 Cryptography | yes | noble libs only; never hand-roll; timing-safe compare; domain-separated messages |

| Threat | STRIDE | Mitigation |
|--------|--------|-----------|
| Stolen token reused | Spoofing | needs device-key signature for any session |
| Invite replay / brute force | Tampering | single-use, 256-bit secret, 10 min, hashed at rest |
| Setup code theft from repo | Info disclosure | hash only in env var, not in tables; never logged |
| Audit tampering | Tampering | hash chain; Phase 5 verifier |
| Audit/table spam | DoS | length caps, no rows for non-member challenge, one challenge per connection |
| Secret in logs | Info disclosure | no `console.log` of env/args (Maincloud logs visible) |

## Sources
### Primary (HIGH)
- Installed `spacetimedb@2.14.1` d.ts/source: `lib/reducers.d.ts`, `lib/environment.d.ts`, `lib/indexes.d.ts`, `server/views.d.ts`, `server/test-utils/*`, `runtime.ts` (Range serialization)
- `spacetime publish --help` (2.14.1): `--env-only`, `--unset-env`, `--replace-env`, env precedence text
- `~/.agents/skills/typescript-server`, `cli`, `concepts` SKILL.md
- Scratch module `/private/tmp/claude-501/-Users-adem-Documents-GitHub-hackUTD2026/b72b2d71-9240-427e-8d88-3a2e351dc021/scratchpad/mod` (built with `spacetime build`; 5 vitest tests pass)
- https://spacetimedb.com/docs/functions/views (no `.iter()`, re-evaluation)
- https://docs.expo.dev/versions/latest/sdk/camera/ , /local-authentication/
### Secondary (MEDIUM)
- `npm view` registry data for new packages; Node PBKDF2 benchmark in scratchpad `nb/`
### Tertiary (LOW)
- Hermes speed multiplier (training knowledge)

## Metadata
**Confidence:** Standard stack HIGH (versions from registry/bundledNativeModules); Architecture HIGH (module side executed); Pitfalls HIGH/MEDIUM; Hermes KDF LOW.
**Research date:** 2026-11-07. **Valid until:** hackathon (2026-11-08); stable.
