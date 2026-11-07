# Requirements: Red Phone

**Defined:** 2026-11-07
**Core Value:** When an attack is confirmed, every enrolled responder gets an alert on their personal phone and immediately sees the next pre-approved task for their role, with no dependency on any company system.

## v1 Requirements

Requirements for the HackUTD 2026 demo (Sunday 2026-11-08). Each maps to a roadmap phase.

### Foundation

- [ ] **FND-01**: Developer can build and test the module, shared package, and app from one monorepo (`server/`, `shared/`, `app/`) pinned to SpacetimeDB 2.14.1 and Node >= 24.22.1
- [ ] **FND-02**: Developer can regenerate client bindings with one command (`npm run gen`) after any schema change
- [ ] **FND-03**: Module publishes to a dev database and a separate demo database on Maincloud, using the Spacetime token from a gitignored `.env`
- [ ] **FND-04**: App running in Expo Go on a physical phone connects to Maincloud (compression off), receives live view rows, and reconnects after background/foreground
- [ ] **FND-05**: App shows a "Live" / "Reconnecting" connection indicator
- [ ] **FND-06**: An Ed25519 signature made on the phone verifies inside the published module (shared test vector)

### Trust & Audit

- [ ] **AUD-01**: Every state-changing reducer appends an audit entry (seq, actor, action, data_hash, prev_hash, hash) in the same transaction
- [ ] **AUD-02**: Failed security checks (bad signature, bad/expired/used invite, unauthorized role) are recorded as security events without rolling back the record
- [ ] **AUD-03**: Admin can view the audit timeline and tap "Verify chain" to see a green/red integrity badge computed on the device
- [ ] **AUD-04**: Every member's key fingerprint (short hash of public key) is visible for in-person comparison
- [ ] **AUD-05**: An anonymous client connected to the database sees zero rows from every table (all tables private; reads only via per-caller views)

### Enrollment & Access

- [ ] **ENR-01**: First two Admins can be created with a one-time setup code (only its hash stored server-side); the bootstrap path is disabled after two Admins exist
- [ ] **ENR-02**: Inviter can create an invite for a role and display name and show it as a QR code; the 256-bit secret is generated on the inviter's phone and only its hash reaches the server
- [ ] **ENR-03**: Invites expire after 10 minutes and can be redeemed exactly once; a second scan fails
- [ ] **ENR-04**: Invites only flow downward (Admins → Leads/Members; Leads → Members/Guests; Counsel → Guests); nobody can invite at or above their own level
- [ ] **ENR-05**: New member redeems an invite by scanning it in person; the phone generates its device keypair, the member sets a PIN, and the account (name, role from invite, public key, inviter) is created atomically
- [ ] **ENR-06**: Promoting a member to Admin requires approval from two distinct Admins, neither of whom is the target
- [ ] **ENR-07**: Revoking or demoting an Admin requires approval from two distinct Admins
- [ ] **ENR-08**: Admin can revoke a member and that member's entire invite branch in one action; revoked members lose sessions immediately
- [ ] **ENR-09**: Admin can trigger lockdown, which freezes all non-Admin actions and ends all non-Admin sessions until lifted

### Unlock & Sessions

- [ ] **UNL-01**: Member unlocks the app with their PIN plus biometrics (or device passcode where biometrics are unavailable); the PIN never leaves the phone
- [ ] **UNL-02**: After unlock, the phone signs a one-time server challenge with its device key, creating a short-lived session bound to the current connection; it re-signs automatically on reconnect
- [ ] **UNL-03**: A client holding only a Spacetime token (no device key signature) cannot perform any write and sees no member data
- [ ] **UNL-04**: High-risk actions (confirm alert, set attack type, revoke, approve admin, lockdown, close incident, create invite) require a fresh signed session

### Alert & Check-in

- [ ] **ALR-01**: Any member can tap "Possible attack" to raise a possible incident; Leads are notified
- [ ] **ALR-02**: A possible incident becomes a full alert when a Lead other than the raiser confirms it, or when a second distinct member reports within the time window
- [ ] **ALR-03**: On full alert every enrolled member's open app shows a full-screen alarm with haptics
- [ ] **ALR-04**: On full alert a content-free push ("Red Phone" / "Open app") is sent to every registered device via the Expo push API from a module procedure that clients cannot invoke
- [ ] **ALR-05**: Lead can dismiss a possible or active incident as a false alarm, which is logged and sends a stand-down
- [ ] **ALR-06**: Member can check in as "I'm here", "Unavailable", or "My work device may be affected"; Lead sees everyone's presence live
- [ ] **ALR-07**: Incidents can be marked as drills; drill incidents show a DRILL banner everywhere
- [ ] **ALR-08**: Lead can advance the incident Active → Contained → Recovered → Closed

