# Architecture Research

**Domain:** Out-of-band incident response app (Expo React Native client + SpacetimeDB 2.x TypeScript module on Maincloud)
**Researched:** 2026-11-07
**Confidence:** MEDIUM-HIGH. SpacetimeDB server APIs were verified against the official skills, the current docs, and the `spacetimedb@2.14.1` npm source. React Native compatibility and running `@noble` crypto inside the module runtime are only MEDIUM. Both need a spike in phase 0.

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     PHONE (Expo app, personal device)                    │
├──────────────────────────────────────────────────────────────────────────┤
│  ┌───────────┐  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ Expo      │  │ LockGate    │  │ SessionMgr   │  │ DataGate        │   │
│  │ Router    │  │ biometric + │  │ challenge →  │  │ useTable(views) │   │
│  │ screens   │  │ PIN (local) │  │ Ed25519 sign │  │ mounted after   │   │
│  └─────┬─────┘  └──────┬──────┘  └──────┬───────┘  │ unlock          │   │
│        │               │                │          └────────┬────────┘   │
│  ┌─────┴───────────────┴────────────────┴───────────────────┴────────┐   │
│  │ SpacetimeDBProvider / DbConnection (module_bindings, generated)   │   │
│  └─────────────────────────────┬─────────────────────────────────────┘   │
│  ┌──────────────┐ ┌────────────┴───┐ ┌──────────────────────────────┐    │
│  │ SecureStore  │ │ @redphone/     │ │ expo-notifications (push     │    │
│  │ STDB token,  │ │ shared (roles, │ │ token, receives content-free │    │
│  │ Ed25519 key, │ │ msg formats,   │ │ "open app" push)             │    │
│  │ PIN hashes   │ │ audit hash)    │ └──────────────────────────────┘    │
│  └──────────────┘ └────────────────┘                                     │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ WSS (cellular), reducer calls up,
                                 │ view row deltas down
┌────────────────────────────────┴─────────────────────────────────────────┐
│              SPACETIMEDB MAINCLOUD: database "redphone"                  │
├──────────────────────────────────────────────────────────────────────────┤
│  Reducers (writes)            Views (all reads; per-sender gated)        │
│  ┌──────────────────────┐     ┌───────────────────────────────────────┐  │
│  │ guard(): member,     │     │ my_member, my_challenge, roster,      │  │
│  │ active, role, lock-  │     │ my_invites, incident_now, checkins,   │  │
│  │ down, fresh session  │     │ tasks, board, messages_all,           │  │
│  │ audit.append()       │     │ messages_counsel, clocks, audit_feed  │  │
│  └──────────┬───────────┘     └──────────────────┬────────────────────┘  │
│             │ writes                              │ indexed reads only   │
│  ┌──────────┴──────────────────────────────────────┴───────────────────┐ │
│  │ PRIVATE tables (no table is public)                                 │ │
│  │ config, member, invite, challenge, session, admin_proposal,         │ │
│  │ incident, alert_report, checkin, playbook_step, task, asset,        │ │
│  │ message, clock_rule, clock, audit_log, audit_head, push_token       │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│  Schedule tables → internal reducers / procedures                        │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────────────┐  │
│  │ task_escalation  │ │ session_expiry / │ │ push_job → deliver_push  │  │
│  │ → escalate_task  │ │ clock_reminder / │ │ (PROCEDURE: ctx.http.    │  │
│  │ (reducer)        │ │ guest_expiry     │ │ fetch to Expo push API)  │  │
│  └──────────────────┘ └──────────────────┘ └────────────┬─────────────┘  │
└─────────────────────────────────────────────────────────┼────────────────┘
                                                          │ HTTPS POST
                                       ┌──────────────────┴──────────────┐
                                       │ exp.host/--/api/v2/push/send    │
                                       │ → APNs / FCM → phones           │
                                       └─────────────────────────────────┘
