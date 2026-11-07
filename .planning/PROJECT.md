# Red Phone

## What This Is

Red Phone is a sealed, out-of-band emergency channel for cyber incident response, built for the Winstead PC challenge at HackUTD 2026. It runs on responders' personal phones over cellular data and is hosted on SpacetimeDB (Spacetime) Maincloud, so it keeps working even when an attacker controls every internal company system. During an attack it gives each responder a secure group-text-style space to coordinate and a pushed, role-specific checklist of what to do next.

## Core Value

When an attack is confirmed, every enrolled responder gets an alert on their personal phone and immediately sees the next pre-approved task for their role, with no dependency on any company system.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Enrollment & access control**
- [ ] One-time setup code bootstraps the first two Admins
- [ ] Promoting to Admin requires approval from two Admins
- [ ] Invites flow strictly downward by authority level (Admins invite Leads/Members; Leads invite Members/Guests; Counsel invites Guests)
- [ ] Inviter creates an in-person QR invite (role + display name), random 256-bit secret, server stores only the hash, 10-minute expiry, single use
- [ ] Redeeming an invite generates a device keypair on the phone (private key never leaves it), sets a personal PIN (and optional duress PIN), and atomically creates the account (name, role, public key, inviter)
- [ ] Admin can revoke a member and the member's whole invite branch
- [ ] Admin lockdown switch freezes all non-Admin actions

**Unlock & session security**
- [ ] Unlock with biometrics + PIN, both checked on-device
- [ ] Phone signs a one-time server challenge with its device key; sensitive reducers require a fresh signed challenge
- [ ] Key fingerprint (short hash of public key) shown for in-person comparison

**Incident response**
- [ ] Any member raises "Possible attack"; it becomes a full alert when one Lead confirms or two members report independently
- [ ] Content-free push notification ("Red Phone: open app") to all enrolled members on full alert
- [ ] Check-in: "I'm here" / "Unavailable" / "My work device may be affected"; Lead sees presence
- [ ] Lead picks attack type (Ransomware, Account takeover / phishing, Data theft, Wire fraud, Unknown), which loads the matching playbook
- [ ] Playbook steps are assigned automatically to whoever holds each role; members accept and complete tasks; dependent tasks stay locked until prerequisites finish
- [ ] Ransomware playbook seeded with role tasks (IT, Incident Lead, Counsel, Comms, Executive)
- [ ] Status board tracks each data system: Unknown, Locked, Stolen, Contained, Restored, Safe; status taps can trigger playbook steps
- [ ] Group chat (all) and counsel-only channel, invisible to other roles, synced live
- [ ] Incident lifecycle: Contained → Recovered → Closed

**Documentation & traceability**
- [ ] Every reducer appends to a hash-chained audit log (sequence, actor, action, data_hash, prev_hash, hash); chain verification surfaces any edit or deletion
- [ ] Invite lineage recorded for every account
- [ ] Row-level visibility per the schema in plan.md (e.g. invites visible to inviter + Admins, challenges to their member only, audit log to Admins)

**Stretch**
- [ ] Task escalation: scheduled reducer reassigns unaccepted tasks to the role's backup and alerts the Lead
- [ ] Legal deadline clocks (Texas AG 30d, Texas individuals 60d, SEC 8-K 4 business days, GDPR 72h, CIRCIA 72h/24h), labeled "possible obligation, confirm with counsel", linked to the triggering timeline event
- [ ] Duress PIN opens a decoy screen and silently alerts Admins
- [ ] Exportable incident report (timeline + audit chain)
- [ ] Additional playbooks (account takeover, wire fraud)
- [ ] Guest accounts auto-expire

### Out of Scope

- Push-to-talk voice — listed in the challenge mapping but not in the must-haves; voice infrastructure is too heavy for the weekend
- AI decision-making of any kind — all decisions stay with people; playbooks are pre-written and pre-approved
- Company email, SSO, MDM, Wi-Fi, or any company system for enrollment or delivery — defeats the out-of-band threat model
- Company-managed phones — attacker may control device management
- Admin UI for authoring playbooks — playbooks are seeded in advance for the demo
- Self-hosted SpacetimeDB deployment — Maincloud only

## Context

- **Event:** HackUTD 2026, Winstead PC challenge. Required components: secure & isolated, access control, incident documentation, scope definitions, real-time communications. Judged on security, ease of use, creativity.
- **Demo:** 3-minute ransomware tabletop. Judges enroll by scanning a QR code, receive the alert on their own phones, get role tasks, and watch the status board and clocks update live.
- **Full spec:** `plan.md` at the repo root (roles, schema, reducers, flows, legal clocks).
- **Platform:** Spacetime is the whole backend: tables, reducers, subscriptions, views, procedures (outbound HTTP, e.g. Expo push API), scheduled reducers. Local CLI is 2.12.0; skills and docs describe 2.x.
- **UX:** must feel like a group text with big buttons; the app pushes each person's next step like a pilot's emergency checklist.
- **Threat model:** attacker controls all internal systems; a stolen session token alone must be useless; one stolen phone must not cause a full alert.

## Constraints

- **Timeline**: Demo-ready by Sunday 2026-11-08 — hackathon deadline
- **Tech stack**: Expo (React Native) client, SpacetimeDB TypeScript module, Maincloud hosting (HACKUTD2026 credit) — chosen stack from plan.md; TypeScript on both sides for shared types
- **Security**: SpacetimeDB 2.11+ (identity-impersonation fix); scheduled reducers reject any caller except the module; push payloads carry no incident details
- **Secrets**: Spacetime token lives only in a gitignored `.env`; never committed or copied into agent config
- **Devices**: Personal iOS/Android phones running Expo; `expo-secure-store` for keys, `expo-local-authentication` for biometrics, Expo push for notifications

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript for the Spacetime module | Same language as Expo client, shared types, one toolchain | — Pending |
| Coarse GSD granularity | Weekend deadline; fewer, broader phases | — Pending |
| Device key = Ed25519 keypair generated on-device, private key in `expo-secure-store` (Keychain/Keystore-backed) | Expo has no direct Secure Enclave signing API; secure-store is hardware-backed storage and works in Expo Go/dev builds | — Pending |
| Push sent from a Spacetime procedure calling the Expo push API | Keeps everything inside Spacetime; no separate server to compromise | — Pending |
| Ransomware is the only must-have playbook | Matches the demo; other playbooks are stretch | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-11-07 after initialization*
