# Roadmap: Red Phone

## Overview

Red Phone goes from an empty repo to a 3-minute ransomware tabletop on judges' own phones in five dependency-ordered phases. Phase 1 proves the risky on-device assumptions on a real phone (Expo Go to Maincloud, noble Ed25519 inside the module) before anything else is built. Phase 2 lays the trust core every later reducer depends on: hash-chained audit, `guard()`, in-person QR enrollment, and signed device sessions. Phase 3 delivers the core value moment: alert confirmed, every phone alarms, people check in and talk. Phase 4 turns the alert into action with the seeded ransomware playbook, role tasks, and the live status board. Phase 5 adds the evidence UI, demo reset, stretch features in priority order, and hardens everything for the live demo on Sunday 2026-11-08.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Real-Phone Spike** - Pinned monorepo, dev + demo databases on Maincloud, and a physical phone proving live sync and on-device Ed25519 signatures verified by the module
- [ ] **Phase 2: Trust Core** - Hash-chained audit, private tables with per-caller views, setup-code Admin bootstrap, in-person QR enrollment, PIN/biometric unlock, signed sessions, revoke and lockdown
- [ ] **Phase 3: Alert, Push & Comms** - Two-person alert confirmation, full-screen alarm plus content-free push, check-in presence, incident lifecycle, drills, group chat and counsel-only channel
- [ ] **Phase 4: Playbook, Tasks & Status Board** - Attack type loads the seeded ransomware playbook, role tasks auto-assigned with dependency locks and fallback, live status board that fires playbook steps
- [ ] **Phase 5: Evidence UI, Stretch & Demo Hardening** - Audit timeline with on-device chain verification, demo reset, judge enrollment, stretch features in priority order, full tabletop rehearsal on real phones

## Phase Details

### Phase 1: Foundation & Real-Phone Spike
**Goal**: The toolchain is pinned and a physical phone running Expo Go talks live to a published Spacetime module on Maincloud, including verifying an on-device Ed25519 signature on the server
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03, FND-04, FND-05, FND-06
**Success Criteria** (what must be TRUE):
  1. Developer runs build and tests for `server/`, `shared/`, and `app/` from the monorepo root, all pinned to SpacetimeDB 2.14.1, and `npm run gen` regenerates client bindings after a schema change
  2. The module is published to two separate Maincloud databases (dev and demo) using the Spacetime token read from the gitignored `.env`, and the token appears in no committed file
  3. A physical phone in Expo Go connects to Maincloud with compression off, shows more than 100 live rows from a per-sender view, and resumes live updates after the app is backgrounded and foregrounded
  4. The app shows a "Live" / "Reconnecting" indicator that flips correctly when the connection drops and returns
  5. A signature made on the phone verifies inside the published module against the shared test vector (and in vitest)
**Plans:** 5 plans

Plans:
- [ ] 01-01-PLAN.md — Pinned npm-workspaces monorepo + trimmed Expo SDK 58 app, single lockfile (wave 1)
- [ ] 01-02-PLAN.md — Shared Ed25519 contract/test vector + spike module (rows, per-sender view, verify) + bindings, TDD (wave 2)
- [ ] 01-03-PLAN.md — Isolated-config publish to Maincloud dev + demo with token checkpoint (wave 3)
- [ ] 01-04-PLAN.md — Expo Go client: live rows, Live/Reconnecting badge, sign & verify (wave 3)
- [ ] 01-05-PLAN.md — Full gate + physical-phone verification + hygiene sweep (wave 4)
**UI hint**: yes

**Notes for planning:**
- Deploying to Maincloud requires the user's Spacetime token. The orchestrator will request it and store it in a gitignored `.env`. Plans must read it from `.env` only and must never hardcode, log, commit, or copy it into agent config.
- Node must be invoked from `/opt/homebrew/opt/node@24/bin` (prefix `PATH` in every command). The system Node is 24.18, which is below the `spacetimedb@2.14.1` engines floor (>= 24.22.1).
- Research spike items worth proving here (not separate requirements): one scheduled procedure reaching `exp.host`, `eas init` for an EAS `projectId`, Spacetime token persisted in SecureStore, `polyfills.ts` imported first.