```

**Rule:** the client talks to exactly one backend, the Spacetime database. The only outbound edge is `deliver_push` to Expo. No company system appears anywhere in the diagram, which is the threat-model requirement.

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `server/` module | All state, authorization, state machines, audit chain, scheduling, push fan-out | SpacetimeDB 2.x TS module: `table()`, `schema()`, `spacetimedb.reducer/view/procedure` |
| `guard()` helper | Single choke point: caller is a member, status active, role allowed, lockdown respected, fresh connection-bound session | Plain TS function taking `ctx`, called first in every reducer |
| `audit.append()` helper | Hash-chained log entry inside the same transaction as the action | `audit_head` singleton + `audit_log` rows; SHA-256 via `@spacetimedb/crypto` or `@noble/hashes` |
| Views | The ONLY read path. Each is a per-sender view that returns `[]` unless the caller is an active member with a live session | `spacetimedb.view({ name, public: true }, t.array(...), ctx => ...)` |
| Schedule tables | Escalation, session/guest expiry, clock reminders, push jobs | `t.scheduleAt()` tables + `{ onSchedule: table }` reducers/procedures |
| `deliver_push` procedure | Only network I/O in the system | `spacetimedb.procedure({ onSchedule: pushJob }, ...)` + `ctx.http.fetch` |
| `shared/` package | Code that MUST match byte-for-byte on both sides: role lattice, invite rules, signed-message formats, audit canonicalization + hash, state transitions | Pure TS, no runtime deps beyond `@noble/*` |
| `app/` Expo client | UX, local unlock, key custody, signing, rendering view rows | Expo Router, `spacetimedb/react`, `expo-secure-store`, `expo-local-authentication`, `expo-camera`, `expo-notifications`, `expo-crypto` |
| `app/src/module_bindings/` | Typed tables/views/reducers for the client | Output of `spacetime generate --lang typescript` (committed) |

---

## Recommended Project Structure

```
hackUTD2026/
├── spacetime.json                # module-path: server; bindings → app/src/module_bindings
├── package.json                  # npm workspaces: ["app", "server", "shared"]
├── shared/                       # @redphone/shared, pure TS (no build step)
│   ├── roles.ts                  # Role union, LEVEL map, canInvite(inviterRole, targetRole)
│   ├── messages.ts               # challengeMessage(), enrollMessage(), actionMessage() → bytes
│   ├── audit.ts                  # canonicalize(data) + auditEntryHash(prev, seq, ...) (SHA-256)
│   ├── incident.ts               # IncidentStatus union + ALLOWED_TRANSITIONS table
│   └── playbooks/ransomware.ts   # seed data (steps, roles, triggers, depends_on)
├── server/                       # SpacetimeDB module
│   ├── package.json              # "type": "module"; spacetimedb pinned to match CLI/host
│   ├── vitest.config.ts          # spacetimedbModuleTestPlugin()
│   └── src/
│       ├── index.ts              # export { default } from './schema'; re-exports all reducers/views
│       ├── schema.ts             # every table() + schema({...}, { env: { SETUP_CODE_HASH, EXPO_ACCESS_TOKEN? } })
│       ├── lib/
│       │   ├── guard.ts          # requireMember / requireRole / requireFresh / requireNotLocked
│       │   ├── audit.ts          # append(ctx, action, data)
│       │   ├── crypto.ts         # sha256Hex, verifyEd25519, fingerprint
│       │   └── triggers.ts       # fireTrigger(ctx, incident, trigger) → tasks
│       ├── reducers/
│       │   ├── bootstrap.ts      # init, bootstrap_admin
│       │   ├── auth.ts           # request_challenge, verify_challenge, onDisconnect cleanup
│       │   ├── enrollment.ts     # create_invite, redeem_invite, revoke_member, propose/approve_admin, set_lockdown
│       │   ├── incident.ts       # raise_alert, confirm_alert, dismiss_alert, advance_incident, check_in, set_attack_type
│       │   ├── tasks.ts          # accept_task, complete_task, set_asset_status
│       │   ├── chat.ts           # send_message
│       │   ├── clocks.ts         # mark_clock_filed (stretch)
│       │   └── scheduled.ts      # escalate_task, expire_session, clock_reminder, expire_guest, deliver_push
│       ├── views.ts              # every per-sender view
│       └── *.test.ts             # vitest module harness tests
└── app/                          # Expo app
    ├── app/                      # Expo Router routes (see Client Architecture)
    └── src/
        ├── module_bindings/      # GENERATED, committed; never hand-edit
        ├── spacetime/connection.ts   # builder: wss://maincloud.spacetimedb.com, withCompression('none')
        ├── security/keys.ts      # Ed25519 keygen (expo-crypto bytes), sign, fingerprint
        ├── security/pin.ts       # PIN + duress PIN hashing (PBKDF2/scrypt via @noble/hashes)
        ├── security/session.ts   # SessionManager: challenge → sign → verify, re-run on reconnect
        └── components/           # BigButton, TaskCard, ChatBubble, StatusPill, QRDisplay
```

### Structure Rationale

- **`shared/` exists because three things must match exactly on both sides.** These are the signed-message byte formats, the audit hash canonicalization (the client re-verifies the chain), and role/transition rules (the client hides buttons the server would reject). If these drift, signatures fail and chains fail to verify. Keep `shared/` dependency-free apart from `@noble/hashes` and `@noble/curves`. The server bundle and Metro both import it as TS source.
- **Commit the generated bindings.** EAS/dev builds and teammates then do not need the CLI. Regenerate on every schema change with `spacetime generate --lang typescript --out-dir app/src/module_bindings --module-path server`. Or use `spacetime dev --module-path server --module-bindings-path app/src/module_bindings`. Note that `dev` auto-publishes, so point it at a separate dev database such as `redphone-dev`, never the demo database.
- **Split reducers by flow, not by table.** The roadmap phases map onto these files 1:1.
- **Fallback if workspace resolution fights the Spacetime bundler or Metro:** copy `shared/` into `server/src/shared` and `app/src/shared` with a sync script. It is ugly but unblocks you in minutes. Flag: spike this in phase 0.

---

## Mapping plan.md onto SpacetimeDB 2.x Idioms

### Critical framing: no table is public

Any client that knows the database name can open an anonymous connection to Maincloud and subscribe to any **public** table. The threat model assumes an attacker who knows a great deal. So:

- **Every table is private** (the default). Reducers and views can read private tables. Clients cannot. [HIGH: access-permissions docs]
- **Every read goes through a per-sender view** (`spacetimedb.view`, whose context has `ctx.sender`). A view returns rows only when the caller is an active member with a live verified session. An anonymous or stolen-token-only connection subscribes successfully and gets nothing.
- **Views must be `public: true`**, which only means "subscribable". The view body is the access control.
- Client visibility filters (`clientVisibilityFilter.sql`) exist, but the docs present views as the access-control mechanism. Use views.

### View constraints that shape the schema

[HIGH: verified in docs and the `ViewCtx` type in the 2.14.1 source]

1. **No `.iter()` full scans in views.** Docs: "views can only access table data through indexed lookups". Every view needs an index to read through. Design an index for each access pattern (below). For a full ordered read, a btree `filter(new Range())` (unbounded both ends) on an indexed column works.
2. **`ViewCtx` has only `sender`, `db` (read-only), `env`, `from`.** There is no `timestamp` and no `connectionId`. Consequences:
   - A view **cannot check expiry**. Anything time-based (challenge expiry, session TTL, guest expiry, invite expiry) must be **materialized by a scheduled reducer that deletes or flips the row**. The view then reacts because the row is in its read set.
   - A view cannot tell which connection is asking. Read gating is per-identity. Write gating can be per-connection, because reducers have `ctx.connectionId`.
3. **Per-sender views are computed per subscriber.** With about 20 demo users this is irrelevant. Keep read sets small anyway: look up the caller's member and session rows first, then do one indexed filter.
4. **Give projection views a primary key.** Use `t.row('Name', { id: t.u64().primaryKey(), ... })` so the client cache gets `onUpdate` instead of delete+insert. Never reuse the view's generated PascalCase name for the row type.
5. **Do not use views with arguments.** They need 2.13+ (local CLI is 2.12), cannot add `WHERE`, have no PK, and need raw SQL subscriptions. Nothing here needs them.

### Tables (all private)

Names follow the skill rule: snake_case `name`, camelCase accessor. Use `t.string()` for role/status columns, validated against `shared/` literal unions. String btree indexes are well-trodden. Indexing `t.enum` sum types in TS is unverified.

| Table | Key columns | Indexes (access path) | Notes |
|---|---|---|---|
| `config` | `id: u8 PK (=0)`, `lockdown`, `bootstrapCount`, `activeIncidentId: option<u64>`, `owner: identity` | PK | Singleton. `init` stores `owner = ctx.sender` (publisher). |
| `member` | `identity PK`, `displayName`, `role`, `level`, `status`, `invitedBy: option<identity>`, `publicKey: string(hex)`, `keyFingerprint`, `backupFor: option<string role>`, `guestExpiresAt: option<timestamp>`, `joinedAt` | `status` btree (roster), `invitedBy` btree (branch revoke), `role` btree (task assignment) | Keyed by Spacetime identity, not an autoInc id |
| `invite` | `id u64 PK autoInc`, `secretHash unique`, `role`, `displayName`, `createdBy`, `createdAt`, `expiresAt`, `usedBy: option<identity>`, `state` (open/used/expired/revoked) | `secretHash` unique, `createdBy` btree, `state` btree | Never exposes `secretHash` through a view |
| `challenge` | `identity PK`, `connectionId`, `nonce hex`, `issuedAt`, `expiresAt` | PK | One outstanding challenge per identity |
| `session` | `connectionId PK (as u128 or hex string)`, `identity` (btree), `verifiedAt`, `expiresAt` | PK, `identity` btree | Created by `verify_challenge`. Deleted by `session_expiry`, `onDisconnect`, lockdown, revoke |
| `admin_proposal` / `admin_approval` | proposal: `id`, `target`, `kind` (promote/demote/revoke_admin), `proposedBy`, `expiresAt`, `state`; approval: `id`, `proposalId`, `approver` | approval: multi-col `byProposalApprover` | Two-person rule |
| `incident` | `id PK autoInc`, `attackType: option<string>`, `status`, `raisedBy`, `confirmedBy: option<identity>`, `createdAt`, `confirmedAt`, `containedAt`, `recoveredAt`, `closedAt` | `status` btree | At most one non-closed incident (enforced in `raise_alert`) |
| `alert_report` | `id`, `incidentId`, `reporter`, `at` | multi-col `byIncidentReporter` | Dedupes "two independent reports" |
| `checkin` | `id`, `incidentId`, `member`, `state`, `at` | multi-col `byIncidentMember`, `incidentId` btree | Upsert per member |
| `playbook_step` | `id PK`, `attackType`, `trigger`, `order`, `role`, `title`, `body`, `dependsOn: array<u64>`, `escalateAfterSecs` | multi-col `byTypeTrigger` | Seeded in `init`. Read-only after that |
| `task` | `id`, `incidentId`, `stepId`, `assignedTo`, `status` (locked/pending/accepted/done/escalated), `createdAt`, `acceptedAt`, `doneAt` | `incidentId` btree, `assignedTo` btree, multi-col `byIncidentStep` | |
| `asset` | `id`, `name`, `piiStates: array<string>`, `status`, `setBy`, `setAt` | `id` PK + a constant `boardId` btree or `status` btree | Seeded |
| `message` | `id`, `incidentId`, `channel` ('all'/'counsel'), `author`, `body`, `at` | multi-col `byIncidentChannel` | |
| `clock_rule` / `clock` | rule: trigger, duration, label; clock: `incidentId`, `ruleId`, `startedAt`, `deadline`, `sourceAuditSeq`, `status` | `incidentId` btree | Stretch |
| `audit_log` | `seq u64 PK` (own counter, NOT autoInc), `at`, `actor: identity`, `action`, `dataHash`, `prevHash`, `hash` | PK (range scan) | Append-only by convention |
| `audit_head` | `id u8 PK (=0)`, `seq`, `hash` | PK | Chain tip |
| `push_token` | `identity PK`, `expoToken`, `updatedAt` | PK | Never exposed through a view |
| `security_event` | `id`, `at`, `kind`, `identity`, `detail` | `at` btree | Failed signatures, duress (persisted without throwing; see Pattern 6) |
| Schedule tables | `task_escalation{taskId}`, `session_expiry{connectionId}`, `clock_reminder{clockId}`, `guest_expiry{identity}`, `push_job{kind}` | `scheduledId u64 PK autoInc`, `scheduledAt` | Bound with `{ onSchedule: table }` |

Auto-increment IDs have gaps and must not be used for ordering. The audit `seq` is an explicit counter for exactly that reason. [HIGH: concepts skill, critical rule 4]

### Views (the visibility matrix from plan.md, made concrete)

Every view starts with the same gate:

```typescript
function viewer(ctx: ViewCtxT) {
  const me = ctx.db.member.identity.find(ctx.sender);
  if (!me || me.status !== 'active') return null;
  // Read gate: some live session exists for this identity (expiry materialized by scheduler)
  const hasSession = ctx.db.session.identity.filter(ctx.sender).next().done === false;
  return hasSession ? me : null;
}
```

| View | Who gets rows | Body (indexed path) |
|---|---|---|
| `my_member` | caller (no session needed) | `member.identity.find(sender)` |
| `my_challenge` | caller (no session needed) | `challenge.identity.find(sender)` |
| `roster` | active members | `member.status.filter('active')` projected to `{identity, displayName, role, level, keyFingerprint, invitedBy, backupFor}`. Drop `publicKey` if you want, though it is harmless |
| `my_invites` | inviter sees own; Admin sees all | `invite.createdBy.filter(sender)` or `invite.state.filter(...)` for Admin. Project out `secretHash` |
| `pending_admin_proposals` | Admins | `admin_proposal.state.filter('open')` |
| `incident_now` | members (Guests: limited) | `config.activeIncidentId` → `incident.id.find` |
| `checkins` | members (Lead sees presence) | `checkin.incidentId.filter(active)` |
| `tasks` / `my_tasks` | members / caller | `task.incidentId.filter` / `task.assignedTo.filter(sender)` joined to `playbook_step` text |
| `board` | members | `asset.<index>.filter(...)` |
| `messages_all` | members incl. Guests | `message.byIncidentChannel.filter([inc, 'all'])` |
| `messages_counsel` | **role === 'counsel' only** (decide whether Admin/Lead are included; the spec says "counsel-only, invisible to other roles") | `message.byIncidentChannel.filter([inc, 'counsel'])`. Returns `[]` for others, so the channel's existence and contents never reach their cache |
| `clocks` | Counsel + Lead | `clock.incidentId.filter` |
| `audit_feed` | Admins | `auditLog.seq.filter(new Range())` (full ordered read through the PK btree) |

When a member is revoked, or their session row is deleted, the rows vanish from their client automatically, because the member/session row is in the view's read set. [HIGH: typescript-server skill, "Views" section]

### Reducers mapped to plan.md

| plan.md reducer | Guard | Notes |
|---|---|---|
| (new) `bootstrap_admin(setupCode, displayName, publicKey, sig)` | none (pre-membership) | sha256(setupCode) == `ctx.env.SETUP_CODE_HASH`; `config.bootstrapCount < 2`; distinct identity |
| (new) `request_challenge()` | member, active | Writes a `challenge` row bound to `ctx.connectionId` |
| (new) `verify_challenge(signatureHex)` | member, active | Creates `session`, schedules `session_expiry` |
| (new) `register_push_token(token)` | fresh | Upserts `push_token` |
| `create_invite(secretHash, role, displayName)` | fresh + `canInvite` | Client generates the secret. The server only ever receives the hash at creation |
| `redeem_invite(secret, publicKey, sig)` | not yet a member | Atomic (Pattern 4) |
| `revoke_member(target)` | fresh, Admin | Revokes the whole `invitedBy` branch (BFS through the `invitedBy` index), deletes their sessions, kills their open invites. Revoking an **Admin** goes through `admin_proposal` |
| `propose_admin` / `approve_admin` | fresh, Admin | Two distinct Admins; the target cannot approve |
| `lockdown(on)` | fresh, Admin | Deletes all non-Admin sessions, so their views drop to `[]` instantly |
| `raise_alert` | fresh | Creates or joins the `possible` incident |
| `confirm_alert` / `dismiss_alert` | fresh, Lead | |
| `check_in(state)` | fresh | |
| `set_attack_type(type)` | fresh, Lead | Fires the `attack_type:<type>` trigger |
| `accept_task` / `complete_task` | fresh, assignee (Lead may also complete) | Complete → unlock dependents |
| `set_asset_status(assetId, status)` | fresh, IT/Lead | Fires the `asset:<status>` trigger; may start clocks |
| `send_message(channel, body)` | fresh; counsel channel requires counsel role | |
| `advance_incident(to)` (`close_incident` is its last step) | fresh, Lead | contained → recovered → closed |
| `mark_clock_filed` | fresh, Counsel/Lead | stretch |
| `escalate_task`, `clock_reminder`, `expire_session`, `expire_guest` | `ctx.senderAuth.isInternal` | Scheduled; private by default in 2.x, still checked explicitly |
| `deliver_push` (procedure) | `ctx.sender.isEqual(ctx.databaseIdentity)` | `ProcedureCtx` has no `senderAuth`. Compare identities instead [HIGH: 2.14.1 source] |

"Fresh" means a `session` row exists for **(ctx.connectionId, ctx.sender)** and has not expired by `ctx.timestamp`.

---

## Architectural Patterns

### Pattern 1: Single guard + audit in every reducer

**What:** Every client-callable reducer calls `guard(ctx, opts)` first and `audit.append(ctx, action, data)` last. plan.md: "Every reducer verifies three things ... Every reducer appends to audit_log".
**When to use:** All reducers except scheduled ones. Scheduled ones still audit, with actor = module identity.
**Trade-offs:** Uniform and easy to review. The cost is one extra row write plus a hash per action, which is negligible.

```typescript
// server/src/lib/guard.ts
type GuardOpts = { roles?: Role[]; fresh?: boolean; allowDuringLockdown?: boolean };
export function guard(ctx: Ctx, o: GuardOpts = { fresh: true }) {
  const me = ctx.db.member.identity.find(ctx.sender);
  if (!me || me.status !== 'active') throw new SenderError('not an active member');
  if (me.role === 'guest' && me.guestExpiresAt && me.guestExpiresAt.microsSinceUnixEpoch < ctx.timestamp.microsSinceUnixEpoch)
    throw new SenderError('guest access expired');
  const cfg = ctx.db.config.id.find(0)!;
  if (cfg.lockdown && me.role !== 'admin' && !o.allowDuringLockdown) throw new SenderError('lockdown');
  if (o.roles && !o.roles.includes(me.role as Role)) throw new SenderError('role not allowed');
  if (o.fresh !== false) {
    if (!ctx.connectionId) throw new SenderError('no connection');
    const s = ctx.db.session.connectionId.find(ctx.connectionId.toHexString());
    if (!s || !s.identity.isEqual(ctx.sender) || s.expiresAt.microsSinceUnixEpoch <= ctx.timestamp.microsSinceUnixEpoch)
      throw new SenderError('fresh signed challenge required');
  }
  return me;
}
```

### Pattern 2: Identity model, with Spacetime identity and device key as two separate factors

**What:** Two independent credentials. The roadmap must treat them as separate.

| Credential | Created by | Stored | Proves | Alone gets an attacker |
|---|---|---|---|---|
| Spacetime token (JWT) → `ctx.sender` identity | Maincloud on the first anonymous connect | `expo-secure-store` | "This is the same Spacetime identity" | Connect and subscribe. **Views return `[]` without a live session. Reducers throw without a connection-bound session** |
| Ed25519 device key | Phone at enrollment (`expo-crypto` 32 random bytes → `@noble/curves` ed25519) | `expo-secure-store` with `requireAuthentication: true` (biometric-gated keychain item) | Possession of the enrolled phone + biometric | Nothing server-side without the token. Nothing locally without biometric + PIN |

- `member` is keyed by `ctx.sender` identity and stores `publicKey`. The binding happens once, in `redeem_invite`, where the client signs `enrollMessage(identityHex, secretHashHex)` with the new key (proof of possession). The role and display name come from the **invite row**, never from client args.
- Never take identity as an argument. Never construct `Identity` from strings. Use `ctx.sender` only. [HIGH: skills]
- Losing the token (app reinstall) means re-enrollment. This is acceptable, and it is a security feature.

**Signed-challenge gate (step-up session bound to a connection):**

```
Client (unlocked; key in memory)          Server
──────────────────────────────           ──────────────────────────────────────
onConnect / onReconnect ───────────────▶ request_challenge()
                                           guard(fresh:false)
                                           nonce = hex(ctx.random.fill(32 bytes))
                                           upsert challenge{identity, connectionId,
                                             nonce, expiresAt = now+60s}
my_challenge view row arrives ◀───────────
msg = challengeMessage(db, identityHex,
      connIdHex, nonce, expiresAt)       (shared/messages.ts: fixed byte format,
sig = ed25519.sign(msg, sk)               domain-separated "redphone-v1|challenge|...")
verify_challenge(sigHex) ──────────────▶ ch = challenge.identity.find(sender)
                                           require ch.connectionId == ctx.connectionId
                                           require ch.expiresAt > ctx.timestamp
                                           ed25519.verify(sig, msg, member.publicKey)
                                           delete challenge (single use)
                                           insert session{connectionId, identity,
                                             expiresAt = now+15min}
                                           schedule session_expiry at expiresAt
                                           audit.append('session.verified')
views now return data ◀──────────────────  (session row in each view's read set)
```

- **Writes are bound to the connection.** A stolen token on another socket has a different `connectionId` and no session, so its writes fail.
- **Reads are bound to the identity**, because views have no `connectionId`. Known limitation: while the legitimate user has a live session, a stolen token could read on a parallel connection. Mitigation: a short TTL (15 minutes), session deletion on disconnect (`clientDisconnected` hook), and lockdown wiping sessions. Document this honestly for judges.
- **Reconnects get a fresh `connectionId`.** The automatic-reconnect SDK gives each attempt a new connection ID [HIGH: client skill]. The `SessionManager` must re-run the handshake in `onConnect`. While unlocked it does this silently, because the key stays in memory. After lock/background it wipes the key and the next unlock re-prompts.
- `ctx.random` is a host-seeded deterministic RNG. The nonce's job is uniqueness, not secrecy, because the attacker lacks the private key. Including `connectionId` + `expiresAt` in the signed message makes replay impossible even if the nonce repeats.
- **Stretch (per-action signatures):** for `approve_admin`, `revoke_member`, and `lockdown`, have the client sign `actionMessage(action, canonicalArgs, nonce)` and pass `sig` as an argument. This is stronger, but it costs a round-trip. Do it only if time remains.

### Pattern 3: Hash-chained audit log inside the reducer transaction

**What:** `append` reads `audit_head`, computes the next hash, inserts `audit_log`, and updates `audit_head`, all inside the caller's transaction.
**Why it is correct on Spacetime:** each database runs transactions **one at a time on a single thread** with serializable isolation [HIGH: concepts skill]. So there are no races on `seq`/`prevHash`. If the reducer throws, the action and its audit entry roll back together, so the log only ever contains committed actions.

```typescript
// shared/audit.ts — identical on client (verification) and server (append)
export function auditEntryHash(e: { seq: bigint; atMicros: bigint; actorHex: string; action: string; dataHash: string; prevHash: string }): string {
  const line = ['rp-audit-v1', e.seq.toString(), e.atMicros.toString(), e.actorHex, e.action, e.dataHash, e.prevHash].join('|');
  return bytesToHex(sha256(utf8(line)));
}
export function canonicalize(v: unknown): string { /* sorted keys; bigint→string; Identity→hex; Uint8Array→hex */ }

