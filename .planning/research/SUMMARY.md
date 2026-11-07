# Project Research Summary

**Project:** Red Phone
**Domain:** Out-of-band (OOB) cyber incident response and crisis communication app. Personal phones, Expo React Native client, SpacetimeDB 2.x TypeScript module on Maincloud. HackUTD 2026, Winstead PC challenge. Demo is Sunday 2026-11-08.
**Researched:** 2026-11-07
**Confidence:** MEDIUM-HIGH. Server-side SpacetimeDB facts are HIGH (docs, official 2.x skills, shipped 2.14.1 source). React Native runtime and noble-in-module behavior are MEDIUM until a physical-phone spike passes.

## Executive Summary

Red Phone is a sealed backup channel for incident responders, the same category as ShadowHQ, CYGNVS, Mattermost OOB, and BreachRx. What firms really use today is a Signal or WhatsApp group: no roles, no audit trail, no task tracking, no control over who joins. Experts build this kind of tool on four pieces: an isolated workspace, alerts confirmed before they go out, pre-approved playbooks assigned by role, and a tamper-evident record. Red Phone's edge is a trust model with no company identity: in-person QR enrollment with invite lineage, a two-person alert rule, a hash-chained audit log anyone can verify, and (stretch) fact-triggered legal deadline clocks. The sponsor is a Texas law firm, so evidence and legal features carry extra weight. Pitch: "Signal, but with a pre-approved plan, roles, and a record a court will accept."

The build treats SpacetimeDB as the only backend. **Every table is private. All reads go through per-caller views** with indexed lookups only (no `.iter()`); each view returns `[]` unless the caller is an active member with a live session. A single `guard()` helper and a single `appendAudit()` helper run in every reducer. The audit helper keeps a singleton `audit_head` and an explicit `seq` counter and must be **built before any other reducer**. Writes are bound to a connection: a signed Ed25519 challenge creates a `session` row keyed by `ctx.connectionId`. Device keys and every secret (invite secrets, Ed25519 seeds, setup code) are made on the phone with `expo-crypto`. **`ctx.random` must never produce secrets** — it is a PRNG seeded from `ctx.timestamp`. Crypto is `@noble/curves` Ed25519 plus SHA-256 on both sides; the pipe-delimited signing format and audit hash live in one shared package. Push goes out through a scheduled procedure calling the Expo push API. **The in-app realtime alarm is the primary alert path**; push is only the wake-up path.

The biggest risks are practical: the SDK has never been run on React Native here, versions drift, push does not work in Expo Go on Android, and judges have to get the app somehow. **Phase 1 must be a real-phone spike** proving: Expo on a physical phone connects to Maincloud with `.withCompression('none')` and loads >100 rows; `@noble/curves` verifies a test vector inside the published module; a scheduled procedure reaches `exp.host`. Pin `spacetimedb` 2.14.1 everywhere (CLI switched to 2.14.1; Node >= 24.22.1 via `/opt/homebrew/opt/node@24/bin`). Use two databases (dev and demo) so a `--delete-data` publish never wipes enrolled judges.

**Decided (2026-11-07):** demo distribution is **Expo Go + in-app alert**. User has an Expo account and will run `eas login` when asked.

## Key Findings

### Recommended Stack

One SpacetimeDB version everywhere (2.14.1), Expo SDK 58, pure-JS crypto on both sides, no custom native modules (runs in Expo Go). Full detail: STACK.md.

