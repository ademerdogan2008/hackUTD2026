# Pitfalls Research

**Domain:** Out-of-band cyber incident response app (Expo React Native client + SpacetimeDB 2.x TypeScript module on Maincloud), one hackathon weekend
**Researched:** 2026-11-07
**Confidence:** MEDIUM-HIGH overall. SpacetimeDB server-side items are HIGH: they come from the official skills, the docs, and the shipped SDK source (`spacetimedb@2.14.0`, read directly). Expo items are HIGH where they come from Expo docs. React Native runtime compatibility of the SpacetimeDB client is MEDIUM/LOW: there is no official RN support statement, so those items were derived from reading the SDK source and must be smoke-tested on a device.

**Phase names used below** (suggested; the roadmapper may rename):
- **P1 Foundation:** repo scaffold, module skeleton, Maincloud publish pipeline, Expo app connecting on a real phone
- **P2 Enrollment & Auth:** bootstrap Admins, QR invites, device key, PIN/biometric unlock, signed challenge, per-role views
- **P3 Incident Response:** raise/confirm alert, push, check-in, playbook tasks, status board, chat channels
- **P4 Audit & Hardening:** hash-chained audit log, lockdown, revoke branch, scheduled escalation, security review
- **P5 Demo Readiness:** app distribution to judges, judge enrollment flow, rehearsal, venue network fallback

---

## Critical Pitfalls

### Pitfall 1: The SpacetimeDB client SDK breaks on Hermes because of default gzip compression

**What goes wrong:**
The `spacetimedb` client defaults to `compression: 'gzip'` (`db_connection_builder.ts`: `#compression = 'gzip'`). It then decompresses server frames with `new DecompressionStream(type)` (`sdk/decompress.ts`). Hermes/React Native has no `DecompressionStream`. Small messages may arrive with tag 0 (uncompressed) and work. The first large frame then fails: the initial subscription replay, or a playbook load that inserts many task rows. The SDK logs `[SpacetimeDB] WebSocket decompress failed, closing socket` and enters a reconnect loop.

**Why it happens:**
The SDK targets browsers and Node, and its docs list only those. A quick "hello world" with tiny rows passes, so the bug shows up mid-build or mid-demo.

**How to avoid:**
Always build the connection with `.withCompression('none')` in the Expo app. Put it in the single connection factory so no screen can build a connection without it.

**Warning signs:**
- Connection works with an empty DB, then flaps once data grows.
- `ReferenceError: DecompressionStream` or "decompress failed" in the Metro logs.
- `onDisconnect` fires right after `onApplied` should have fired.

**Phase to address:** P1 Foundation. The first on-device smoke test must load more than ~100 rows.

---

### Pitfall 2: Other browser globals the SDK assumes may be missing or partial in React Native

**What goes wrong:**
The SDK source uses these browser globals:
- `new TextDecoder('utf-8')` at module load (`lib/binary_reader.ts`).
- `TextEncoder`.
- `new URL(relative, base)`, the `url.protocol = 'https:'` setter, and `url.searchParams.set(...)` (`sdk/ws.ts`).
- `Headers` and `fetch`. On connect with a stored token, it POSTs to `/v1/identity/websocket-token` before opening the socket.
- `window.addEventListener('focus'|'online'|'pageshow')`, installed on every socket open when automatic reconnect is on (`#installLivenessListeners`). The React provider always forces automatic reconnect.

React Native's built-in `URL`/`URLSearchParams` have historically thrown "not implemented" for setters and `searchParams.set`. RN defines `window` as the global object but does not implement `window.addEventListener`. The likely result is a `TypeError` inside `onopen`.

**Why it happens:**
Nobody at Clockwork Labs ships or tests a React Native target. Expo SDK 58 ships RN 0.88.1. Native Hermes `TextDecoder` reportedly landed around RN 0.85, so that one is probably fine. The URL and `window` items are unverified.

**How to avoid:**
Create a `polyfills.ts` imported as the very first line of the entry file (before anything that imports `spacetimedb`). It should contain:
- `import 'react-native-url-polyfill/auto'`
- a guarded shim: `if (typeof window !== 'undefined' && typeof window.addEventListener !== 'function') { window.addEventListener = () => {}; window.removeEventListener = () => {}; }`
- a `TextDecoder` polyfill only if `typeof TextDecoder === 'undefined'`
- the `crypto.getRandomValues` polyfill (see Pitfall 12).

Because the browser liveness listeners are now no-ops, wire RN `AppState` `'active'` to a reconnect check yourself (see Pitfall 10).

**Warning signs:**
- `URL.protocol is not implemented`, `URLSearchParams.set is not implemented`, or `window.addEventListener is not a function` in logs.
- The first launch (no token) connects, but the second launch (token present, so the websocket-token POST path runs) fails, or vice versa.

**Phase to address:** P1 Foundation. Keep this in a "device connectivity spike" task that must pass before any feature work.

---

### Pitfall 3: CLI, SDK, and bindings version drift

**What goes wrong:**
- The local CLI is 2.12.0, but npm `spacetimedb` latest is 2.14.1 (published 2026-11-04).
- Bindings generated by a 2.12 CLI can be paired with a 2.14 client SDK, or the module can be built against a different `spacetimedb` version than the CLI. The result is type errors or runtime decode errors.
- Features you read about in the skills may not exist in your pinned version: views with arguments (2.13+), `ctx.random.shuffle` (2.13+), and the unit-test harness (2.12+).
- After any schema or reducer change, forgetting `spacetime generate` leaves the app calling reducers with old signatures and subscribing to tables that no longer exist.

**Why it happens:**
There are three moving parts (CLI, module package, client package) plus generated code, and Expo/Metro caches stale bindings.

**How to avoid:**
- Pick one version. Either run `spacetime version upgrade` to match npm, or pin `"spacetimedb": "2.12.0"` exactly (no caret) in both `server/package.json` and `app/package.json`.
- Add one script, `npm run gen`, that does publish + `spacetime generate --lang typescript --out-dir app/src/module_bindings --module-path server`. Run it after every module change.
- Commit the generated bindings so diffs show drift.
- Avoid 2.13+-only features unless you upgrade.

**Warning signs:**
- TS errors inside `module_bindings`.
- "no such reducer" or "signature mismatch" errors.
- A reducer call promise rejects instantly after a schema change.
- `spacetime --version` differs from `npm ls spacetimedb`.

**Phase to address:** P1 Foundation (pin and script). Re-check at the start of P5.

---

### Pitfall 4: Using `ctx.random` or client-supplied values for secrets