// server/src/lib/audit.ts
export function append(ctx: Ctx, action: string, data: unknown) {
  const head = ctx.db.auditHead.id.find(0)!;        // created in init with seq=0, hash=GENESIS
  const seq = head.seq + 1n;
  const dataHash = bytesToHex(sha256(utf8(canonicalize(data))));
  const hash = auditEntryHash({ seq, atMicros: ctx.timestamp.microsSinceUnixEpoch,
    actorHex: ctx.sender.toHexString(), action, dataHash, prevHash: head.hash });
  ctx.db.auditLog.insert({ seq, at: ctx.timestamp, actor: ctx.sender, action, dataHash, prevHash: head.hash, hash });
  ctx.db.auditHead.id.update({ ...head, seq, hash });
}
```

- **SHA-256 in the module runtime:** `@spacetimedb/crypto` (official, v0.1.0) exports `sha256(data) → Uint8Array`, `bytesToHex`, and `timingSafeEqual`, and is documented as deterministic for TS modules [HIGH: package README]. It has **no Ed25519**. For the shared hash on both sides, prefer `@noble/hashes/sha2` (pure JS; works in Hermes and V8) so one implementation runs everywhere. Use `@spacetimedb/crypto` as the server fallback.
- **Ed25519 verify in the module:** use `@noble/curves/ed25519` (pure JS, BigInt-based; verification needs no RNG). TS modules bundle npm packages at publish [HIGH: concepts skill]. **Whether noble runs unmodified in the Spacetime V8 runtime is unverified [MEDIUM]. Spike it in phase 0** with a module unit test plus one deployed call.
- **What the chain detects:** edits (hash mismatch), deletions in the middle (`seq` gap plus `prevHash` mismatch), and tail truncation (compare to `audit_head` and to tip hashes shown or exported earlier). The Maincloud dashboard lets the **owner** edit and delete rows. The chain makes that visible. It does not prevent it.
- **Verification runs on the client** (Admin's audit screen recomputes every hash with `shared/audit.ts`). That is stronger evidence than "the server says the chain is fine".
- **Failed attempts:** a throwing reducer cannot persist anything. For security-relevant failures (bad signature, expired or used invite secret, bootstrap code misuse), **return without throwing**: write a `security_event` and an audit entry, and set a caller-visible status (for example, the `my_challenge.state = 'failed'` row). Use `throw new SenderError` for ordinary validation errors.

### Pattern 4: Atomic invite redemption + bootstrap + two-admin approval

**Invite create** (client-side secret generation, so the secret never reaches the server until redemption):
1. Inviter's phone: `secret = expo-crypto.getRandomBytes(32)` → `secretHash = sha256(secret)`.
2. `create_invite({secretHash, role, displayName})`: `guard(fresh)`, `canInvite(me.role, role)` from `shared/roles.ts`, `expiresAt = now + 10min`, then audit. Schedule an `invite_expiry` row (optional; the reducer checks expiry anyway).
3. QR = `redphone://invite?v=1&db=redphone&s=<base64url(secret)>`. It is shown only on the inviter's screen, so it travels in person only.