### Phase 2: Trust Core
**Goal**: Only people enrolled in person, holding their own device key, can see or change anything, and every change lands in a tamper-evident audit chain
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: AUD-01, AUD-02, AUD-04, AUD-05, ENR-01, ENR-02, ENR-03, ENR-04, ENR-05, ENR-06, ENR-07, ENR-08, ENR-09, UNL-01, UNL-02, UNL-03, UNL-04
**Success Criteria** (what must be TRUE):
  1. Two Admins bootstrap with the one-time setup code; a third attempt with the same code fails and is recorded as a security event
  2. An Admin shows a QR invite for a role and name; a new member scans it in person, sets a PIN, and lands in the app with that role; a second scan, an expired invite, or an upward invite (e.g. Lead inviting an Admin) is rejected
  3. A member reopens the app, unlocks with PIN plus biometrics (or device passcode), and the phone silently signs a server challenge to get a session, again after every reconnect; a client with only a Spacetime token, or an anonymous client, sees zero rows and cannot write
  4. Promoting, demoting, or revoking an Admin needs approval from two distinct Admins other than the target; revoking a member removes their whole invite branch and ends their sessions; lockdown freezes all non-Admin actions until lifted
  5. Every state-changing action, including failed security checks, appears as a hash-chained audit entry, and each member's key fingerprint is visible for in-person comparison
**Plans**: TBD
**UI hint**: yes

### Phase 3: Alert, Push & Comms
**Goal**: When an attack is confirmed by two people, every enrolled phone alarms and responders can check in and coordinate in a group-text-style chat
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: ALR-01, ALR-02, ALR-03, ALR-04, ALR-05, ALR-06, ALR-07, ALR-08, COM-01, COM-02, COM-03
**Success Criteria** (what must be TRUE):
  1. A member taps "Possible attack" and Leads are notified; it becomes a full alert only when a different Lead confirms or a second distinct member reports within the window (one phone alone cannot cause a full alert)
  2. On full alert every enrolled member's open app shows a full-screen alarm with haptics, and every registered device receives a content-free "Red Phone / Open app" push sent by a procedure clients cannot call
  3. Members check in as "I'm here", "Unavailable", or "My work device may be affected", and the Lead sees everyone's presence update live
  4. Members chat in the incident group chat live without duplicates after reconnect; Counsel and the Incident Lead use a privilege-labeled counsel-only channel that no other role can see
  5. A Lead can dismiss a false alarm (logged, with stand-down) or advance the incident Active, Contained, Recovered, Closed; drill incidents show a DRILL banner on every screen
**Plans**: TBD
**UI hint**: yes

### Phase 4: Playbook, Tasks & Status Board
**Goal**: Each responder immediately sees their next pre-approved step for their role, and the team tracks every data system's status live
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: PLY-01, PLY-02, PLY-03, PLY-04, PLY-05, BRD-01, BRD-02, BRD-03
**Success Criteria** (what must be TRUE):
  1. The Lead picks "Ransomware" and IT, Incident Lead, Counsel, Comms, and Executive holders each get their role tasks automatically
  2. Each member sees a big "Your next step" card plus a task list, can accept and complete tasks, and sees dependent tasks greyed out until their prerequisites are done
  3. When a role has no active holder, or the holder checks in "Unavailable", that role's tasks move to the backup, then to the Lead
  4. Members see a live board of seeded data systems (with personal-data and region flags); an authorized member changes a system to "Locked" and the matching ransomware steps appear for the right roles
**Plans**: TBD
**UI hint**: yes

### Phase 5: Evidence UI, Stretch & Demo Hardening
**Goal**: The team can prove the record is untampered, reset and rerun the demo, and judges run the full ransomware tabletop on their own phones
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: AUD-03, DMO-01, DMO-02, DMO-03, STR-01, STR-02, STR-03, STR-04, STR-05
**Success Criteria** (what must be TRUE):
  1. An Admin opens the audit timeline, taps "Verify chain", and sees a green badge; after a deliberate edit to an entry the badge turns red
  2. An Admin resets incidents, tasks, messages, and the board without un-enrolling anyone, and judges enroll by scanning pre-staged role-tagged QRs in Expo Go on their own phones
  3. The full 3-minute ransomware tabletop runs end to end on real phones (alert, alarm, tasks, board, chat) on the demo database
  4. Stretch, built in this order as time allows: legal deadline clocks labeled "possible obligation, confirm with counsel" and linked to the triggering event; unaccepted tasks escalate to the backup with the Lead alerted; incident report export via share sheet; duress PIN opens a decoy screen and silently alerts Admins; "Call bridge" dials a configured number
**Plans**: TBD
**UI hint**: yes

**Notes for planning:**
- Must-haves (AUD-03, DMO-01..03) come before any stretch item. Stretch requirements (STR-01..05) are best-effort and may be cut without failing the phase; cut them in reverse order.
- Hardening: security re-audit (reducer x role x checks, anonymous-client test), demo schema freeze and dry-run publish to the demo database, regenerate bindings, rehearsal on cellular and venue Wi-Fi.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Real-Phone Spike | 0/5 | Not started | - |
| 2. Trust Core | 0/TBD | Not started | - |
| 3. Alert, Push & Comms | 0/TBD | Not started | - |
| 4. Playbook, Tasks & Status Board | 0/TBD | Not started | - |
| 5. Evidence UI, Stretch & Demo Hardening | 0/TBD | Not started | - |