### Playbook & Tasks

- [ ] **PLY-01**: Lead picks the attack type (Ransomware, Account takeover / phishing, Data theft, Wire fraud, Unknown), which loads the matching playbook
- [ ] **PLY-02**: A seeded ransomware playbook assigns role tasks (IT, Incident Lead, Counsel, Comms, Executive) automatically to the active holder of each role
- [ ] **PLY-03**: Member sees a single big "Your next step" card and a task list; they can accept a task and mark it done
- [ ] **PLY-04**: Dependent tasks stay locked (greyed) until their prerequisites are done
- [ ] **PLY-05**: When a role has no active holder, or the holder checks in "Unavailable", the task goes to the role's backup, then to the Lead

### Status Board

- [ ] **BRD-01**: Members see a status board of data systems, each Unknown / Locked / Stolen / Contained / Restored / Safe, updated live
- [ ] **BRD-02**: Authorized members can change a system's status; status changes can trigger matching playbook steps (e.g. "Locked" → ransomware IT tasks)
- [ ] **BRD-03**: Systems are seeded with flags for whether they hold personal data and which states/regions

### Communications

- [ ] **COM-01**: Members can send and receive messages in an incident group chat, synced live
- [ ] **COM-02**: Counsel and the Incident Lead can use a counsel-only channel with a privilege label; it is invisible to every other role, enforced on the server
- [ ] **COM-03**: Duplicate sends after reconnect do not create duplicate messages

### Demo Readiness

- [ ] **DMO-01**: Admin can reset the demo database state (incidents, tasks, messages, board) without un-enrolling members
- [ ] **DMO-02**: Judges can enroll by scanning pre-staged role-tagged invite QRs and run the app in Expo Go on their own phones
- [ ] **DMO-03**: A full 3-minute ransomware tabletop runs end to end on real phones

### Stretch

- [ ] **STR-01**: Legal deadline clocks start from reported facts (Texas AG 30d and Texas individuals 60d from "determines that the breach occurred", GDPR 72h, SEC 8-K 4 business days for public companies), shown to Counsel and Lead, labeled "possible obligation, confirm with counsel", linked to the triggering timeline event
- [ ] **STR-02**: Tasks not accepted within the escalation window are reassigned to the backup and the Lead is alerted (scheduled reducer callable only by the module)
- [ ] **STR-03**: Lead or Admin can export an incident report (timeline + audit chain head hash) via the share sheet
- [ ] **STR-04**: Entering the duress PIN opens a decoy "No active incidents" screen and silently alerts Admins
- [ ] **STR-05**: "Call bridge" button opens a pre-configured conference number via `tel:`

## v2 Requirements

Deferred. Tracked but not in the current roadmap.

- **V2-01**: Additional playbooks (account takeover, wire fraud, data theft)
- **V2-02**: Guest accounts auto-expire
- **V2-03**: Decision log for executive calls
- **V2-04**: Invite-lineage tree view
- **V2-05**: Wi-Fi warning banner (cellular-only nudge)
- **V2-06**: CIRCIA clock (once the final rule takes effect)
- **V2-07**: Development builds with true Face ID and Android remote push

## Out of Scope

| Feature | Reason |
|---------|--------|
| Push-to-talk voice | Too heavy for the weekend; replaced by call-bridge `tel:` link |
| AI triage / decision-making | All decisions stay with people; playbooks are pre-approved |
| End-to-end encryption claim | Maincloud stores plaintext; claim TLS + server-enforced visibility + tamper evidence instead |
| Company email / SSO / SMS enrollment or recovery | Defeats the out-of-band threat model |
| Company-managed phones | Attacker may control device management |
| Playbook authoring UI | Playbooks seeded in advance |
| Remote wipe, attachments, SIEM/Slack integrations, disappearing messages | Not needed for the demo; add risk |
| Self-hosted SpacetimeDB | Maincloud only |
| Secure Enclave non-exportable signing | No Expo API; key lives in Keychain/Keystore-backed secure-store |

## Traceability

Filled by roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|

**Coverage:**
- v1 requirements: 51 total
- Mapped to phases: 0
- Unmapped: 51 ⚠️

---
*Requirements defined: 2026-11-07*
*Last updated: 2026-11-07 after initialization*