**Invite redeem: one reducer, one transaction:**

```typescript
export const redeemInvite = spacetimedb.reducer(
  { secret: t.string(), publicKey: t.string(), sig: t.string() },
  (ctx, { secret, publicKey, sig }) => {
    if (ctx.db.member.identity.find(ctx.sender)) throw new SenderError('already enrolled');
    const h = sha256Hex(hexToBytes(secret));
    const inv = ctx.db.invite.secretHash.find(h);
    if (!inv || inv.state !== 'open' || inv.expiresAt.microsSinceUnixEpoch <= ctx.timestamp.microsSinceUnixEpoch) {
      recordSecurityEvent(ctx, 'invite.redeem_failed', { h });   // persists: no throw
      return;
    }
    const inviter = ctx.db.member.identity.find(inv.createdBy);
    if (!inviter || inviter.status !== 'active' || !canInvite(inviter.role, inv.role)) { recordSecurityEvent(...); return; }
    if (ctx.db.config.id.find(0)!.lockdown) throw new SenderError('lockdown');
    if (!verifyEd25519(sig, enrollMessage(ctx.sender.toHexString(), h), publicKey)) { recordSecurityEvent(...); return; }
    ctx.db.invite.id.update({ ...inv, state: 'used', usedBy: ctx.sender });
    ctx.db.member.insert({ identity: ctx.sender, displayName: inv.displayName, role: inv.role, level: LEVEL[inv.role],
      status: 'active', invitedBy: inv.createdBy, publicKey, keyFingerprint: fingerprint(publicKey), ... });
    append(ctx, 'member.enrolled', { invite: inv.id, role: inv.role, inviter: inv.createdBy.toHexString() });
  });
```