- **SpacetimeDB CLI + `spacetimedb` npm 2.14.1:** module SDK, client SDK, React hooks. Views with arguments need 2.13+. Impersonation fix shipped in v2.10.0 (disclosed in 2.11.0 notes).
- **Node >= 24.22.1:** engines floor of `spacetimedb@2.14.1`. Homebrew `node@24` (24.22.2) is keg-only at `/opt/homebrew/opt/node@24/bin`; prefix PATH in every command.
- **Expo SDK 58** (`expo@58.0.23`, RN 0.88.1, React 19.3.0): install native packages with `npx expo install`. TypeScript `~5.9.3`.
- **`.withCompression('none')` on the client (required):** default gzip needs `DecompressionStream`, which Hermes lacks.
- **`@noble/curves@2.4.0` Ed25519 + `@noble/hashes@2.4.0` SHA-256:** pure JS; runs in Hermes and the module runtime (no `crypto.subtle`). Import with `.js` suffix (`@noble/curves/ed25519.js`). `@spacetimedb/crypto@0.1.0` is a server option for `sha256`/`timingSafeEqual`.
- **`expo-crypto`:** CSPRNG for every secret and the `globalThis.crypto.getRandomValues` polyfill.
- **`expo-secure-store`** with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`: Spacetime token, Ed25519 secret key, PIN KDF output. Never AsyncStorage. Keys only `[A-Za-z0-9._-]`.
- **`expo-local-authentication`, `expo-camera`, `react-native-qrcode-svg`, `expo-notifications`, `expo-haptics`.**
- **`vitest@^3.2.4`** with `spacetimedb/server/test-utils`: test reducers without publishing.

**Expo Go limits:** no Face ID on iOS (falls back to device passcode); `SecureStore requireAuthentication` unsupported; Android remote push throws (SDK 53+); push tokens need an EAS `projectId` (`eas init`).

### Expected Features

**Must have (P1):**
- Bootstrap two Admins via one-time setup code (hash in module env var; reducer dead after two Admins).
- QR invite create/redeem: phone generates 256-bit secret, server stores only SHA-256, 10-minute expiry, single-use, atomic.
- Device key + on-device PIN (+ biometrics where available) + signed challenge on sensitive reducers.
- Hash-chained audit log + "Verify chain" + timeline screen.
- Raise alert → confirm. **Confirmer must differ from raiser.** Two reports count only from distinct members within a window.
- Content-free push + in-app full-screen alarm with haptics (primary).
- Check-in; "Unavailable" reassigns that person's tasks immediately.
- Ransomware playbook auto-assigned by role, accept/done, dependency locks, big "Your next step" card.
- Status board of data systems with PII flags; status taps fire playbook steps.
- Group chat + server-enforced counsel-only channel with privilege label.
- Revoke member + whole invite branch; Admin lockdown.
- **False alarm / stand-down state.**
- **Drill mode flag + Admin demo reset.**
- Connection indicator ("Live" / "Reconnecting").

**Should have (P2 stretch, in order):**
- Legal deadline clocks, minimal set: Texas AG 30d, Texas individuals 60d, GDPR 72h, SEC 8-K 4 business days ("if public company / client"). Labeled "possible obligation, confirm with counsel"; started by a specific reported fact.
- Task escalation to backup (~45 s demo timer).
- Report export (text/Markdown share sheet incl. chain head hash).
- Duress PIN (decoy "No active incidents" + silent Admin alert; never wipe).
- Cheap extras: decision log, Wi-Fi banner, "Call bridge" `tel:` button (replaces push-to-talk), fingerprint compare screen, invite-lineage tree.

**Defer / do not build:** push-to-talk; AI triage; claiming E2E encryption (say "TLS, server-enforced visibility, isolated, tamper-evident"); SSO/email/SMS enrollment; remote wipe, attachments, integrations, disappearing messages, playbook authoring UI, extra playbooks.

### Architecture Approach

Client talks to one backend: `wss://maincloud.spacetimedb.com`. Only outbound edge: one scheduled procedure posting to `exp.host`. All tables private; every read a per-sender view; every write a reducer calling `guard()` first and `appendAudit()` last in the same transaction. Serializable, one-at-a-time transactions mean the hash chain cannot race and invite redeem has no TOCTOU window. Expiry (sessions, challenges, guests) is enforced by scheduled reducers, because `ViewCtx` has no timestamp or `connectionId`. Full detail: ARCHITECTURE.md.