**What goes wrong:**
The reducer RNG is deterministic by design. The TS module runtime builds it as `xoroshiro128plus(pcg32(seed))`, with the seed taken from `ctx.timestamp.microsSinceUnixEpoch` (`server/rng.ts`). Anyone who knows roughly when a reducer ran can predict its "random" output. Generating the invite secret, the bootstrap setup code, or anything bearer-like with `ctx.random` makes them guessable.

**Why it happens:**
Docs correctly say "use ctx.random instead of Math.random". Developers read that as "ctx.random is secure randomness". It isn't; it only keeps replicas consistent.

**How to avoid:**
- Generate every secret on a device CSPRNG: the 32-byte invite secret, the Ed25519 private key, and the setup code. Use `expo-crypto` `getRandomBytes`/`getRandomValues`.
- The server only ever receives and stores `sha256(secret)`.
- Server challenge nonces from `ctx.random` are acceptable only because the challenge row is server-stored, single-use, short-expiry, and must be signed by the device key. Never treat a nonce as a secret.
- Optionally mix client entropy into the signed message.

**Warning signs:**
`ctx.random` appears anywhere near the words secret, code, token, or invite.

**Phase to address:** P2 Enrollment & Auth.

---

### Pitfall 5: Comparing `Identity` objects with `===` or `!==`

**What goes wrong:**
`Identity` is an object, so `a === b` compares references. It is always false for two decoded identities, even when they hold the same value. GitHub issue clockworklabs/SpacetimeDB#3490 shows exactly this: a scheduled-reducer guard `ctx.sender !== ctx.identity` rejected every legitimate call. The failure has two directions:
- **Fail-closed:** `if (!(row.owner === ctx.sender)) throw` always throws. Annoying but safe.
- **Fail-open:** `if (approver === candidate) throw 'cannot self-approve'` never fires. Admin self-promotion becomes possible.

The same class of bug hits `bigint` vs `number`: `row.id === 5` is false for `5n`.

**How to avoid:**
- Compare identities only with `.isEqual()` (or `.equals()`, per the skill), or compare `toHexString()` values.
- Write a single `sameIdentity(a, b)` helper and lint for `=== ctx.sender` / `!== ctx.sender`.
- Use `0n` literals for u64 IDs.

**Warning signs:**
- Every authorized call fails with "unauthorized".
- A negative test ("self-approve should fail") passes when it should fail.

**Phase to address:** P2 (first auth checks). Add unit tests that assert both the allowed and the denied path.

---

### Pitfall 6: Public tables leak everything to anyone on the internet

**What goes wrong:**
A Maincloud database is reachable by anyone. Any client can connect anonymously, get an identity, subscribe, and call any exported reducer. `public: true` exposes every row and every column of that table to every subscriber, members or not. Typical leaks:
- `invite.secret_hash`, inviter, and role.
- `challenge` nonces.
- Push tokens.
- Counsel-channel messages.
- `audit_log`, which reveals actor and action history.
- `member` public keys and statuses, visible to outsiders.

Making `member` public "because all members see names" also shows it to non-members.

**Why it happens:**
The web quickstarts mark tables `public: true` to get `useTable` working fast.