A second scan finds `state === 'used'` and fails. The check and the write happen in one serialized transaction, so there is no TOCTOU window. [HIGH: serializable single-threaded transactions]

**Two-admin bootstrap:**
- Declare `SETUP_CODE_HASH: t.string()` in `schema(tables, { env: {...} })` and supply it at publish (CLI 2.12 supports `--env` / spacetime.json env maps; verified via `spacetime publish --help`). Never commit the code.
- `bootstrap_admin(setupCode, displayName, publicKey, sig)`: requires `config.bootstrapCount < 2`, sha256(code) == env hash (constant-time compare), caller not already a member, and a valid proof-of-possession signature. It inserts an Admin, increments the count, and audits. After two Admins the code is permanently dead, even if it leaks.
- Fallback if env declarations cause trouble: an owner-only `set_setup_code_hash` reducer (`ctx.sender.isEqual(config.owner)`, allowed only while `bootstrapCount === 0`). `init` records the publisher as `owner`.

**Two-admin approval:**
- `propose_admin({target, kind})` → `admin_proposal{state:'open', expiresAt: now+24h}` + the proposer's approval row.
- `approve_admin({proposalId})` → reject duplicates (multi-col index `byProposalApprover`), reject approver == target. When there are 2 distinct approvers, apply the change (promote: `role = 'admin'`; revoke-admin: `status = 'revoked'`), set `state = 'executed'`, and audit.
- Apply the same two-person rule to **revoking or demoting an Admin**. Otherwise one compromised Admin can remove the other and own the system. That would be a spec gap. Flag it to the roadmap.

### Pattern 5: Alert state machine + trigger-driven task engine

**Incident states** (transition table lives in `shared/incident.ts`; the server enforces it, the client uses it to show buttons):

```
          raise_alert (1st report)
  (none) ─────────────────────────▶ possible ──dismiss_alert (Lead)──▶ dismissed
                                       │
         confirm_alert (Lead)  OR  2nd distinct reporter via raise_alert
                                       ▼
                                    active ── set_attack_type (Lead) fires 'attack_type:<T>'
                                       │
                 advance_incident (Lead): contained ──▶ recovered ──▶ closed
                                       (each transition fires 'incident:<state>' trigger)
```

- `raise_alert`: if `config.activeIncidentId` is open, add an `alert_report` (dedupe by `byIncidentReporter`). If the distinct reporters number 2 or more and the status is `possible`, confirm. Otherwise create an incident in `possible` and set `activeIncidentId`. When it is `possible`, enqueue a push **only to Leads** ("Leads notified" in the plan.md flowchart).
- On entering `active`: enqueue `push_job{audience:'all'}`, set `confirmedAt`, and audit. A single stolen non-Lead phone cannot confirm. Two reports require two distinct identities.
- A stolen **Lead** phone can still confirm alone. That is spec-accepted, and the PIN + biometric + signed session still apply.

**Trigger engine** (`server/src/lib/triggers.ts`, called inside the triggering reducer, so everything stays atomic):