1. **`shared/` (`@redphone/shared`):** role lattice + `canInvite`, canonical **pipe-delimited signing format** (`redphone/v1|<nonceHex>|<action>|<argsDigestHex>`; bigints as decimal strings, bytes as lowercase hex; never `JSON.stringify`), audit canonicalization/hash, incident transition table. Fallback if bundlers fight workspaces: sync-copy script guarded by a shared test vector.
2. **`server/` module:** tables `config`, `member`, `invite`, `challenge`, `session`, `admin_proposal`/`admin_approval`, `incident`, `alert_report`, `checkin`, `playbook_step`, `task`, `asset`, `message`, `audit_log`, `audit_head`, `security_event`, `push_token`, schedule tables; helpers `guard()`/`appendAudit()`/`fireTrigger()`; views `my_member`, `my_challenge`, `roster`, `my_invites`, `incident_now`, `checkins`, `my_tasks`, `board`, `messages_all`, `messages_counsel`, `audit_feed`.
3. **Identity (two factors):** Spacetime token → `ctx.sender` (alone: sees `[]`, cannot write). Ed25519 device key proves the phone. Bound once in `redeem_invite` by proof-of-possession signature. Role/name come from the invite row, never reducer args. **Compare identities only with `.isEqual()`.**
4. **Session/challenge:** `request_challenge` writes a nonce bound to `connectionId` (60 s). Phone signs. `verify_challenge` deletes challenge, creates 15-minute `session` bound to the connection. SessionManager repeats on every reconnect. High-risk reducers (`confirm_alert`, `set_attack_type`, `revoke_member`, `approve_admin`, `lockdown`, `close_incident`, `create_invite`) additionally require a per-action signature (start with a `requireFreshSignature()` stub if short on time).
5. **Trigger/task engine:** `fireTrigger(ctx, incident, trigger)` in `set_attack_type`, `set_asset_status`, `advance_incident`; idempotent per (incident, step); assignment holder → backup → Lead; completion unlocks dependents.
6. **Push pipeline:** reducer inserts `push_job` with `ScheduleAt.time(now)`; procedure (`onSchedule: pushJob`) reads tokens in a short `withTx`, calls `ctx.http.fetch` outside the tx, ≤100 messages/request, constant payload.
7. **Expo client:** gate-driven Expo Router (`enroll` / `unlock` / `main` / `decoy`); `polyfills.ts` imported first; one `DataGate` mounts all `useTable(view)` after unlock; key held in memory only while foregrounded.

### Critical Pitfalls

1. **SDK breaks on Hermes** — `.withCompression('none')` in one connection factory; `polyfills.ts` first (expo-crypto `getRandomValues`, guarded `window.addEventListener` no-op, `react-native-url-polyfill` only if needed); AppState-driven reconnect.
2. **Public tables leak everything** — all private, per-caller views; anonymous client must see zero rows.
3. **Predictable secrets / arg-trusting reducers / `===` on Identity** — secrets from phone; role from invite row; caller from `ctx.sender`; `.isEqual()`; negative tests per reducer.
4. **Version and schema drift** — pin 2.14.1; `npm run gen`; commit bindings; separate dev/demo DBs; append-only columns with defaults; freeze demo schema before rehearsal.
5. **Push fails / push procedure client-callable** — in-app alarm primary. **`ProcedureCtx` has no `senderAuth` in 2.14.1**: guard procedure with `ctx.sender.isEqual(ctx.databaseIdentity)`; scheduled **reducers** use `ctx.senderAuth.isInternal`. Constant payload. `eas init` early.
6. **Audit chain false alarms** — explicit `seq`, canonical pipe-delimited input, client-side verify. Security failures record `security_event` and return (no throw, which would roll back).
7. **Double QR scans** — `useRef` scan lock; success keyed on `my_member` row appearing.

## Implications for Roadmap

Coarse: 5 phases, dependency-ordered.