**How to avoid:**
- Make every table private (the default).
- Expose data only through per-caller views (`spacetimedb.view`, keyed on `ctx.sender`). Each view first looks up the caller's active `member` row by a unique index on identity, and returns `[]` if there is none or the member is revoked.
- Project columns in the view so push tokens and hashes never leave the server.
- Write one view per visibility rule in plan.md §6:
  - `my_member`
  - `roster` (names and roles only)
  - `my_invites` (inviter and Admins)
  - `my_challenge`
  - `incident_*`
  - `channel_messages` (counsel only if the caller's role is Counsel or Lead)
  - `audit_log_admin`
  - `clocks_for_counsel_lead`
- Use `anonymousView` only for data that is safe for strangers. Almost nothing here qualifies; seeded playbook text is the borderline case.
- Prefer views over RLS `clientVisibilityFilter`. The official docs recommend views first, and RLS adds complexity and overhead.

**Warning signs:**
- Any table definition with `public: true`.
- Connecting with a fresh anonymous client (no token) and seeing rows.

**Phase to address:** P2 Enrollment & Auth. Build the view layer alongside the first tables, not retrofitted. Add a P4 checklist item: "fresh anonymous client sees nothing".

---

### Pitfall 7: View restrictions surprise you (no full scans, no PK means no onUpdate)

**What goes wrong:**
- Views may read tables only via indexed lookups (`.find()` / `.filter()` on indexed columns) and `count()`. Calling `.iter()` is not allowed. A view written as `[...ctx.db.message.iter()].filter(...)` fails. (The skill's anonymousView example uses `iter()`, but the views doc forbids it, so treat the doc as authoritative and verify on publish.)
- Procedural views without a `.primaryKey()` column in their returned `t.row` type deliver only insert/delete, never `onUpdate`. Task status changes then look like delete-and-insert, which causes UI flicker and lost animation state.
- Per-sender views are recomputed per subscriber.
- Subscription SQL has these limits:
  - no `ORDER BY`, `LIMIT`, aggregates, or column projection
  - at most a 2-table join on indexed columns.

  So "latest 50 messages" can't be a subscription; you must sort client-side.

**How to avoid:**
- Index every column a view filters on: `member.identity` unique; `message.incidentId`/`channel` btree; `task.assignedTo` btree; `invite.createdBy` btree.
- Declare a PK in each view's row type.
- Sort and limit on the client: copy `useTable` rows (`[...rows]`) because they are readonly.

**Warning signs:**
- Publish errors mentioning view read restrictions.
- Rows flash on status change.
- Large read sets in the energy metrics on the dashboard.

**Phase to address:** P2 (first views); reuse the pattern in P3.

---

### Pitfall 8: Trusting role, level, or identity from reducer arguments (invite escalation, Admin self-promotion)

**What goes wrong:**
- `redeem_invite(secret, role, name)` that takes `role` from the args lets the redeemer pick Admin.
- `create_invite(role)` without checking the inviter's level against the matrix lets a Lead mint Leads, or a Counsel mint Members.
- `approve_admin` counting the same approver twice, or the candidate approving themselves, or the proposer counting as an approver, lets one person become Admin.
- `bootstrap` callable after two Admins exist lets the first attacker who reaches the DB take over.

**Why it happens:**
Reducers are public functions on a public endpoint. Any argument is attacker-controlled. `ctx.sender` is the only trusted principal (concepts skill, Critical Rule 5).

**How to avoid:**
- Role and level for a new account come only from the stored `invite` row.
- `create_invite` checks a hard-coded `CAN_INVITE[inviterRole]` allow-list and `targetLevel < inviterLevel`. Note that "Counsel invites Guests" means a role-specific list, not just a level comparison.
- Store admin approvals in an `admin_approval` table with a unique index on `(candidate, approver)`. Require 2 distinct approvers, both active Admins, neither equal to the candidate (using `.isEqual`).
- `bootstrap_admin` compares `sha256(code)` against a hash supplied via a declared module env var (`ctx.env`), not committed to git. It sets a singleton `config.bootstrapped` flag after the second Admin and refuses forever after.
- `redeem_invite` also rejects:
  - if `ctx.sender` already has a member row (one identity, one account)
  - if the inviter is no longer active
  - if lockdown is on.

**Warning signs:**
- Any reducer signature containing `role`, `level`, `memberId`, or `identity` for the caller.
- No negative tests.

**Phase to address:** P2. Re-audit in P4 with a table of reducer × required role × checks.

---

### Pitfall 9: Invite redemption races, double scans, and expiry using the wrong clock

**What goes wrong:**
- `CameraView`'s `onBarcodeScanned` fires many times per second while the QR is in frame. Without a lock, the app calls `redeem_invite` 3-10 times. The first succeeds and the rest fail with "invite already used", so the judge sees an error after a successful enrollment.
- Expiry computed or displayed with the phone clock drifts.
- A QR on screen can be photographed by a bystander and redeemed first.

**How to avoid:**
- Gate scanning with a `useRef` flag. Set it on the first scan, unmount or pause the camera, and only reset it on explicit retry.
- Server sets `expiresAt = ctx.timestamp + 10 min` in `create_invite`, and `redeem_invite` compares against `ctx.timestamp`. Client countdowns are cosmetic.
- After redemption, show the new member's key fingerprint on the inviter's screen (they subscribe to `my_invites`, which shows `usedBy` and fingerprint). The inviter confirms it matches the redeemer's phone. Optionally let the inviter revoke instantly if it doesn't match.
- Single-use is enforced atomically in one reducer: find by unique `secretHash`, check `usedBy` is none and not expired, set `usedBy`, insert `member`, all in one transaction.

**Warning signs:**
"Invite already used" appears right after a successful scan; multiple redeem calls appear in the Maincloud logs.

**Phase to address:** P2. Rehearse in P5 with 5+ phones.

---

### Pitfall 10: Treating the WebSocket as always-on on phones

**What goes wrong:**
- iOS and Android suspend JS shortly after backgrounding, so the socket dies silently.
- The SDK's resume detection hooks `document.visibilitychange` and `window` focus/online events, none of which fire in RN. A returning user sees stale cached rows ("readable but stale") and thinks they're live.
- Reducer calls made while disconnected fail immediately.
- In-flight calls reject with `UnknownCallResultError` when the connection drops. The server may already have executed them, and auto-retrying `raise_alert` or `send_message` duplicates them.

**How to avoid:**
- On `AppState` change to `'active'`, check `conn.isActive`. If the socket is closed and the SDK is not already reconnecting, disconnect and rebuild via the provider (or bump a connection key).
- Show a persistent "Reconnecting..." banner driven by `isActive` plus each table's `isReady`.
- Give non-idempotent reducers a client-generated `clientNonce` (u128 or a string). The module stores it with a unique index so a retry is a no-op.
- Never auto-retry on `UnknownCallResultError`; show "check whether it went through".

**Warning signs:**
Messages sent after unlocking from the push are missing, or appear twice.

**Phase to address:** P1 (AppState hook and banner); P3 (idempotency keys on `raise_alert`, `send_message`, `check_in`).

---

### Pitfall 11: Token persistence using the web example's key and storage

**What goes wrong:**
- The official client example persists the token in `localStorage` (not available in RN) under the key `` `${SPACETIMEDB_URI}/${MODULE_NAME}/auth_token` ``.
- Copying that key into `expo-secure-store` fails: keys may contain only alphanumerics, `.`, `-`, and `_`. Colons and slashes are rejected.
- If the token is not persisted, every launch mints a new anonymous identity. The member row is bound to the old identity, so the user is "un-enrolled" after each restart.
- iOS Keychain may survive uninstall/reinstall, while Android SecureStore is wiped on uninstall.
- After `--delete-data`, a phone still holds a device key and token but no member row exists, so the app shows "enrolled" and every reducer fails.

**How to avoid:**
- Use a sanitized key such as `rp_maincloud_redphone_token`, stored in SecureStore with `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` so it doesn't migrate via backups.
- Save the token in `onConnect`; it reruns on reconnect.
- On every connect, reconcile local state against the `my_member` view. If there is no active member row, wipe the local device key and PIN material and route to enrollment.
- Namespace all keys by database name so dev and demo DBs don't collide.

**Warning signs:**
- An `Invalid key` error from SecureStore.
- The identity hex changes between launches.
- "Enrolled" UI shows while reducers error with "not a member".

**Phase to address:** P1 (token persistence); P2 (reconcile logic).

---

### Pitfall 12: Crypto setup on Hermes and in the V8 module

**What goes wrong:**
- `@noble/ed25519` (v3) needs `crypto.getRandomValues`. React Native has no secure `getRandomValues` by default; noble's README says so explicitly.
- noble v3 sync APIs (`sign`, `verify`, `keygen`) throw unless you set `ed.hashes.sha512 = sha512` from `@noble/hashes/sha2.js`. v2-era snippets use `ed.etc.sha512Sync`, which no longer exists in v3.
- ES `import` hoisting means a polyfill written inline in `App.tsx` runs after noble is imported.
- In the module, reducers are synchronous and `crypto.subtle` is not a thing to rely on. You need sync noble with `@noble/hashes` sha512 for `verify`, and sha256 for the audit chain and invite hashes (`@spacetimedb/crypto` exports `sha256`/`timingSafeEqual`, but no Ed25519).
- Signing JSON is fragile: `JSON.stringify` throws on `bigint` ("Do not know how to serialize a BigInt"), and key order or number formatting can differ between client and server.

**How to avoid:**
- In `polyfills.ts` (imported first): set `globalThis.crypto ??= {}` and `globalThis.crypto.getRandomValues = expoCrypto.getRandomValues` (or import `react-native-get-random-values`).
- In both client and module: `ed.hashes.sha512 = sha512; ed.hashes.sha512Async = m => Promise.resolve(sha512(m));`.
- Define the signed message as a fixed, pipe-delimited UTF-8 string built in one shared function, for example `redphone|v1|<db>|<memberId>|<action>|<argsDigestHex>|<nonceHex>|<expiresMicros>`. Use decimal strings for bigints and lowercase hex for bytes.
- Put that function in a shared `shared/canonical.ts` used by both module and app (see Pitfall 18 for Metro).
- Unit-test with a fixed vector: sign on the client side in Node, verify in the module harness.

**Warning signs:**
- `crypto.getRandomValues must be defined`.
- `hashes.sha512 not set`.
- Signatures verify locally but fail on the server.

**Phase to address:** P2 (first task: a keygen + sign + server-verify spike).

---

### Pitfall 13: A signed challenge that is replayable or not bound to the action

**What goes wrong:**
- If the signature covers only the nonce, a captured `(nonce, sig)` pair, or a signature for `check_in`, can be reused for `revoke_member`.
- A challenge never deleted can be reused until expiry.
- A challenge not bound to `ctx.sender` can be redeemed by a different session. That is exactly the "stolen session token" case the design must defeat.
- Requiring a new round-trip challenge for every tap makes the app feel slow on cellular: each reducer needs a challenge row to arrive via subscription first.

**How to avoid:**
- The challenge row is keyed by member and stores `nonce`, `expiresAt` (≈60 s), and an `action` scope.
- The sensitive reducer:
  1. finds the challenge for the caller's member
  2. checks expiry with `ctx.timestamp`
  3. verifies the signature over the canonical message (action name + args digest + nonce) against the stored public key
  4. **deletes the challenge in the same transaction**.
- Tier the actions:
  - **Per-action signatures** for high-risk reducers: `confirm_alert`, `set_attack_type`, `revoke_member`, `approve_admin`, `lockdown`, `close_incident`, `create_invite`.
  - **A session attestation** for low-risk ones: one signed challenge at unlock creates a `session` row bound to `ctx.connectionId` (null-check it) with a ~15-minute TTL. Covers `check_in`, `send_message`, `accept_task`, `complete_task`, `set_asset_status`.
- On the client, await the challenge row's `onInsert` before signing. Don't call the reducer optimistically.

**Warning signs:**
- The signature payload lacks an action name.
- Challenge rows accumulate in the table.
- Sensitive actions succeed from a second client using a copied token.

**Phase to address:** P2 (mechanism); P4 (replay and wrong-action negative tests).

---

### Pitfall 14: Overclaiming what on-device biometrics and the PIN prove

**What goes wrong:**
- `LocalAuthentication.authenticateAsync` returns `{ success }` to JS. The server never sees it. The PIN is checked on-device only, as specified. The server therefore only knows "a holder of the device key signed this". A judge may ask: "what stops a modified app from skipping Face ID?"
- `expo-secure-store` with `requireAuthentication: true` would bind key access to biometrics. But:
  - on iOS it prompts only on read/update, not on create
  - keys are invalidated (reads return `null`) when biometrics change, e.g. a new fingerprint. That silently bricks enrollment.
  - it's unsupported in Expo Go when biometrics are available
  - `getItem` blocks the JS thread during the prompt.
- Face ID needs `NSFaceIDUsageDescription` (config plugin `faceIDPermission`) and doesn't work in Expo Go at all. Without it, iOS falls back to the device passcode.
- The PIN stored as an unsalted SHA-256 of 4-6 digits is offline-brute-forceable in milliseconds.

**How to avoid:**
- Say it honestly in the pitch: "biometric + PIN gate the device key; the server requires a signature from that key". Do not claim the server verifies biometrics.
- Store the PIN as a slow KDF hash (`@noble/hashes` scrypt or pbkdf2 with a per-device salt, tuned to ~200 ms on Hermes) inside SecureStore. Count attempts and wipe the key after N failures.
- If `requireAuthentication` is used, also handle `null` reads by routing to re-enrollment with a clear message.
- Set the `faceIDPermission` string in `app.json` from day one.
- Use `LocalAuthentication` `biometricsSecurityLevel: 'strong'` on Android where possible.

**Warning signs:**
- The Face ID prompt never appears on iPhone (Expo Go, or plist key missing).
- A user is suddenly "not enrolled" after adding a fingerprint.

**Phase to address:** P2. The duress PIN, a P-stretch item, reuses the same KDF path with equal timing so the two PINs are indistinguishable.

---

### Pitfall 15: Push notifications not working on judges' phones

**What goes wrong:**
- Remote push is unavailable in Expo Go on Android since SDK 53. A development build is required. Whether iOS Expo Go still receives remote push is unverified (LOW confidence).
- `getExpoPushTokenAsync` rejects with `ERR_NOTIFICATIONS_NO_EXPERIENCE_ID` without an EAS `projectId`.
- Android dev builds need FCM V1 credentials uploaded to EAS and `google-services.json`. Otherwise token fetch fails.
- iOS dev builds need a paid Apple Developer account, an APNs key, and the device UDID registered (`eas device:create`) before the build. Judges' iPhones can't be registered at demo time.
- Android 13+ won't show the permission prompt until a notification channel exists.
- Push is "at least one attempt" and may be delayed. Normal priority is delayed on sleeping Android.
- Focus/DND silences pushes; Critical Alerts need an Apple entitlement you won't get this weekend.

**Why it happens:**
Push is the hardest-to-test feature, and it is tested last.

**How to avoid:**
- Make the in-app realtime alert the primary path: the subscription-driven full-screen "RED PHONE ALERT" takeover. Treat push as the wake-up path for backgrounded or closed apps.
- During the demo, judges have the app open anyway.
- Do push setup on Friday night or Saturday morning, on team-owned devices:
  - run `eas init` (projectId)
  - set up FCM V1 credentials and an APNs key
  - create the Android channel before requesting the token
  - send with `priority: 'high'`, and on iOS `interruptionLevel: 'time-sensitive'` (best effort).
- Store push tokens in a private table.
- Handle `DeviceNotRegistered` tickets by deleting that token.

**Warning signs:**
- No push token on Android in Expo Go.
- `ERR_NOTIFICATIONS_NO_EXPERIENCE_ID`.
- "Default FirebaseApp is not initialized".
- Ticket `ok` but nothing arrives (check receipts ~15 min later).

**Phase to address:** P3 (push procedure); P1 (EAS project and dev-build pipeline must exist early); P5 (verify on each judge-device type).

---

### Pitfall 16: Calling HTTP from a reducer, or exposing the push procedure to clients

**What goes wrong:**
- Reducers are deterministic and can't make network calls.
- Reducers can't call procedures directly.
- Making `send_alert_push` an ordinary exported procedure lets any connected client trigger "Red Phone: open app" pushes to every responder. That is alert-fatigue and social-engineering DoS.
- Inside procedures:
  - `withTx` callbacks "may be invoked multiple times", so side effects inside them can repeat
  - HTTP is not allowed while a transaction is open
  - Expo's service may deliver duplicates.

**How to avoid:**
- `confirm_alert` (a reducer) inserts a row into a `push_job` schedule table with `ScheduleAt.time(ctx.timestamp.microsSinceUnixEpoch)`.
- A procedure bound with `{ onSchedule: pushJob }` (returning `t.unit()`) then:
  1. reads tokens in a short `withTx`
  2. does `ctx.http.fetch('https://exp.host/--/api/v2/push/send', …)` outside any transaction, batching ≤100 messages per request
  3. records tickets and removes dead tokens in another `withTx`.
- Scheduled reducers and procedures are private by default in 2.x. Do not also export a public wrapper.
- Put an idempotency flag on the incident (`pushSentAt`) so a re-run doesn't double-send.
- Enable Expo "enhanced push security" and keep the access token in a declared module env var (`schema(..., { env: { EXPO_ACCESS_TOKEN: t.string() } })`) supplied at publish. Never put it in the client or git.

**Warning signs:**
- `fetch` or `ctx.http` appears inside a `spacetimedb.reducer`.
- The push procedure appears in client bindings as callable.

**Phase to address:** P3.

---

### Pitfall 17: Push payloads, notification text, or audit rows leaking incident details

**What goes wrong:**
- The spec says pushes carry no details, but developers add `data: { incidentId, type: 'ransomware' }` for deep linking, or a body like "Possible attack raised by Alice". APNs/FCM, Expo, and the lock screen all see it.
- The audit log shows Admins counsel-only message bodies if `data` holds plaintext.
- An unsalted `data_hash` of a short counsel message ("yes", "pay") is guessable.

**How to avoid:**
- Use a fixed payload: title "Red Phone", body "Open app", empty `data` (or a constant `{k:'wake'}`).
- The app decides what to show from its subscriptions after unlock.
- Store `data_hash = sha256(canonical(args) | rowId | ctx.timestamp)` and never the plaintext.
- Keep the Android channel name generic ("Alerts").

**Warning signs:**
`incident` appears anywhere in the push request body builder.

**Phase to address:** P3 (push); P4 (audit data hashing).

---

### Pitfall 18: Hash-chained audit log that breaks under real conditions

**What goes wrong:**
- Using the autoInc `id` as the sequence number. AutoInc IDs have gaps and are not sequential (concepts skill, Critical Rule 4), so verification reports false tampering.
- Finding the "previous" entry by scanning with `iter()` for the max ID: slow, and wrong with gaps.
- Non-canonical serialization: `JSON.stringify` key order, bigint throwing, `Identity` objects serializing differently, timestamps as `Date` vs micros, and client and server hashing different bytes. Verification fails for every row, or worse, passes for tampered ones.
- Logging only successful actions. A thrown `SenderError` rolls back the whole transaction, including the audit append, so denied attempts vanish. That matters for "someone tried to revoke the Lead".
- Truncating the tail (deleting the last N rows) or the DB owner recomputing the whole chain from the dashboard is undetectable from the chain alone. The Maincloud dashboard lets the owner edit and delete rows.

**Why concurrent appends are less scary here:**
Each SpacetimeDB database runs transactions one at a time (serializable), so two reducers can't append with the same `prev_hash`. That holds only if the head is read and written within the same reducer transaction.

**How to avoid:**
- Keep a singleton `audit_head { id: 0, seq: u64, hash }` row.
- One helper, `appendAudit(ctx, action, dataDigest)`, used by every reducer:
  1. reads the head
  2. sets `seq = head.seq + 1n`
  3. computes `hash = sha256(utf8("v1|" + seq + "|" + actorHex + "|" + action + "|" + dataHashHex + "|" + prevHashHex + "|" + ctx.timestamp.microsSinceUnixEpoch))`
  4. inserts the entry and updates the head.
- Use an explicit `seq` column with a unique index; the genesis `prev_hash` is 32 zero bytes.
- The verifier (Admin client, and the export) recomputes every hash. It checks `seq` is contiguous from 1, and that the last hash equals `audit_head.hash`.
- For tail and owner tampering:
  - each client stores the highest `(seq, hash)` it has seen and alerts if the chain no longer extends it
  - the export prints the head hash for out-of-band anchoring.
- For denied attempts, use a separate non-throwing path. A `denied_attempt` append, then return without throwing, means the client sees no error, so do it only for high-risk reducers. Otherwise document that denials are not logged.
- Demo moment: edit a row via the Maincloud dashboard, then press "Verify chain" and show the red break.

**Warning signs:**
- "Chain broken" on a freshly seeded DB.
- Verification code calling `JSON.stringify`.
- Hash mismatches between module tests and client.

**Phase to address:** P4 (or P2 if the roadmap wants audit from the first reducer). Build `appendAudit` once and call it from day 1 to avoid retrofitting 20 reducers.

---

### Pitfall 19: Republishing to Maincloud destroys state or fails mid-demo

**What goes wrong:**
- Automatic migration forbids:
  - removing or modifying columns
  - adding a column without a default, or in the middle of a table
  - adding `Unique`/`PrimaryKey` constraints
  - changing whether a table is a schedule table
  - renaming index accessors.

  The publish fails, and the tempting fix is `--delete-data`. That wipes both Admins, every enrolled judge, and the audit chain. Every phone must re-enroll; their local keys and tokens are now orphaned (see Pitfall 11).
- `init` runs only on first publish or after `--delete-data`, so seed data added to `init` later never appears in the existing DB.
- `spacetime dev` republishes on every save. If it points at the demo DB, the live demo hot-swaps under you.
- Changing a table from public to private breaks subscribed clients at runtime.

**How to avoid:**
- Use two databases: `redphone-dev` (free to `--delete-data`) and `redphone-demo` (schema frozen at the start of P5).
- Append new columns only at the end, with `.default(...)`.
- Seed via an idempotent `seed_playbooks` path (callable once by an Admin, or run from `init`) that upserts by natural key.
- Finish all `unique`/`primaryKey` decisions in P2/P3.
- Before the demo, do a dry-run publish of the final module to a scratch DB.

**Warning signs:**
- Publish prompts about breaking clients or deleting data.
- Anyone typing `--yes=all`.

**Phase to address:** P1 (two DBs, scripts); P5 (freeze).

---

### Pitfall 20: The "two independent reports" and "one Lead confirms" rules are bypassable

**What goes wrong:**
- Counting reports by connection, or by calls instead of distinct members, lets one stolen phone tapping twice cause a full alert.
- One person holding two accounts (two invites redeemed on two identities) can satisfy "two members" alone. A compromised Lead or Admin can mint a sock-puppet Member, then report twice.
- One stolen Lead phone can confirm by design. The protection is only the PIN/biometric gate plus the per-action signature.
- Lockdown that doesn't block `raise_alert` lets a known-compromised account keep paging everyone.

**How to avoid:**
- Use an `alert_report` table with a unique index on `(incidentId, memberId)`.
- Require reporters to be distinct active members. Optionally exclude a reporter whose `invitedBy` is the other reporter: a cheap sock-puppet guard worth mentioning to judges.
- `confirm_alert` requires role Lead plus a per-action signature.
- Lockdown blocks all non-Admin reducers, checked via a shared `requireActive(ctx, opts)` guard that every reducer calls first.

**Warning signs:**
- No unique index on reports.
- `raise_alert` doesn't call the shared guard.

**Phase to address:** P3; re-check in P4.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `public: true` tables to get `useTable` working | Five-minute UI | Leaks every row to the internet; retrofitting views changes client queries | Never, except throwaway spikes on `redphone-dev` |
| Session attestation instead of per-tap challenges for low-risk actions | Snappy UX on cellular | Weaker binding for chat/check-in | Acceptable (state it in the pitch); never for confirm/revoke/approve/lockdown |
| `requireAuthentication: false` on SecureStore plus a `LocalAuthentication` gate | Works in dev builds, no biometric-change bricking | The key is extractable on a rooted/jailbroken phone | Acceptable for the hackathon; say so honestly |
| Expo Go for judges instead of dev builds | No Apple provisioning | No Face ID, no Android push | Acceptable as a P5 fallback if the in-app alert is primary |
| Skipping push receipts processing | Less code | Dead tokens are never pruned | Acceptable for the weekend |
| Logging only successful actions in the audit chain | Simple throw-on-deny | Denied attempts are invisible | Acceptable if documented; add a `denied_attempt` path for 2-3 high-risk reducers if time allows |
| `--delete-data` on the demo DB | Instant schema freedom | Everyone re-enrolls; chain resets | Only before judges are enrolled |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| SpacetimeDB client in RN | Default `gzip` compression; no URL/window polyfills | `.withCompression('none')`; `polyfills.ts` imported first; device smoke test in P1 |
| SpacetimeDB React hooks | Adding a second manual subscription for the same table; reading data before `isReady` | Let `useTable` own subscriptions; gate UI on the `isReady` tuple value; register callbacks once, not inside `onConnect` |
| Scheduled reducers | Copying the 1.x guard `ctx.sender != ctx.identity` (broken object compare; `ctx.identity` isn't in the 2.x TS context) | 2.x scheduled reducers/procedures are private by default. For defense in depth, start with `if (!ctx.senderAuth.isInternal) throw new SenderError('internal only')` and unit-test with `TestAuth.fromJwtPayload(...)` to prove rejection |
| Procedures | HTTP inside `withTx`; side effects in `withTx` (may re-run) | I/O outside transactions; keep `withTx` pure DB work; idempotency flag |
| Module env vars | Reading undeclared keys; hard-coding secrets in source | Declare in `schema(..., { env })`; supply at publish; never `console.log` them (Maincloud logs are visible on the dashboard) |
| Expo push | Missing `projectId`; Android without FCM V1; content in payload | `eas init`; upload FCM V1 key; fixed content-free payload; ≤100 per request; handle `DeviceNotRegistered` |
| expo-camera | No `cameraPermission` text; repeated `onBarcodeScanned` | Config plugin permission string; ref lock after first scan; `barcodeScannerSettings: { barcodeTypes: ['qr'] }` |
| expo-secure-store | Keys with `/` or `:`; large blobs (some iOS versions reject >~2048 bytes) | Sanitized keys; store only the token, 32-byte key (hex), and PIN KDF output |
| Maincloud CLI auth | Token pasted into agent config or committed; teammate publishes under a different identity ("You need to be logged in as the owner of …") | Only one owner identity publishes: `spacetime login --token "$SPACETIME_TOKEN"` sourced from gitignored `.env`; everyone else uses `redphone-dev` under their own name or asks the owner to publish |
| Maincloud free tier | Cold DB at demo start | Databases pause after inactivity and resume on connect (typically <1 s); open the app on a team phone 5 minutes before presenting |
| Shared TS code (canonical hashing) | `import '../shared/…'` from the Expo app fails in Metro outside the project root | npm workspaces (Expo SDK 52+ auto-configures monorepos) or a small duplicated file guarded by a shared test vector |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Views over non-unique indexes or `count()` | High energy usage; slow updates | Narrow indexed lookups; avoid `count()` in views | Not at demo scale (<30 users); note only |
| Per-tap challenge round trips on venue cellular | 0.5-1.5 s lag per button | Session attestation for low-risk actions | Immediately under congested cellular |
| Overlapping non-indexed subscriptions | Duplicate row processing | One query per need, indexed filters | Not at demo scale |
| Scrypt PIN KDF tuned on a laptop | 5+ s unlock on an older Android | Benchmark on the slowest team phone in Hermes; target ~200 ms | Older Android devices |
| Seeding tasks for every role holder on playbook load | Large first frame (also triggers Pitfall 1 if gzip is on) | Compression off; assign per role, not per member × step | When playbooks grow |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing the invite secret instead of `sha256(secret)` | DB reader (dashboard, owner, leak) can redeem live invites | Client generates 32 random bytes, sends only the hash to `create_invite`; `redeem_invite` hashes the provided preimage and looks it up by a unique `secretHash` index |
| Expiry checked against client time, or not at all on redeem | Old QR photos work forever | `ctx.timestamp > invite.expiresAt` check in `redeem_invite`; also reject if `usedBy` is set |
| Secret generated with `ctx.random` | Predictable from the reducer timestamp (seed = micros) | Device CSPRNG only |
| Logging reducer args (`console.log(args)`) | Invite secrets and challenge signatures in Maincloud logs | Never log args in auth reducers. Other clients never see a reducer's arguments; logs are the leak path |
| PIN sent to the server or stored as a fast hash | Server compromise or device extraction reveals the PIN | PIN never leaves the device; slow KDF + salt in SecureStore; attempt counter |
| Push tokens in a public/viewable column | Anyone can push spoofed "Red Phone" alerts to responders (unless Expo enhanced security is on) | Private `push_token` table; enable Expo enhanced push security; token never in any view |
| Role/level/identity taken from reducer args | Self-escalation to Admin | Role from the invite row; caller from `ctx.sender` only |
| `approve_admin` without distinct-approver enforcement | One Admin promotes a puppet alone | Unique `(candidate, approver)`; 2 distinct active Admins, neither the candidate |
| Bootstrap reducer left callable | First visitor to a fresh DB becomes Admin | Code hash in env var; flag disables after 2 Admins; bootstrap immediately after first publish |
| Revoke that only flips `status` | Revoked member's push token, sessions, and challenges keep working | Revoke deletes push tokens, sessions, and challenges, and walks the `invitedBy` btree recursively for the branch (guard against cycles); views auto-drop rows for revoked callers |
| Lockdown not enforced in every reducer | Compromised non-Admin keeps acting | Single `requireActive(ctx, { allowDuringLockdown })` guard at the top of every reducer; a test iterates all reducers |
| Assuming the SpacetimeDB version requirement is "2.11+" | Wrong citation in the pitch | The identity-impersonation fix (an attacker knowing a token's subject and issuer could impersonate that Identity) shipped in **v2.10.0** and was disclosed in the v2.11.0 release notes. "2.11+" is satisfied by CLI 2.12; cite 2.10.0 as the fix |
| Duress PIN path distinguishable | Attacker learns a duress alert fired | Same KDF timing; decoy UI; the duress alert row is visible only via the Admin view; no client-visible confirmation |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Stale cached rows shown as live after background | Responder acts on old task state | "Reconnecting…" banner from `isActive`/`isReady`; AppState-driven reconnect |
| Error toast after a successful QR redeem (double scan) | Judge thinks enrollment failed | Scan lock; success screen keyed on the `my_member` row appearing, not on the reducer promise alone |
| Task assigned to a role nobody holds (e.g. no judge is "Comms") | Playbook stalls silently | When no active holder exists, assign to the backup, else the Lead, and show "unassigned: covered by Lead" |
| Multiple people hold the same role | Duplicate or confusing tasks | Decide: assign to the first active holder with the others able to see it, or assign to all. Make it explicit in P3 |
| Face ID prompt plus PIN plus challenge on every app open | Feels slow under stress | One unlock creates a 15-minute session; per-action signature only on high-risk taps |
| Showing "cellular only" while judges are on venue Wi-Fi | Pitch contradiction | Don't block Wi-Fi. Optionally show an informational banner via `expo-network`; pitch it as "independent of company networks" |
| bigint IDs rendered in JSX | Runtime error | `String(id)` / `Number(id)` (client skill gotcha) |

## "Looks Done But Isn't" Checklist

- [ ] **Device connectivity:** tested on a physical iPhone and Android over cellular with >100 rows, compression `'none'`, after background → foreground.
- [ ] **Row visibility:** a brand-new anonymous client (no token) subscribing to everything receives zero sensitive rows. A Member does not receive counsel messages. A non-Admin does not receive `audit_log`.
- [ ] **Invite:** second redeem fails; expired redeem fails; a redeemer can't choose role; a Lead can't mint a Lead; Counsel can only mint Guests; an invite from a now-revoked inviter fails.
- [ ] **Admin promotion:** a self-approval, a duplicate approval, and a single approval all fail. Tests use `.isEqual`, not `===`.
- [ ] **Bootstrap:** a third bootstrap call fails; the setup code is not in git.
- [ ] **Challenge:** a replayed signature fails; a signature for action A fails for action B; a token copied to a second client without the device key can't do sensitive actions.
- [ ] **Scheduled reducer:** a client calling `escalate_task` directly is rejected (absent from client bindings, plus the `senderAuth.isInternal` guard).
- [ ] **Push:** received on a locked phone of each OS type you will demo on; the payload contains no incident data; the push procedure is not client-callable.
- [ ] **Alert threshold:** the same member reporting twice does not escalate; two distinct members do; one Lead confirm does.
- [ ] **Audit chain:** verifies on a fresh DB; detects a dashboard edit; detects a deleted middle row; seq is contiguous despite autoInc gaps.
- [ ] **Lockdown:** every non-Admin reducer rejects (a test loops over the reducer list).
- [ ] **Bindings:** regenerated after the final schema; app rebuilt; `npm ls spacetimedb` equals the CLI version.
- [ ] **Reinstall/wipe:** after `--delete-data` on dev, a previously enrolled phone routes to enrollment instead of looking enrolled.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| SDK fails on device (compression/polyfills) | LOW | Add `.withCompression('none')` and `polyfills.ts`; if still failing, `withWSFn` lets you supply a custom WebSocket factory |
| Public table leaked data | MEDIUM | Make the table private (an allowed migration, but it breaks subscribed clients). Add a view, regenerate bindings, rebuild the app |
| Migration rejected on the demo DB | HIGH if judges are enrolled | Publish to a new DB name, re-bootstrap Admins with the setup code, re-enroll via a pre-printed batch of invites. Avoid by freezing the schema |
| Wrong owner identity can't publish | LOW | Owner runs the publish; or `spacetime login --token` with the owner token from `.env` |
| Push broken at demo time | LOW (if the in-app alert is primary) | Demo the in-app takeover alert; show push on one team phone |
| Audit chain verification fails on legit data | MEDIUM | Fix canonical serialization, then reset the dev DB. On the demo DB, mark a "chain v2 genesis" entry referencing the old head hash rather than rewriting |
| Judges' iPhones can't install the dev build | MEDIUM | Expo Go (no Face ID; PIN-only unlock path) or hand judges team-owned pre-enrolled phones |

## Hackathon Demo Pitfalls (P5)

| Risk | Detail | Mitigation |
|------|--------|------------|
| Distribution to judges | iOS dev builds need UDID registration before building; TestFlight external review takes too long; Android APK sideload is easy | Decide in P1: Android judges get the APK via a QR link to the EAS build; iOS judges use Expo Go, or team phones. Keep a PIN-only unlock path when Face ID is unavailable (Expo Go) |
| Metro dev server unreachable on venue Wi-Fi (client isolation); `--tunnel` flaky | Judges can't load the JS bundle | Don't depend on a laptop Metro server at demo time. Use standalone or dev builds with the bundle embedded, or an EAS Update channel, verified the day before. Maincloud itself is plain `wss://maincloud.spacetimedb.com:443`, so venue Wi-Fi is usually fine |
| Enrolling 4-6 judges in 3 minutes | Typing names and roles per invite is slow; 10-minute expiry | Pre-stage invites minutes before (Admin creates N role-tagged invites with placeholder names, shown as a swipeable QR carry-sheet). The judge only scans and sets a PIN. Pre-enroll team phones as Lead/Admin/IT so the playbook never stalls |
| Role coverage | A judge gets "Comms" but the IT role is empty, so the playbook stalls | Map judges to roles that have tasks; fallback assignment to the Lead |
| DB name/ownership | Generic names may be owned by someone else; publishes from a teammate's identity are refused | Use a distinctive name (`redphone-hackutd26-demo`); one owner identity; record the DB identity printed by publish in `.planning` (not the token) |
| Spacetime token handling | Token is pasted into chat, agent config, or a committed file | `.env` gitignored; `spacetime login --token "$(grep SPACETIME_TOKEN .env | cut -d= -f2)"`; check `git status` before every commit |
| Cold start | Free-tier DB paused | Warm up 5 minutes before |
| Venue cellular congestion | Hundreds of attendees on one cell | Keep the session-attestation path so taps don't need challenge round trips; test both Wi-Fi and cellular |
| Clocks and stretch items eating time | Legal clocks/duress half-done at demo | Ship must-haves first; stretch items only after the P5 rehearsal passes |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Gzip/DecompressionStream | P1 | Physical device loads >100 rows without disconnect |
| 2 RN globals (URL, window, TextDecoder) | P1 | Cold launch and token launch both connect on iOS + Android |
| 3 Version/bindings drift | P1, re-check P5 | `spacetime --version` == `npm ls spacetimedb`; `npm run gen` in the workflow |
| 4 `ctx.random` for secrets | P2 | Grep: no `ctx.random` in invite/bootstrap code |
| 5 Identity `===` | P2 | Unit tests for self-approval rejection pass |
| 6 Public tables | P2, audit P4 | Anonymous client sees nothing |
| 7 View restrictions | P2/P3 | Publish succeeds; `onUpdate` fires for task status |
| 8 Arg-trusting / escalation | P2, audit P4 | Negative test matrix per reducer |
| 9 Double scan / expiry | P2, rehearse P5 | Single redeem call per scan in logs |
| 10 Socket lifecycle / idempotency | P1, P3 | Background 2 minutes → foreground → send works, no duplicates |
| 11 Token persistence / reconcile | P1, P2 | Identity stable across restarts; wiped DB → enrollment screen |
| 12 Crypto polyfills / canonical signing | P2 (first spike) | Fixed test vector verifies in the module harness |
| 13 Challenge replay/binding | P2, tests P4 | Replay and wrong-action tests fail as expected |
| 14 Biometric/PIN overclaim | P2 | Face ID prompt on an iOS dev build; KDF timing measured |
| 15 Push setup | P1 (EAS), P3, P5 | Push received on each demo device type |
| 16 Reducer HTTP / public push procedure | P3 | Push procedure absent from client callable bindings |
| 17 Payload/audit leakage | P3, P4 | Payload builder has constant content |
| 18 Audit chain correctness | P2 helper, P4 verifier | Dashboard edit detected in rehearsal |
| 19 Republish / `--delete-data` | P1, freeze P5 | Two DBs exist; demo DB schema frozen |
| 20 Alert threshold bypass | P3, P4 | Same-member double report doesn't escalate |

## Sources

- Official SpacetimeDB skills (local): `/Users/adem/.agents/skills/concepts/SKILL.md`, `typescript-server/SKILL.md`, `typescript-client/SKILL.md`. Covers critical rules, Identity `.equals`, ctx-only time/RNG, view and procedure rules, reconnect semantics, and `UnknownCallResultError` (HIGH).
- SDK source, `spacetimedb@2.14.0` from npm, read directly: `src/sdk/db_connection_builder.ts` (default gzip, `withCompression`, `withWSFn`), `src/sdk/decompress.ts` (`DecompressionStream`), `src/sdk/ws.ts` (URL/Headers/fetch websocket-token flow), `src/sdk/db_connection_impl.ts` (`#installLivenessListeners` on `document`/`window`), `src/lib/binary_reader.ts` (`TextDecoder` at load), `src/server/rng.ts` (xoroshiro128+ seeded from the timestamp) (HIGH for what the code does; MEDIUM for its RN impact until device-tested).
- [Automatic migrations](https://spacetimedb.com/docs/databases/automatic-migrations/): allowed/forbidden changes, `--delete-data` (HIGH).
- [Reducer context](https://spacetimedb.com/docs/functions/reducers/reducer-context/): "Scheduled reducers and procedures are private by default in SpacetimeDB 2.x"; `senderAuth` (HIGH). Context7 `/clockworklabs/spacetimedb` migrating-to-2.0 and unit-testing docs: `ctx.senderAuth.isInternal` (HIGH).
- [GitHub issue #3490](https://github.com/clockworklabs/SpacetimeDB/issues/3490): Identity `!==` comparison bug in a scheduled-reducer guard (HIGH).
- [Views](https://spacetimedb.com/docs/functions/views/): indexed-lookup-only access, PK/onUpdate, SQL restrictions (HIGH). [Access permissions](https://spacetimedb.com/docs/tables/access-permissions/), [RLS](https://spacetimedb.com/docs/how-to/rls) (views recommended over RLS) (MEDIUM-HIGH).
- [Procedures](https://spacetimedb.com/docs/functions/procedures/): `withTx` may re-run, no HTTP in a transaction, 30 s/180 s timeouts (HIGH).
- [SQL reference](https://spacetimedb.com/docs/reference/sql): subscription grammar limits (HIGH). [Subscriptions](https://spacetimedb.com/docs/clients/subscriptions/) (HIGH).
- [Maincloud deploy](https://spacetimedb.com/docs/how-to/deploy/maincloud/), [CLI reference](https://spacetimedb.com/docs/cli-reference/) (`login --token`, `--yes=` values, `--break-clients`), and publish-permission behavior from the CLI source on docs.rs (MEDIUM-HIGH).
- [SpacetimeDB v2.11.0 release notes](https://github.com/clockworklabs/spacetimedb/releases/tag/v2.11.0): impersonation fix shipped in v2.10.0 (HIGH).
- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/), [push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/), [sending notifications](https://docs.expo.dev/push-notifications/sending-notifications/) (HIGH). iOS Expo Go remote push status is unverified (LOW).
- [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/) (key charset, ~2048-byte iOS caveat, `requireAuthentication` invalidation, Expo Go limits) (HIGH).
- [expo-local-authentication](https://docs.expo.dev/versions/latest/sdk/local-authentication/) (NSFaceIDUsageDescription, no Face ID in Expo Go) (HIGH).
- [noble-ed25519 README](https://github.com/paulmillr/noble-ed25519): v3 `hashes.sha512`, RN `getRandomValues` (HIGH).
- [react-native#56325](https://github.com/facebook/react-native/issues/56325): Hermes TextDecoder timeline (MEDIUM). [react-native-url-polyfill](https://github.com/staltz/react-native-url-polyfill): RN URL gaps (MEDIUM).
- npm registry: `spacetimedb` 2.14.1 latest (2026-11-04); Expo SDK 58.0.23 bundles RN 0.88.1 (HIGH).

---
*Pitfalls research for: out-of-band incident response app (Expo + SpacetimeDB Maincloud)*
*Researched: 2026-11-07*