```
fireTrigger(ctx, incident, trigger):
  for step in playbook_step.byTypeTrigger.filter([incident.attackType, trigger]):
     if task.byIncidentStep.find([incident.id, step.id]) exists: continue      // idempotent
     assignee = pickAssignee(ctx, step.role)   // active member with role, prefer checkin 'here',
                                                // else member whose backupFor == role, else Lead
     locked  = step.dependsOn.some(dep => !doneTask(incident.id, dep))
     task = insert task{status: locked ? 'locked' : 'pending', assignedTo: assignee}
     if !locked: schedule task_escalation at now + step.escalateAfterSecs
     audit.append('task.created', ...)
complete_task → mark done → for each task in incident whose step.dependsOn includes this step:
     if all deps done: status 'locked'→'pending', schedule escalation, audit
escalate_task (scheduled, isInternal): if task.status still 'pending' → reassign to backup,
     status 'escalated'→'pending' for new assignee, system message to Lead, push_job{audience: lead}
```

- Triggers come from three places: `set_attack_type` (`attack_type:ransomware`), `set_asset_status` (`asset:locked`, `asset:stolen`, ...), and `advance_incident` (`incident:contained`, ...). The ransomware seed in `shared/playbooks/ransomware.ts` mostly uses `attack_type:ransomware` plus `asset:locked`.
- A dependency on a step that has no task instance yet counts as "not done", so the task stays locked.
- Cancel escalation on accept: delete the `task_escalation` row by `taskId`. **Unverified:** the docs do not say whether deleting a schedule row cancels it [MEDIUM]. Because `escalate_task` re-checks `task.status`, a stale fire is harmless either way. Design for that.
- Assignment, the push to the assignee, and the task appearing on their phone all happen in one transaction. The `my_tasks` view delivers the row live. There is no polling and no notification server.

### Pattern 6: Push via scheduled procedure (the only network edge)

```typescript
const pushJob = table({ name: 'push_job' }, {
  scheduledId: t.u64().primaryKey().autoInc(), scheduledAt: t.scheduleAt(), audience: t.string(),
});
// enqueue from any reducer (fires ASAP after commit):
ctx.db.pushJob.insert({ scheduledId: 0n, scheduledAt: ScheduleAt.time(ctx.timestamp.microsSinceUnixEpoch), audience: 'all' });

export const deliverPush = spacetimedb.procedure(
  { onSchedule: pushJob }, { job: pushJob.rowType }, t.unit(),
  (ctx, { job }) => {
    if (!ctx.sender.isEqual(ctx.databaseIdentity)) return {};          // module-only
    const tokens = ctx.withTx(tx => audienceTokens(tx, job.audience));  // DB read in short tx
    const res = ctx.http.fetch('https://exp.host/--/api/v2/push/send', {   // I/O OUTSIDE tx
      method: 'POST',
      headers: { 'content-type': 'application/json', /* Authorization: Bearer ctx.env.EXPO_ACCESS_TOKEN */ },
      body: JSON.stringify(tokens.map(to => ({ to, title: 'Red Phone', body: 'Open app', priority: 'high', sound: 'default' }))),
    });
    ctx.withTx(tx => tx.db.pushLog.insert({ id: 0n, at: tx.timestamp, status: res.status, count: tokens.length }));
    return {};
  });
```

- Reducers cannot do network I/O. Procedures can, via synchronous `ctx.http.fetch` (30 s default timeout, 180 s max). Do the I/O outside `withTx`, and only DB work inside it. The `withTx` body may re-run, so keep it deterministic. [HIGH: procedures docs + skill]
- Scheduled procedures **delete the row before execution** [HIGH: schedule-tables docs], so carry everything needed in the row.
- The payload is content-free by construction. The body text is a constant.
- Batch at most 100 messages per Expo request (Expo API limit, from training data [MEDIUM]). The demo has fewer than 30 people.
- Exported procedures are client-callable in principle, which is why the identity check is there.

---

## Data Flow

### Write path (every user action)

```
Tap (BigButton)
  → conn.reducers.xxx({...})                  [WSS frame; args private to sender]
  → reducer: guard() → validate → mutate tables → fireTrigger()? → enqueue push_job? → audit.append()
  → COMMIT (atomic; durable before clients see it)
  → affected per-sender views re-evaluated (read set changed)
  → row deltas pushed to each subscribed client
  → useTable() re-renders; reducer promise resolves (or rejects with SenderError)
  → after commit: scheduler fires push_job → deliver_push → Expo → APNs/FCM
```

### Read path

```
App unlock → SessionManager handshake → session row exists
  → DataGate mounts useTable(tables.roster), useTable(tables.incidentNow), useTable(tables.myTasks), ...
  → initial rows (isReady=true) → live deltas forever
  → lock / background → wipe key from memory; disconnect or let session expire
  → session_expiry deletes session → views return [] → client cache clears those rows
```

### Key data flows

1. **Enrollment:** Inviter phone (secret, hash) → `create_invite(hash)` → QR on screen → new phone scans → keygen + PIN set locally → anonymous connect (gets identity + token → SecureStore) → `redeem_invite(secret, pk, sig)` → member row → `my_member` view shows the role → handshake → full app.
2. **Alert:** `raise_alert` → `possible` (push to Leads) → `confirm_alert` / second report → `active` → `push_job` → every phone gets "Red Phone: open app" → unlock → handshake → `incident_now` shows ACTIVE → `check_in`.
3. **Playbook:** Lead `set_attack_type('ransomware')` → `fireTrigger` → `task` rows per role → each assignee's `my_tasks` view updates live → `accept_task` → `complete_task` → dependents unlock → the board and clocks update.
4. **Escalation (stretch):** `task_escalation` fires → task still pending → reassign to backup + Lead message + push.
5. **Audit:** every write appends. The Admin `audit_feed` view → the client recomputes the chain with `shared/audit.ts` → green/red badge → export (stretch).

---

## Client Architecture (Expo)

### Navigation (Expo Router, gate-driven)

```
app/app/
├── _layout.tsx            # boot: read SecureStore → build connection → <SpacetimeDBProvider>
│                          #   → <LockProvider> → <Slot/>; redirects by state machine below
├── (enroll)/
│   ├── welcome.tsx        # "Scan invite" / "Set up first Admin"
│   ├── scan.tsx           # expo-camera barcode → parse redphone:// URI
│   ├── pin.tsx            # set PIN + optional duress PIN (hash stored locally)
│   ├── bootstrap.tsx      # setup-code entry (first two Admins only)
│   └── done.tsx           # shows own key fingerprint
├── unlock.tsx             # biometric (expo-local-authentication) + PIN pad; duress → /decoy
├── decoy.tsx              # harmless screen; silent duress reducer fired in background (stretch)
└── (main)/                # requires: unlocked AND session verified
    ├── _layout.tsx        # Tabs + <DataGate> (mounts all useTable view subscriptions once)
    ├── index.tsx          # "NOW": status banner, Possible-attack button, check-in, my next task
    ├── tasks.tsx          # my tasks (accept/done), locked tasks greyed with reason
    ├── chat/[channel].tsx # 'all' | 'counsel' (tab only rendered if messages_counsel allowed)
    ├── board.tsx          # asset status grid; tap → status sheet (IT/Lead)
    ├── people.tsx         # roster, presence, fingerprints (in-person compare)
    ├── lead/attack-type.tsx  # big 5-choice picker
    └── admin/
        ├── invite.tsx     # role + name → QR (10-min countdown)
        ├── approvals.tsx  # two-admin proposals
        ├── audit.tsx      # audit feed + chain verification badge
        └── lockdown.tsx
```

