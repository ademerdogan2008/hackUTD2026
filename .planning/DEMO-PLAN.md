# Red Phone — Demo Build Contract

**Decided 2026-11-07:** Phases 2–5 collapse into one lean demo build. Goal: the 3-minute ransomware tabletop runs on phones (Expo Go) and in a browser (Expo web). Skip anything the demo doesn't show. Supersedes the detailed Phase 2–5 plans; ROADMAP phases remain as reference only.

## Demo script (what must work)
1. Admin (pre-bootstrapped) shows an invite QR for a role; a judge scans/pastes it, enters a name, sets a 6-digit PIN → lands in the app with that role and a key fingerprint.
2. Anyone taps **Possible attack** → incident `possible`. A Lead/Admin who is not the raiser taps **Confirm** (or a 2nd distinct member also reports) → `active`; every open app shows a full-screen red alarm with haptics.
3. Members check in (I'm here / Unavailable / My work device may be affected); Lead sees presence.
4. Lead picks **Ransomware** → tasks auto-assigned by role; each member sees a big **Your next step** card; accept → done; dependent tasks unlock.
5. Status board: setting a system to **Locked**/**Stolen** updates live; **Stolen** on a system with PII starts legal clocks (Texas AG 30d, Texas individuals 60d, GDPR 72h if EU) labeled "possible obligation — confirm with counsel".
6. Group chat (All) + **Counsel** channel visible only to counsel/lead/admin.
7. Audit timeline with **Verify chain** badge (green; client recomputes the hash chain).
8. Lead advances Active → Contained → Recovered → Closed; Admin **Reset demo** clears incident data (keeps members).

## Out (for the demo)
Two-admin approval, revoke branches, lockdown, challenge/session signatures, PIN-encrypted key vault, push notifications, escalation timers, duress PIN, report export, extra playbooks, setup-code env var. Spike tables/screen are removed.

## Shared (`shared/src/`) — owner: server agent
- `roles.ts`: `Role = 'admin'|'lead'|'it'|'counsel'|'comms'|'executive'|'finance'|'hr'|'guest'|'observer'`; `ROLE_LABEL`; `canInvite(inviter, target)`: admin → any except admin; lead → it/counsel/comms/executive/finance/hr/guest/observer; counsel → guest; else none.
- `crypto.ts`: `sha256Hex(str)`, `fingerprint(pubkeyHex)` = first 16 hex of sha256(pubkey bytes) as `ABCD EF01 2345 6789`; `joinMessage(secretHashHex, identityHex)` = `redphone/v1|join|<secretHashHex>|<identityHex>`; `signJoin(sk, ...)`, `verifyJoin(pubkeyHex, msg, sigHex)` (Ed25519 via @noble/curves).
- `audit.ts`: `auditHash({seq, atMicros, actorHex, action, dataHash, prevHash})` = sha256 of `redphone/v1|audit|seq|atMicros|actorHex|action|dataHash|prevHash`; `GENESIS = '0'.repeat(64)`; `verifyChain(rows)` → `{ ok, brokenAt? }`.
- Re-export all from `shared/src/index.ts`. Keep existing spike exports only if still referenced; otherwise remove.

## Server module (`server/src/`) — owner: server agent
Tables (public unless noted; demo-grade visibility):
- `member` { identity: Identity PK, name, role, pubkeyHex, fingerprint, invitedBy: string ('' for bootstrap), joinedAt: Timestamp }
- `invite` { id u64 PK autoInc, secretHash string unique, role, name, createdBy Identity, expiresAt Timestamp, used bool }
- `incident` { id u64 PK autoInc, status: 'possible'|'active'|'contained'|'recovered'|'closed'|'false_alarm', attackType string ('' until picked), isDrill bool, raisedBy Identity, confirmedBy string, createdAt, updatedAt }
- `alert_report` { id PK autoInc, incidentId u64 btree, reporter Identity, at }
- `checkin` { id PK autoInc, incidentId u64 btree, member Identity, state: 'here'|'unavailable'|'device_affected', at }
- `playbook_step` { id PK autoInc, attackType, order u32, role, title, detail, dependsOn u64 (0 = none) }
- `task` { id PK autoInc, incidentId u64 btree, stepId u64, role, assignedTo string (identity hex or ''), assignedName string, status: 'locked'|'open'|'accepted'|'done', title, detail, updatedAt }
- `asset` { id PK autoInc, name, hasPii bool, regions string (e.g. 'TX,EU'), status: 'unknown'|'locked'|'stolen'|'contained'|'restored'|'safe', setBy string, updatedAt }
- `clock` { id PK autoInc, incidentId u64, name, startedAt, deadlineAt, note, status: 'running'|'filed' }
- `message` (PRIVATE) { id PK autoInc, incidentId u64, channel: 'all'|'counsel' btree, author Identity, authorName, body, at } → public views `all_messages` (any member: `message.channel.filter('all')`) and `counsel_messages` (only if caller role ∈ counsel/lead/admin, else []).
- `audit_log` { seq u64 PK, at, actor Identity, action, dataHash, prevHash, hash } + private `audit_head` singleton { id u32 PK = 0, seq u64, hash }.

Reducers (every state change calls `appendAudit(ctx, action, fields)`; failures `throw new SenderError(msg)` — demo-grade, no failure audit needed):
- `bootstrap_admin(name, pubkeyHex)` — only when `member` is empty; creates admin; calls `ensureSeed`.
- `create_invite(role, name, secretHash)` — caller member, `canInvite`; expires now+10 min.
- `redeem_invite(secretHex, pubkeyHex, sigHex)` — sha256(secretHex) lookup by `secretHash`, not used, not expired, caller not already member, `verifyJoin`; marks used; inserts member (role/name from invite, invitedBy = creator hex).
- `raise_alert(isDrill: bool)` — if an incident in `possible`/`active`/`contained`/`recovered` exists: add `alert_report` from caller if new; if `possible` and ≥2 distinct reporters → `active`. Else create `possible` incident + report.
- `confirm_alert()` — lead/admin, not the raiser (`.isEqual()`), possible → active.
- `dismiss_alert()` — lead/admin → `false_alarm`.
- `advance_incident(status)` — lead/admin; active→contained→recovered→closed.
- `check_in(state)` — upsert caller's checkin for current incident.
- `set_attack_type(attackType)` — lead/admin; current incident active; sets type; for each `playbook_step` of that type create `task` assigned to first member with that role (fallback: caller); status `open` if dependsOn=0 else `locked`.
- `accept_task(taskId)` / `complete_task(taskId)` — assignee or lead/admin; on done, unlock tasks whose step depends on it.
- `set_asset_status(assetId, status)` — any member; if `stolen` and `hasPii` and incident active: create clocks (Texas AG 30d, Texas individuals 60d if regions include TX; GDPR 72h if EU) unless already created.
- `mark_clock_filed(clockId)` — counsel/lead/admin.
- `send_message(channel, body)` — counsel channel only for counsel/lead/admin; body ≤ 1000 chars.
- `reset_demo()` — admin; deletes incident/alert_report/checkin/task/clock/message rows, resets assets to 'unknown'; audit log keeps going (append `demo.reset`).
- `init` + `ensureSeed` (idempotent): ransomware playbook (from plan.md §4 example: IT ×3, Lead ×2, Counsel ×2, Comms ×2, Executive ×1, with a couple of `dependsOn` links) and assets: Client File Server (PII, TX), Email (PII, TX), Billing DB (PII, TX,EU), Document Mgmt, Backups.
- Remove spike tables/reducers/views.

Tests: vitest for shared (canInvite, fingerprint, join sign/verify, audit chain) and a few server reducer tests (redeem happy/expired/used, confirm-not-raiser, set_attack_type assigns, clocks start). Then `npm run gen`, `npm run typecheck`, `npm run publish:dev` (dev uses `--delete-data=on-conflict`).

## App (`app/src/`) — owners: UI agent, then two screen agents
- UI kit per `.planning/phases/02-trust-core/02-UI-SPEC.md` in `app/src/ui/` (theme.ts tokens, Button, Card, Badge, ListRow, PinPad, QRPanel, Countdown, Banner, Screen, EmptyState).
- `app/src/device/`: `deviceKey.ts` (Ed25519 sk via expo-crypto, stored in SecureStore key `rp.device_sk`, try/catch → in-memory fallback on web), `pin.ts` (PBKDF2 10k iterations via @noble/hashes, salt+hash in SecureStore `rp.pin`; web fallback localStorage), `useUnlock` context (locked until PIN entered; auto-lock after 60 s in background).
- Routes (Expo Router, `app/src/app/`): `index` redirects by state → `join` (scan QR with expo-camera on native; paste-code field everywhere; first-run "Set up as first admin" when no members) → `pin` (set PIN) → `unlock` → `(tabs)`: `home` (incident hero / big Possible attack button / alarm overlay / lead controls / check-in), `tasks` (Your next step card + list), `board` (assets grid + clocks), `chat` (All | Counsel segmented), `team` (roster with fingerprints, Invite button → `invite` screen with QR + 10-min countdown, Audit timeline → `audit` with Verify chain badge, Admin: Reset demo, Drill toggle).
- QR payload: `redphone:<secretHex>`; inviter phone generates 32 random bytes, sends `sha256Hex(secretHex)`.
- Packages (UI agent installs, the only one touching package.json/lockfile): `npx expo install expo-camera expo-haptics react-native-svg react-native-qrcode-svg` (+ `@noble/hashes` already present).

## Rules for all agents
- PATH prefix `/opt/homebrew/opt/node@24/bin:$HOME/.local/bin`. Commit per task with trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; stage explicit paths only; retry on `.git/index.lock`; never push (orchestrator pushes).
- Never touch `~/.config/spacetime/cli.toml`; never print `.env`. Authenticated spacetime only via `scripts/rp-spacetime.sh` / `scripts/publish.sh`.
- Demo DB `red-phone-6h786`: only the orchestrator publishes there.