### Phase 1: Foundation and Real-Phone Spike
Toolchain pinned (CLI/npm 2.14.1, Node >= 24.22.1); npm-workspace monorepo (`app/`, `server/`, `shared/`), `spacetime.json`, `npm run gen`; two DBs (dev + demo); physical phone shows live rows from a per-sender view with compression off, >100 rows, survives background/foreground; noble Ed25519 test vector verifies in vitest and in a deployed reducer; one scheduled-procedure push lands; token persisted in SecureStore; `eas init`.

### Phase 2: Trust Core (Audit, Guard, Enrollment, Unlock)
`shared/` signing + audit hash; `appendAudit`, `guard()`, `security_event`; `bootstrap_admin`; challenge/session/expiry/disconnect cleanup; `create_invite`/`redeem_invite`/`revoke_member` (branch; deletes sessions, tokens, challenges); `propose_admin`/`approve_admin` (two distinct Admins; same rule for revoking/demoting an Admin); `lockdown`; views; client router gates, QR scan lock, keygen, PIN with slow KDF (~200 ms), biometric when available, SessionManager, fingerprint display, admin invite QR; negative-test matrix.

### Phase 3: Alert, Push, and Comms
`incident` (with `isDrill` from day one), `alert_report` (unique incident+member), `checkin`; raise → possible (Leads only) → confirm by non-raiser Lead or second distinct reporter → active; `dismiss_alert` (false alarm + stand-down); `advance_incident` contained → recovered → closed; `push_token` + `push_job` + guarded push procedure (constant payload, `pushSentAt` idempotency); in-app alarm (onInsert, local notification, haptics); `check_in`; `send_message` with client nonces; views `incident_now`, `checkins`, `messages_all`, `messages_counsel`; privilege label; DRILL banner.

### Phase 4: Playbook, Tasks, and Status Board
Seeded ransomware `playbook_step` rows (idempotent seed); `task`, `asset` (PII flags); `set_attack_type`, `accept_task`, `complete_task`, `set_asset_status`, `fireTrigger` with dependency unlock and fallback assignment; shared `reassignToBackup()`; views `my_tasks`, `tasks`, `board` (PK on view rows); screens: "Your next step" card, task list with locked tasks greyed, board grid.

### Phase 5: Evidence UI, Stretch, and Demo Hardening
Must-have first: client chain verifier badge, timeline screen, Admin demo reset. Stretch in order: legal clocks (+ SEC business-day math), escalation, report export, duress PIN, extras. Hardening: security re-audit (reducer × role × checks; anonymous-client test), demo schema freeze + dry-run publish, regenerate bindings, pre-staged role-tagged judge invites, pre-enrolled team phones, warm-up, 3-minute tabletop rehearsal on cellular and venue Wi-Fi, chain-break demo moment.

### Phase Ordering Rationale
- Spike first: riskiest assumptions are on-device runtime behavior.
- Audit helper + guard with the first reducers; retrofitting breaks the chain.
- Views built alongside tables in Phase 2.
- After Phase 2, client screens and Phase 3/4 reducers can proceed in parallel; chat and board are independent.
- Columns decided early and only appended (`isDrill`, `pushSentAt`, PII flags).

### Research Flags
- **Phase 1:** hands-on spike (Hermes globals, noble bundling/CPU in module, workspace imports through Spacetime bundler + Metro, iOS Expo Go remote push).
- **Phase 3:** Expo push details (access token, receipts, mixed token types, FCM V1); whether `tx.senderAuth` in a procedure's `withTx` reports scheduled calls as internal (use identity check instead).
- **Phase 5 (clocks only):** SEC business-day arithmetic, trigger wording.
- Standard patterns: Phase 2, Phase 4.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Versions and server APIs HIGH; RN runtime inferred from source (MEDIUM). |
| Features | MEDIUM | Texas statute HIGH; GDPR/SEC/CIRCIA MEDIUM-HIGH; competitors LOW-MEDIUM. |
| Architecture | MEDIUM-HIGH | View/procedure/schedule constraints HIGH; noble in module and schedule-row cancellation MEDIUM. |
| Pitfalls | MEDIUM-HIGH | Server-side HIGH; RN SDK globals MEDIUM; iOS Expo Go push LOW. |