**Root gate state machine (client):**
`NO_TOKEN_OR_KEY → (enroll)` · `ENROLLED_LOCKED → /unlock` · `UNLOCKED_NO_SESSION → spinner while handshake` · `READY → (main)` · `DURESS → /decoy`.
`my_member` and `my_challenge` are the only views subscribed before unlock. Both are session-independent.

### Connection setup (Expo specifics)

```typescript
DbConnection.builder()
  .withUri('wss://maincloud.spacetimedb.com')
  .withDatabaseName('redphone')
  .withToken(storedToken ?? undefined)
  .withCompression('none')            // Hermes lacks DecompressionStream; default is 'gzip'
  .withAutomaticReconnect()
  .onConnect((_c, _id, token) => SecureStore.setItemAsync(TOKEN_KEY, token))
```

- **SDK internals checked in the 2.14.1 source.** The SDK uses `URL.searchParams`, `fetch` (token exchange at `/v1/identity/websocket-token`), `TextEncoder`/`TextDecoder`, and global `WebSocket`. Expo ships built-in spec-compliant `URL`/`URLSearchParams` and UTF-8 `TextDecoder` on native [MEDIUM: Expo docs]. The default `gzip` compression calls `new DecompressionStream`, which Hermes does not provide. **Set `withCompression('none')`** [MEDIUM: inferred from source; verify in the phase 0 spike].
- No official React Native or Expo quickstart exists. `spacetimedb/react` (`SpacetimeDBProvider`, `useTable`, `useSpacetimeDB`) is plain React and should work [MEDIUM].
- **Subscription strategy:** subscribe to **views only**, once, in `DataGate`, for the life of the unlocked session. There are about 12 views, and the demo-scale data is tiny. Never subscribe per screen, and never add manual subscriptions alongside `useTable` [HIGH: client skill]. Use `isReady` before rendering "no tasks". Copy `useTable` rows before sorting (they are readonly). Wrap `bigint` in `String()`/`Number()` in JSX.
- Reducer calls go in event handlers only. On `UnknownCallResultError` (connection lost mid-call), **do not auto-retry non-idempotent calls** such as `raise_alert` or `send_message` [HIGH: client skill]. Make server reducers idempotent where cheap: `raise_alert` dedupes by reporter, and `check_in` upserts.
- **Local unlock:** `LocalAuthentication.authenticateAsync()` → PIN pad → compare with PBKDF2(PIN, salt) stored in SecureStore (constant-time) → read the Ed25519 secret key from SecureStore (`requireAuthentication: true` may prompt biometrics itself) → keep it in memory only while foregrounded → `AppState` 'background' wipes it and locks.
- **Push token:** `getExpoPushTokenAsync({ projectId })` → `register_push_token`. **Remote push does not work in Expo Go on Android since SDK 53. A development build is required** [HIGH: Expo docs]. Plan a dev build (EAS or local) early.

---

## Suggested Build Order

Dependencies drive this order. Every later reducer needs `guard` + `audit`. Every view needs `member` + `session`. Tasks need incidents. Push needs incidents and tokens.

```
P0 Spike ──▶ P1 Server core ──▶ P2 Enrollment+Unlock ──▶ P3 Alert+Push+Chat ──▶ P4 Playbook+Board ──▶ P5 Audit UI+Stretch+Demo
                (guard, audit,       (client shell lands       (needs session,        (needs incident,       (needs everything
                 session, views)      here)                     roster, tokens)        roster/roles)          to exist)
```

| Phase | Builds | Depends on | Exit check |
|---|---|---|---|
| **P0 Spike (~2h, highest risk first)** | Monorepo skeleton; `spacetime.json`; server with 1 table + 1 view; Expo app connecting from a **physical phone** with `withCompression('none')`; `@noble/curves` ed25519 verify + sha256 running inside the module (vitest harness + one deployed call); generate bindings into `app/`; start the EAS/dev build for push | nothing | Phone shows a live row from a per-sender view; signature verify passes server-side |
| **P1 Server core** | `config`, `member`, `challenge`, `session`, `audit_log`/`audit_head`, `security_event`; `guard`, `audit.append`, `shared/messages.ts`, `shared/audit.ts`, `shared/roles.ts`; `init` seeding; `bootstrap_admin`, `request_challenge`, `verify_challenge`, `expire_session`, disconnect cleanup; views `my_member`, `my_challenge`, `roster`, `audit_feed`; vitest tests for chain + guard | P0 | Unit tests: chain links, gaps detected, unauthenticated calls rejected |
| **P2 Enrollment + unlock (client shell)** | `create_invite`, `redeem_invite`, `revoke_member` (branch), `propose_admin`/`approve_admin`, `lockdown`; `my_invites`, `pending_admin_proposals`; client: Router gates, enroll flow (scan/PIN/keygen), bootstrap screen, unlock (biometric + PIN), SessionManager, people tab with fingerprints, admin invite QR | P1 | Two Admins bootstrapped on two phones; a third phone enrolls by QR; a second scan fails |
| **P3 Alert + push + chat** | `incident`, `alert_report`, `checkin`, `message`, `push_token`, `push_job` + `deliver_push`; reducers `raise_alert`, `confirm_alert`, `dismiss_alert`, `check_in`, `send_message`, `advance_incident`; views `incident_now`, `checkins`, `messages_all`, `messages_counsel`; NOW screen, chat tabs | P2 (members, sessions, roles) | Confirm on phone A → push lands on phones B/C → counsel channel invisible to non-counsel |
| **P4 Playbook + tasks + board** | `playbook_step` seed (ransomware), `task`, `asset`; `set_attack_type`, `accept_task`, `complete_task`, `set_asset_status`; `fireTrigger` + dependency unlock; views `tasks`/`my_tasks`, `board`; tasks + board screens | P3 (incident lifecycle) | Pick ransomware → each role's phone shows its task; dependent task unlocks on Done |
| **P5 Audit UI, stretch, demo hardening** | Client chain verifier + audit screen; `task_escalation`/`escalate_task`; clocks (`clock_rule`, `clock`, `clock_reminder`); duress; guest expiry; report export; demo seed/reset script; separate demo DB | P4 | 3-minute tabletop runs end-to-end on judge phones |

**Parallelism (coarse granularity, a team of several people):** after P1, one person can take client P2 screens while another writes P3/P4 reducers against the vitest harness. Server reducers do not need the client to be testable. Chat (P3) and Board (P4) are independent of each other. Stretch clocks depend only on `set_asset_status` firing a trigger.

**Research flags for phases:**
- **P0 needs a hands-on spike, not more reading.** Open questions: Expo/Hermes + SDK compatibility, noble in the Spacetime V8 runtime, `spacetimedb` npm version vs CLI 2.12 vs Maincloud host version, and workspace imports through the Spacetime bundler and Metro.
- **P2 has two unverified points.** First, `expo-secure-store` `requireAuthentication` behavior in dev builds vs Expo Go. Second, the QR scan UX with `expo-camera`.
- **P3: the Expo push API details** (access token, receipts, the 100-message batch limit) come from training data and need checking.
- P1 and P4 are standard Spacetime patterns. They are covered by the skills and are unlikely to need more research.

---

## Scaling Considerations

| Scale | Architecture adjustments |
|---|---|
| Demo / one firm (5-200 members) | Exactly as designed. One database, per-sender views. Every transaction is microseconds |
| Multi-firm SaaS (many tenants) | One database per firm (also a blast-radius win). Shared code via submodules. No cross-tenant tables |
| Large firm (1k+ members on one incident) | Per-sender views are computed per subscriber. Move the hot shared feeds (`messages_all`, `board`) to anonymous or query-builder views where the gate allows, or partition by team. Batch Expo pushes in groups of 100 |

### Scaling priorities

1. **First bottleneck: per-sender view recomputation on every message insert.** It is not a concern at hackathon scale. Keep view read sets to an indexed filter.
2. **Second: push fan-out latency.** One synchronous procedure call per batch. Chunk it, and record receipts.

---

## Anti-Patterns

### Anti-Pattern 1: Public tables "because the client needs them"
**What people do:** mark `member`/`message` `public: true` and filter on the client.
**Why it's wrong:** any anonymous Maincloud connection can subscribe. The counsel channel and roster leak to anyone who knows the database name.
**Do this instead:** make all tables private and expose them only through per-sender views. Check this in code review: `grep "public: true"` should match only `view(...)` options.

### Anti-Pattern 2: Time checks inside views
**What people do:** filter `expiresAt > now` in a view.
**Why it's wrong:** `ViewCtx` has no timestamp. Either it will not compile, or you will reach for an external clock and break determinism.
**Do this instead:** schedule a reducer at the expiry time that deletes or flips the row. Reducers check `ctx.timestamp` themselves.

### Anti-Pattern 3: Trusting identity, role, or display name from reducer args
**What people do:** `redeem_invite({ role, name, ... })` or `raise_alert({ reporter })`.
**Why it's wrong:** clients control args. This defeats the invite hierarchy and the two-reporter rule.
**Do this instead:** use `ctx.sender` only. Read role and name from the invite row.

### Anti-Pattern 4: Network or randomness in reducers
**What people do:** call Expo push from `confirm_alert`, or use `Math.random()` / `crypto.getRandomValues` for nonces.
**Why it's wrong:** reducers are deterministic, cannot do I/O, and the stdlib RNG is unavailable.
**Do this instead:** reducers enqueue a `push_job` and a scheduled procedure does the I/O. Nonces come from `ctx.random.fill(...)`.

### Anti-Pattern 5: Audit as an afterthought or a separate call
**What people do:** the client calls `log_action` after the real reducer, or audit uses autoInc ids for ordering.
**Why it's wrong:** it is not atomic (the action commits but the log fails), and autoInc ids have gaps.
**Do this instead:** call `append()` inside the same reducer, with an explicit `seq` from `audit_head`.

### Anti-Pattern 6: Throwing on security failures you need to record
**What people do:** `throw` on a bad signature or bad invite, then wonder why nothing was logged.
**Why it's wrong:** a throw rolls back the whole transaction, including the audit and security-event rows.
**Do this instead:** record the event and `return` (the action is not performed). The client learns the outcome through a status row.

### Anti-Pattern 7: Sharing one database between dev and demo
**What people do:** run `spacetime dev` against the demo DB.
**Why it's wrong:** `--delete-data on-conflict` or a breaking schema change wipes enrolled judges and Admins mid-event.
**Do this instead:** use `redphone-dev` for iteration and `redphone` for the demo, published deliberately.

---

## Integration Points

### External Services

| Service | Integration pattern | Notes |
|---|---|---|
| SpacetimeDB Maincloud | Client WSS via `DbConnection`. Module published via CLI | CLI is 2.12.0 locally; npm `spacetimedb` latest is 2.14.1. **Pin the module's `spacetimedb` dependency to the version the CLI/host supports, or upgrade the CLI.** Mismatches are a classic failure. The plan requires ≥2.11 (impersonation fix) |
| Expo push service | `deliver_push` procedure → `ctx.http.fetch` POST `https://exp.host/--/api/v2/push/send` | Content-free payload. Optional `EXPO_ACCESS_TOKEN` module env secret. Android needs FCM credentials in the dev build |
| APNs / FCM | Indirect, through Expo | They see only "Red Phone: open app" |

### Internal Boundaries

| Boundary | Communication | Notes |
|---|---|---|
| app ↔ server | Reducer calls (up), view row deltas (down), via generated bindings | The client never reads tables directly. All views |
| app ↔ shared, server ↔ shared | Direct TS import | Must be byte-identical: message formats, audit hash, role rules |
| reducers ↔ scheduled reducers/procedures | Insert into a schedule table. The host invokes later | Callee checks `ctx.senderAuth.isInternal` (reducer) or `sender == databaseIdentity` (procedure) |
| procedure ↔ DB | `ctx.withTx` short transactions | No HTTP inside a tx. The tx body may re-run |
| client security ↔ UI | `LockProvider` context + `SessionManager` | Key in memory only while unlocked |

---

## Sources

- `/Users/adem/.agents/skills/concepts/SKILL.md`, `typescript-server/SKILL.md`, `typescript-client/SKILL.md` (official SpacetimeDB 2.x skills) [HIGH]
- https://spacetimedb.com/docs/functions/views/ : no `.iter()` in views, read sets, PK semantics, per-user cost [HIGH]
- https://spacetimedb.com/docs/tables/access-permissions/ : private by default, views read private tables, views as access control [HIGH]
- https://spacetimedb.com/docs/functions/procedures/ : `ctx.http.fetch`, `withTx`, timeouts, client-callable [HIGH]
- https://spacetimedb.com/docs/tables/schedule-tables/ : `onSchedule`, `ScheduleAt.time/interval`, scheduled procedures delete the row first [HIGH]
- https://spacetimedb.com/docs/functions/reducers/reducer-context/ : `senderAuth`; scheduled reducers private by default in 2.x [HIGH]
- https://spacetimedb.com/docs/clients/typescript/ : `withConfirmedReads`, `SenderError` rejection, disconnected-call behavior [HIGH]
- `spacetimedb@2.14.1` npm source (inspected locally): `ViewCtx = {sender, db, env, from}` (no timestamp/connectionId); `ReducerCtx.senderAuth.isInternal`, `databaseIdentity`; `ProcedureCtx` lacks `senderAuth`; client SDK uses `URL.searchParams`, `TextDecoder`, `DecompressionStream` for gzip; `Range()` defaults to unbounded [HIGH for types; MEDIUM for runtime behavior]
- `@spacetimedb/crypto@0.1.0` README: `sha256`, `hmacSha256`, `timingSafeEqual`, hex/base64; no Ed25519 [HIGH]
- `spacetime publish --help` / `generate --help` / `dev --help` (CLI 2.12.0): env support, `--module-bindings-path`, auto-publish in dev [HIGH]
- https://docs.expo.dev/versions/latest/sdk/expo/ : built-in URL/URLSearchParams, UTF-8 TextDecoder on native [MEDIUM]
- https://docs.expo.dev/versions/latest/sdk/notifications : no remote push in Expo Go on Android since SDK 53 [HIGH]
- Expo push API batch limit / access token: training data [LOW-MEDIUM; verify in P3]
- `@noble/curves` / `@noble/hashes` in the Spacetime V8 runtime: inference from "TS modules can use npm packages" [MEDIUM; spike in P0]

---
*Architecture research for: out-of-band cyber incident response on SpacetimeDB 2.x + Expo*
*Researched: 2026-11-07*