### Gaps to Address

**Researcher conflicts resolved:**
- **Push procedure guard:** `ProcedureCtx` (2.14.1) has no `senderAuth`. Scheduled reducers → `ctx.senderAuth.isInternal`; push procedure → `ctx.sender.isEqual(ctx.databaseIdentity)`. Test client-caller rejection.
- **Challenge nonce:** `ctx.random` acceptable for the challenge nonce only (needs uniqueness, not secrecy; server-stored, single-use, short-lived, connection-bound, signed). Everything bearer-like comes from the phone.
- **Version:** pin 2.14.1.
- **Ed25519 library:** `@noble/curves@2.4.0`, not `@noble/ed25519`.
- **Audit:** helper in Phase 2; verifier UI in Phase 5.

**Open decisions:**
- **Read-path limitation:** views have no `connectionId`, so a stolen token could read (not write) on a parallel connection during a live session. Mitigate: 15-minute TTL, session deletion on disconnect, lockdown wipes sessions. State honestly to judges.
- **Biometric claim:** server never sees biometrics. Pitch: "biometric or passcode + app PIN gate the device key; the server requires that key's signature." Key stored in Keychain/Keystore-backed storage, not the Secure Enclave.
- **Counsel channel audience:** recommend Counsel + Lead.
- **Multiple holders of one role:** assign to first active holder vs all holders.
- **Schedule-row deletion as cancellation** undocumented; `escalate_task` re-checks status.

**plan.md gaps to fix in requirements:**
1. Confirmer must differ from raiser; two-report escalation by distinct members within a window.
2. False-alarm / stand-down state with logged dismissal and stand-down push.
3. Drill flag + Admin demo reset.
4. Two-Admin rule for revoking/demoting an Admin.
5. Texas individuals clock trigger: "determines that the breach occurred" (§521.053(b)); 60 days is an outer limit.
6. CIRCIA not in effect (final rule unpublished): greyed "pending federal rule" card or drop.
7. SEC 8-K: 4 business days, public companies/clients only, business-day math.
8. Remove push-to-talk; substitute call-bridge `tel:` link.
9. Empty-role fallback: backup → Lead.
10. Timeline screen in MVP even if export stays stretch.

## Sources

### Primary (HIGH)
- Official SpacetimeDB 2.x agent skills (`~/.agents/skills/`: concepts, typescript-server, typescript-client, cli).
- `spacetimedb@2.14.1` npm source/types (`dist/server/procedures.d.ts`, `dist/lib/reducers.d.ts`, SDK compression, `makeRandom(timestamp)`).
- SpacetimeDB docs: views, access permissions, procedures, schedule tables, reducer context, automatic migrations, v2.11.0 release notes.
- Expo docs: notifications, local-authentication, secure-store, push sending, push setup.
- npm registry (2026-11-07).
- Tex. Bus. & Com. Code §521.053; SB 768 (2023); CISA CIRCIA page; SEC Item 1.05; GDPR Art. 33/34; 23 NYCRR 500.17.
- clockworklabs/SpacetimeDB#3490.

### Secondary (MEDIUM)
- SpacetimeDB #5342, #3026; Expo runtime globals; react-native#56325; react-native-url-polyfill; GDPR Digital Omnibus status; CIRCIA timeline; Debevoise 8-K tracker; Mattermost OOB docs; CYGNVS coverage.

### Tertiary (LOW)
- ShadowHQ/BreachRx marketing; iOS Expo Go remote push; EAS Update in Expo Go; ABA Op. 483, HIPAA BA 60-day, Capital One privilege ruling (training data only); law-firm CIRCIA coverage.

---
*Research completed: 2026-11-07*
*Ready for roadmap: yes*
