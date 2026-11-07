# Feature Research

**Domain:** Out-of-band (OOB) cyber incident response / crisis communication app (mobile, personal phones), built as a weekend hackathon demo
**Researched:** 2026-11-07
**Confidence:** MEDIUM overall. Legal deadlines: HIGH for Texas (statute text checked), MEDIUM-HIGH for GDPR/SEC/CIRCIA/NYDFS. Competitor features: MEDIUM-LOW (mostly vendor marketing).

---

## 0. Context That Shapes Every Feature Decision

- **The sponsor is Winstead PC, a Texas business law firm.** The judges will likely include lawyers. Legal-evidence features (privilege handling, tamper-evident timeline, deadline clocks, exportable record) are worth more here than at a generic security hackathon. Make them visible in the demo.
- **Judging is security, ease of use, and creativity.** Each demo beat should show one of these. Features that judges cannot see in 3 minutes earn credit only when you describe them in the pitch.
- **Real OOB products share one feature set.** ShadowHQ, CYGNVS, Mattermost OOB, and BreachRx all offer: a separate secure workspace, multi-channel alerting, call trees and escalation, playbooks with task assignment, audit-ready documentation, and tabletop or exercise support. Red Phone's plan already covers most of this. The gaps below are small and cheap.
- **What firms really use today is Signal or WhatsApp groups.** These have no roles, no audit trail, no task tracking, and no control over who gets added. Pitch against that baseline: "Signal, but with a pre-approved plan, roles, and a record a court will accept."

---

## Feature Landscape

### Table Stakes (judges and users expect these; missing = feels broken)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| In-person QR invite enrollment (hashed 256-bit secret, 10-min expiry, single use) | Challenge requirement 02 (access control). Every OOB product's core claim is "not tied to corporate identity". | MEDIUM | Needs an in-app scanner (`expo-camera`). Single use must be atomic: check, mark used, and create the member in one reducer. For the demo, have the inviter pre-generate one QR per judge role. |
| Device key + biometric/PIN unlock | Security judging. A stolen session token must be useless. | MEDIUM | **Face ID is not supported in Expo Go on iOS** (Expo docs). On judges' phones running Expo Go, it falls back to the device passcode or fails. Pitch it as "biometric or device passcode + app PIN". The PIN is checked on-device only. |
| Signed server challenge for sensitive reducers | This turns "device key" from a claim into something real. | MEDIUM-HIGH | Ed25519 signing on the client and verification inside the Spacetime TS module. Both need pure-JS crypto (e.g. `@noble/ed25519`). The stack researcher must confirm the module runtime can run it. Sign only the sensitive actions (confirm alert, set attack type, revoke, lockdown, close incident, duress), not every chat message. |
| Raise alert, then confirm (two-person rule) | Challenge requirement and threat model ("one stolen phone must not cause a full alert"). | LOW-MEDIUM | **Spec gap:** the confirmer must be a different person from the raiser. If a Lead raises an alert, it must still need a second person. Otherwise one stolen Lead phone triggers a full alert, which breaks the stated threat model. Independent reports from two members should only count within a time window (e.g. 30 min). |
| Content-free push to all members | Every mass-notification product does this. The plan's privacy claim depends on it. | MEDIUM | **Expo docs: "A development build is required to use push notifications."** Remote push is unavailable in Expo Go on Android from SDK 53. Judges on Expo Go may not get a real push. Fallback: the live subscription shows a full-screen alarm with haptics while the app is open. Use real push on team phones running a dev build. |
| Check-in / roll call ("I'm here" / "Unavailable" / "Work device may be affected") | Everbridge and AlertMedia ship "are you safe / acknowledge" polls as their core feature. The Lead needs a headcount. | LOW | "Unavailable" should immediately reassign that person's tasks to their backup. Don't wait for the escalation timer (see Dependencies). |
| Role checklist with accept/done and locked dependencies | Core Value. Mattermost Playbooks, ShadowHQ, and CYGNVS all have assignable playbook tasks. | MEDIUM | The "pilot checklist" UX is the main ease-of-use point. Show one big "Your next step" card, not a list. Must handle a role with no holder: assign to the backup, else to the Lead. |
| Status board of data systems (Unknown/Locked/Stolen/Contained/Restored/Safe) | Challenge requirement 04 (scope definitions). | LOW-MEDIUM | Seed 5-6 systems with PII flags. A status tap fires playbook triggers and, if the system holds PII, prompts Counsel about clocks. This chain from board to tasks to clocks is the best demo moment. |
| Group chat + counsel-only channel | Challenge requirement 05. Every competitor has channels. | MEDIUM | Visibility must be enforced on the server (RLS/views), not just hidden in the UI. Demo it by showing that a non-counsel judge's phone cannot see the channel. |
| Visible incident timeline | Challenge requirement 03. The plan's mapping promises "timestamped timeline and exportable report". | LOW | A read-only timeline screen built from the audit log or incident events. Easier than export and needed for the demo story. |
| Hash-chained audit log with a "Verify chain" button | Challenge requirement 03. Tamper evidence is the evidence story lawyers care about. | MEDIUM | Needs SHA-256 in the module runtime (confirm availability, or use `@noble/hashes`). Reducers commit one at a time, so `prev_hash` linking is safe. Verification is a client-side pass over the rows. |
| Revoke member (+ invite branch) and Admin lockdown | Access control. "Kill a stolen phone instantly" is a security demo beat. | LOW-MEDIUM | Revoking a judge's phone live, and watching it lose access, is a strong 10-second security moment. |
| False alarm / stand-down | Every mass-notification tool has "all clear". The plan's lifecycle (Contained, Recovered, Closed) has no way to cancel a mistaken alert. | LOW | **Gap: add it.** A Lead or Admin can mark a possible or full alert "False alarm". This is logged and pushes "Red Phone: stand down". |
| Connection / sync indicator | An OOB tool must show that it is live. Users under stress need to trust what they see. | LOW | Show "Live" or "Reconnecting" from the Spacetime connection state. |

### Differentiators (where Red Phone wins on creativity)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Role-based auto-assigned playbooks triggered by status taps | Competitors have playbooks, but most need a coordinator to assign tasks. Here the firm's own pre-approved plan routes itself to the right phone. | MEDIUM | Already must-have. Keep "the app never decides; it delivers your pre-approved plan" as the line that answers the AI question. |
| Legal deadline clocks started by responder-reported facts | BreachRx sells this as a paid enterprise feature ("200+ regulations"). Doing a small version in a weekend impresses lawyer judges. | MEDIUM | **Recommend promoting a minimal version (2-3 clocks) to must-have for the demo.** It is the most law-firm-specific feature. See §Legal Deadline Verification for the corrected triggers. Each clock starts from a specific fact (e.g. Counsel taps "Breach determined"), not from the alert itself. |
| Two-person rule for alerts and for Admin promotion | Matches nuclear and banking dual-control norms. It explains itself to judges. | LOW (given confirm flow) | Already planned. Say "two-person rule" out loud in the pitch. |
| Key fingerprint for in-person comparison | Borrowed from Signal safety numbers. Cheap and visible. | LOW | Show it on the profile and on the inviter's screen after redeem: "Confirm these match". |
| Invite lineage + branch revoke | Not found in competitor marketing. It answers "what if a bad actor gets in?" | LOW-MEDIUM | Show the lineage tree in the Admin view. |
| Duress PIN (decoy screen + silent Admin alert) | Memorable creativity point. Comes from alarm-system duress codes. | MEDIUM | Keep as stretch. The decoy must look plausible: an empty "No active incidents" screen. The server should also quietly lower that member's visibility. Never wipe data on duress, because it would destroy evidence. |
| Privilege labeling on the counsel channel | Lawyer judges will notice. Every message in the counsel channel is stamped "Privileged & Confidential, Attorney-Client Communication / Prepared at Direction of Counsel". | LOW | Honest caveat for the pitch: a label does not create privilege. Courts look at purpose (e.g. the Capital One forensic report ruling, 2020; MEDIUM confidence from training). That is why the playbook has Counsel engage forensics. |
| Decision log for executive calls | IR tools record decisions and rationale. Ransom, shutdown, and disclosure decisions are what insurers and regulators ask about. | LOW | Implement as a task type "Decision" with options (e.g. "Do not pay pending counsel + insurer + OFAC check"). It writes to the audit chain. |
| Wi-Fi warning banner ("You're on Wi-Fi, switch to cellular") | Makes the OOB threat model visible on screen. Cheap creativity point. | LOW | `expo-network` reports connection type. Show a warning, never a block. |
| Drill / tabletop mode | CYGNVS and ShadowHQ both sell tabletop exercises. It also makes the 3-minute demo safe and repeatable. | LOW | An `incident.is_drill` flag gives a "DRILL" banner on every screen, labels clocks "drill", and adds an Admin "reset demo" reducer. **Recommend must-have**, since the demo literally is a tabletop. |
| Client-witnessed chain head | Hardens tamper evidence against the database operator, not just against app users. Each phone stores the latest chain head hash it has seen. Verification flags any rollback. | LOW-MEDIUM | Good answer to "couldn't the Maincloud owner edit rows?". Stretch. |
| Task escalation to backup | Matches ShadowHQ's "automated call trees". Shows the system survives absent people. | MEDIUM | Scheduled reducer. For the demo, set `escalate_after` to about 45 s so it fires on stage. |
| Exportable incident report (timeline + chain + clocks) | "Give this to your insurer and outside counsel". Lawyers value a deliverable. | LOW-MEDIUM | Minimal version: a Markdown/JSON text document through the share sheet, including the head hash. Skip PDF generation. |
| "Call bridge" button | Cheap stand-in for the push-to-talk the plan promises. Cellular voice is also out-of-band. | LOW | A `tel:` link to a pre-configured conference number, or a member's personal number. Replaces push-to-talk in the challenge mapping. |

### Anti-Features (deliberately do NOT build)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Push-to-talk voice | Listed in plan.md's requirement-05 mapping table | Voice infrastructure is too heavy for a weekend. It is also already out of scope in PROJECT.md, but plan.md still claims it. Claiming an unbuilt feature costs credibility. | Remove it from the mapping and pitch. Use the "Call bridge" `tel:` button plus chat. |
| AI triage / AI recommendations | Trendy. BreachRx markets "agentic AI". | Lawyers will ask who is accountable. It contradicts the plan's "no AI decisions" stance. | Pre-approved playbooks. Say so explicitly. |
| Claiming "end-to-end encrypted" | Sounds secure | Spacetime stores message plaintext server-side, and the Maincloud operator can read it. Security judges will catch an overclaim. | Say: "TLS in transit, server-enforced visibility, isolated from company infrastructure, tamper-evident log." Real E2E (key distribution, group rekeying) is v2+. |
| Email/SMS/SSO enrollment or account recovery | Convenience | Breaks the OOB threat model: the attacker controls email/SSO, and SMS is spoofable. | Lost phone means in-person re-enrollment by a higher authority. |
| Remote wipe on duress | Seems protective | Destroys evidence and can be triggered by coercion. Legal hold conflict. | Decoy screen + silent alert + server-side permission reduction. |
| SIEM / ticketing / Slack integrations | Every enterprise IR tool has them | Bridges the OOB channel back into the compromised environment. A big scope sink. | Manual status taps on the board. |
| File/image attachments | Responders want to share screenshots | Malware vector, storage, chain-of-custody questions. Large scope. | Text only for v1. Evidence lives with forensics. |
| Playbook authoring UI | Needed for real customers | Too much scope for the weekend. Already out of scope. | Seeded playbooks. Mention "authored by firm + counsel in advance". |
| Location tracking / map of responders | Mass-notification products have it | Privacy cost on personal phones. Irrelevant to cyber IR. | Check-in state only. |
| Disappearing messages | Signal habit | Conflicts with litigation hold and the audit story. | Retention by default. Guests auto-expire, records do not. |
| Many legal clocks at once (all 50 states, etc.) | Looks comprehensive | Clutters the UI and raises accuracy risk. Each clock is a legal claim. | 3-4 configurable rules, labeled "possible obligation, confirm with counsel". |
| Ransom negotiation / payment features | Ransomware realism | Sanctions (OFAC) and ethics exposure. | An Executive task: "Do not contact attacker or pay until counsel + insurer review". |

---

## Legal Deadline Verification (as of 2026-11-07)

| Clock in plan.md | Verdict | Correct trigger / deadline | Confidence |
|---|---|---|---|
| Texas AG, "Breach determined, 250+ Texas residents", 30 days | **Correct** | Tex. Bus. & Com. Code §521.053(i): "as soon as practicable and not later than the 30th day after the date on which the person determines that the breach occurred", if 250+ Texas residents are involved. Submitted on the AG's online form. 30 days since SB 768, effective 2023-09-01. No 2025 amendment to §521.053 found. SB 2610 (2025) added a liability safe harbor but did not change deadlines. | HIGH |
| Texas individuals, "Breach discovered", 60 days | **Trigger wording wrong** | §521.053(b): "without unreasonable delay and in each case not later than the 60th day after the date on which the person **determines that the breach occurred**". This is the same trigger as the AG clock, not "discovered". Allowed delays: law-enforcement request (subsec. d), and time needed to determine scope or restore system integrity. The 60 days is an outer limit, not a target. | HIGH |
| (missing) Texas consumer reporting agencies | **Add (optional)** | §521.053(h): if notifying more than 10,000 persons at one time, notify each consumer reporting agency "without unreasonable delay". There is no fixed day count, so show it as a checklist item, not a countdown. | HIGH |
| SEC 8-K Item 1.05, "Materiality determination", 4 business days | **Correct, with notes** | 4 **business** days after the registrant determines the incident is material. The materiality determination itself must be made "without unreasonable delay" after discovery. A DOJ national-security delay is possible. Still in force: a May 2025 SIFMA/ABA/BPI petition to rescind it and the January 2026 Reg S-K comment request have not produced a proposal (secondary source, Oct 2026). **Applies to public companies only. Winstead PC is a private firm, so this clock fits public-company clients.** Needs business-day arithmetic (skip weekends; federal holidays optional for the demo). | MEDIUM-HIGH |
| GDPR, "Awareness of breach", 72 hours | **Correct** | Art. 33: supervisory authority notified "without undue delay and, where feasible, not later than 72 hours after having become aware", unless the breach is unlikely to result in risk. Art. 34 (individuals): "without undue delay" if high risk. **Pending change:** the Digital Omnibus (2025/0360(COD)) Council mandate of 2026-10-21 proposes 96 hours and a high-risk-only threshold. It is not law. Trilogue and Official Journal publication are still needed, and secondary sources say it would apply about 18 months after entry into force. Keep 72h. | HIGH (current law); MEDIUM (Omnibus status) |
| CIRCIA, "Reasonable belief / ransom payment", 72h / 24h | **Figures correct, but NOT in effect** | CISA's CIRCIA page: reporting is not required until the final rule takes effect. The final rule is still unpublished: it missed the Oct 2025 statutory date and later targets of May and Sept 2026. 72h runs from when the entity "reasonably believes" a covered incident occurred. 24h runs from **making** a ransom payment, not receiving a demand. It only applies to covered critical-infrastructure entities, and a law firm is likely not one (LOW confidence, verify). Label it "Pending federal rule, not yet in effect" or drop it from the demo. | HIGH (status); LOW (law-firm coverage) |
| (consider) NYDFS 23 NYCRR 500.17 | **Optional add** | 72h after determining a cybersecurity incident occurred. Extortion payment: notice within 24h of payment, plus a written justification within 30 days. Relevant for financial-services clients. | MEDIUM-HIGH |
| (consider) HIPAA breach | **Optional add** | Law firms are often HIPAA business associates. A BA must notify the covered entity without unreasonable delay and no later than 60 days from discovery. | MEDIUM (training data, not re-verified) |
| (consider) Client notice: ABA Formal Op. 483 (2018) | **Recommend for a law-firm demo** | A lawyer must notify current clients of a breach involving material client confidential information. There is no fixed day count, so make it a Counsel checklist item. Very relevant to Winstead judges. | MEDIUM (training data) |
| (consider) Cyber insurer notice | **Recommend as task** | Deadline is policy-defined (often "as soon as practicable"). Already in the Lead's playbook ("call insurance hotline first"). | MEDIUM |

**Recommended demo clock set:** Texas AG 30d, Texas individuals 60d, GDPR 72h, SEC 8-K 4 business days (tagged "if public company / client"). Show CIRCIA only as a greyed "pending rule" card if at all. Add "Client notification (ABA 483)" and "Insurer notice" as Counsel and Lead checklist items. Every clock keeps the label "possible obligation, confirm with counsel" and links to the event that started it.

---

## Feature Dependencies

```
In-person QR enrollment
    └──requires──> in-app QR scanner + device keypair generation (expo-secure-store)
                       └──requires──> member/invite tables + atomic redeem reducer
Bootstrap two Admins ──required by──> any invite creation

Signed challenge ──requires──> device keypair + challenge table + server-side Ed25519 verify
    └──required by──> confirm_alert, set_attack_type, revoke, lockdown, close, duress

Hash-chained audit log ──should exist BEFORE──> every other reducer
    (retrofitting the audit append into 15 reducers is error-prone; build the helper first)
    └──enables──> timeline screen ──enables──> report export
    └──enables──> verify-chain button ──enhanced by──> client-witnessed chain head

Raise/confirm alert ──requires──> roles (Lead) + members
    └──triggers──> push (procedure → Expo push API) [dev build only for real push]
    └──triggers──> check-in
Check-in "Unavailable" ──feeds──> immediate backup reassignment ──shares logic with──> scheduled escalation

Lead picks attack type ──requires──> seeded playbook + playbook_step
    └──creates──> tasks assigned by role ──requires──> member.role + backup_for
Status board tap ──triggers──> playbook steps (trigger match)
                 ──triggers──> clock prompts (asset.contains_pii + jurisdiction)
Legal clocks ──require──> clock_rule seed + fact/event that starts them + business-day math (SEC)

Counsel channel ──requires──> server-enforced visibility (views/RLS) by role
Duress PIN ──requires──> on-device PIN check + signed duress reducer + decoy UI
Drill mode ──enhances──> everything (banner, clock labels, reset)

Duress decoy ──conflicts with──> remote wipe (evidence destruction)
Disappearing messages ──conflicts with──> hash-chained audit log
Company SSO/email anything ──conflicts with──> OOB threat model
```

### Dependency Notes

- **Audit-log helper goes first.** Every reducer appends to it, so build `appendAudit(ctx, actor, action, data)` in the first backend phase. Adding it to 15 existing reducers later is where chains break.
- **Signed challenge gates the "sensitive" reducers.** Build unlock and challenge before the response flow, or stub it behind a single `requireFreshSignature()` guard you can turn on later. Use the stub approach for speed.
- **Escalation and check-in share reassignment logic.** Write `reassignToBackup(task)` once. Call it from the check-in reducer ("Unavailable") and from the scheduled `escalate_task`.
- **Clocks depend on the status board and the PII flags on assets.** Without the board, a clock has no fact to start from. A minimal clock can start from a Counsel "Breach determined" button instead.
- **Push depends on distribution.** Real push needs a dev build (on Android definitely, per Expo docs). The alert UX must therefore also work through live subscription while the app is open.

---

## MVP Definition

### Launch With (demo must-haves)

- [ ] Bootstrap two Admins (setup code). Root of trust.
- [ ] QR invite create/redeem (hash, 10-min, single use, atomic). Access-control requirement.
- [ ] Device key + on-device PIN (+ biometric where available) + signed challenge on sensitive reducers. Security judging.
- [ ] Audit-log helper with hash chain + verify button + timeline screen. Documentation requirement. Build it first.
- [ ] Raise alert, then confirm. Confirmer must be a different person; 2 independent reports within a window. Push or live alarm. Core Value.
- [ ] Check-in with presence for the Lead. Table stakes.
- [ ] Ransomware playbook auto-assigned by role, accept/done, dependency locks, "your next step" card. Core Value and ease of use.
- [ ] Status board with PII-flagged assets whose taps trigger steps. Scope requirement.
- [ ] Group chat + server-enforced counsel-only channel with privilege label. Comms requirement and lawyer appeal.
- [ ] Revoke member + lockdown. Live security demo beat.
- [ ] False alarm / stand-down. Closes a lifecycle gap.
- [ ] Drill mode banner + Admin demo reset. Makes the 3-minute tabletop repeatable.

### Add After Core Works (stretch, in this order)

- [ ] Legal clocks (minimal: Texas AG, Texas individuals, GDPR, SEC 8-K). Highest creativity-per-hour for lawyer judges. Do first.
- [ ] Task escalation to backup with a short demo timer. Visible on stage.
- [ ] Report export (text through share sheet, includes chain head hash). Cheap once the timeline exists.
- [ ] Duress PIN. Memorable, but only if the core is solid.
- [ ] Decision log, Wi-Fi banner, call-bridge button, key-fingerprint compare screen. Each takes under an hour.
- [ ] Guest auto-expiry. Easy with a scheduled reducer, but invisible in a 3-minute demo.

### Future Consideration (v2+)

- [ ] Additional playbooks (account takeover, wire fraud). Content work; the demo needs only ransomware.
- [ ] End-to-end encryption of messages. Key distribution and rekeying are too much for a weekend.
- [ ] Playbook authoring UI and configurable clock-rule editor.
- [ ] Client-witnessed chain head / external anchoring.
- [ ] Push-to-talk voice.

---

## Feature Prioritization Matrix

| Feature | User/Judge Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| QR invite enrollment | HIGH | MEDIUM | P1 |
| Device key + PIN + signed challenge | HIGH | MEDIUM-HIGH | P1 |
| Hash-chained audit + timeline + verify | HIGH | MEDIUM | P1 |
| Raise/confirm alert (two-person) + push/alarm | HIGH | MEDIUM | P1 |
| Check-in | MEDIUM | LOW | P1 |
| Role playbook auto-assign + next-step card | HIGH | MEDIUM | P1 |
| Status board | HIGH | LOW-MEDIUM | P1 |
| Group + counsel channel (server-enforced) | HIGH | MEDIUM | P1 |
| Revoke + lockdown | HIGH | LOW-MEDIUM | P1 |
| False alarm / stand-down | MEDIUM | LOW | P1 |
| Drill mode + demo reset | MEDIUM (demo-critical) | LOW | P1 |
| Legal deadline clocks (minimal) | HIGH (law-firm judges) | MEDIUM | P2 (first stretch) |
| Task escalation to backup | MEDIUM | MEDIUM | P2 |
| Report export | MEDIUM | LOW-MEDIUM | P2 |
| Privilege label on counsel channel | MEDIUM | LOW | P2 |
| Duress PIN | MEDIUM (creativity) | MEDIUM | P2 |
| Decision log / Wi-Fi banner / call bridge / fingerprint screen | MEDIUM | LOW | P2 |
| Invite lineage tree view + branch revoke | MEDIUM | LOW-MEDIUM | P2 |
| Guest auto-expiry | LOW | LOW | P3 |
| Extra playbooks | LOW | MEDIUM | P3 |
| Client-witnessed chain head | LOW-MEDIUM | LOW-MEDIUM | P3 |
| E2E encryption, PTT, authoring UI | LOW for demo | HIGH | Out |

**Priority key:**
- P1: Must have for the demo
- P2: Should have, add when P1 works end to end
- P3: Nice to have

---

## Competitor Feature Analysis

| Feature | ShadowHQ | CYGNVS | Mattermost (OOB) | BreachRx | Signal/WhatsApp group (status quo) | Red Phone |
|---------|----------|--------|------------------|----------|----------------------|-----------|
| Isolation from corporate systems | Hosted "backup workplace" | Hosted OOB platform, mobile app; offered by insurers (AIG, Beazley) | Self-hosted, can be air-gapped | SaaS | Consumer app | Personal phones + cellular + Maincloud |
| Enrollment / identity | Vendor accounts | Vendor accounts | SSO/accounts (self-hosted) | SaaS accounts | Phone number; anyone can add | In-person QR, device key, top-down invites, lineage |
| Alerting | Multi-channel alerts, call trees, mass notify | Alerts | Playbook-triggered notifications | Task notifications | None | Two-person-confirmed, content-free push |
| Playbooks / tasks | Automated playbooks, task mgmt | Playbooks, tabletop | Playbooks (triage, assignment, escalation), Boards | Dynamic plans, AI | None | Pre-approved role playbooks, auto-assigned, dependency-locked |
| Regulatory deadlines | Not highlighted | Reporting/documentation | No | Core feature (200+ regs claimed) | No | Fact-triggered clocks, "confirm with counsel" |
| Privilege handling | Not highlighted | Not highlighted | No | Marketed | No | Counsel-only channel + privilege label + counsel-engaged forensics task |
| Audit / evidence | "Audit-ready documentation" | Documentation | Event timelines, audit trail | Audit logs | None (or disappearing) | Hash-chained, verifiable, exportable |
| Exercises | Debriefs | Tabletop exercises | — | Exercise planning | — | Drill mode (demo is a tabletop) |
| Voice | (call trees) | — | 1:1 calling | — | Calls | Call-bridge `tel:` link (PTT out of scope) |
| Duress | — | — | — | — | — | Duress PIN (unique, as far as research found) |

Takeaway: Red Phone's distinct angles are (1) a zero-corporate-identity trust model with in-person enrollment and invite lineage, (2) two-person alert confirmation, (3) a hash-chained verifiable record, (4) fact-triggered legal clocks, and (5) the duress PIN. Competitors' shared table stakes (alerts, playbooks, tasks, documentation, exercises) are all covered by the plan once false-alarm and drill mode are added.

---

## Spec Gaps Found in plan.md (for the requirements step)

1. **The confirmer must differ from the raiser.** Without this, a single stolen Lead phone can raise and confirm alone, which breaks "one stolen phone must not cause a full alert".
2. **No false-alarm / stand-down state** in the incident lifecycle.
3. **Push-to-talk is claimed** in the challenge mapping table but out of scope. Remove it or substitute a call-bridge link.
4. **Texas individuals clock trigger:** "discovered" should be "determines that the breach occurred".
5. **CIRCIA is not in effect.** Mark it "pending rule" or remove it.
6. **SEC 8-K needs business-day math** and applies to public companies only. Tag it "if public company / client".
7. **No owner when a role is empty or Unavailable.** Define the fallback: backup, then Lead.
8. **Expo Go limits:** no Face ID on iOS, and no remote push on Android SDK 53+. This affects "judges enroll on their own phones and receive the alert". Needs a dev build or a live-subscription alarm fallback.
9. **No drill flag / demo reset** for a repeatable tabletop.
10. **The "Exportable report" promised in the requirement-03 mapping is only stretch.** At minimum, the timeline screen must be in the MVP.

---

## Sources

- Texas Bus. & Com. Code §521.053 (current text and amendment history): https://texas.public.law/statutes/tex._bus._and_com._code_section_521.053 (HIGH)
- Texas SB 768 (2023), 30-day AG notice: https://capitol.texas.gov/tlodocs/88R/billtext/html/SB00768F.htm (HIGH)
- Texas SB 2610 (2025), liability safe harbor, no deadline change: https://capitol.texas.gov/tlodocs/89R/billtext/html/SB02610F.htm (MEDIUM)
- CISA CIRCIA page (final rule not issued, reporting not required, 72h/24h triggers, June 2026 town halls): https://www.cisa.gov/topics/cyber-threats-and-advisories/information-sharing/cyber-incident-reporting-critical-infrastructure-act-2022-circia (HIGH)
- CIRCIA timeline reporting: https://www.hunton.com/privacy-and-cybersecurity-law-blog/cisa-plans-to-finalize-cyber-incident-reporting-regulations-in-september-2026 ; https://federalnewsnetwork.com/cybersecurity/2026/07/circia-other-big-cyber-rules-expected-to-get-finalized-this-fall/ (MEDIUM)
- SEC Item 1.05 adopting release: https://www.federalregister.gov/documents/2023/08/04/2023-16194/cybersecurity-risk-management-strategy-governance-and-incident-disclosure (HIGH)
- SEC rescission petition (May 2025): https://www.sec.gov/rules-regulations/2025/05/joint-petition-rulemaking-amend-sec-cybersecurity-risk-management-strategy-governance-incident (HIGH)
- Debevoise 8-K tracker (May 2026): https://www.debevoisedatablog.com/2026/05/21/cybersecurity-incident-disclosure-form-8-k-tracker-two-year-update/ (MEDIUM)
- GDPR Digital Omnibus status (Council mandate 2026-10-21, 96h not law): https://dpoas.co.il/blog/digital-omnibus-council-mandate-gdpr/ ; https://legal247.no/en/insights/digital-omnibus-gdpr/ (MEDIUM)
- NYDFS 23 NYCRR 500.17: https://www.law.cornell.edu/regulations/new-york/23-NYCRR-500.17 (HIGH)
- Expo LocalAuthentication (Face ID unsupported in Expo Go): https://docs.expo.dev/versions/latest/sdk/local-authentication/ (HIGH)
- Expo Notifications (push unavailable in Expo Go on Android from SDK 53; dev build required): https://docs.expo.dev/versions/latest/sdk/notifications/ (HIGH)
- Mattermost OOB incident response: https://docs.mattermost.com/use-case-guide/out-of-band-incident-response.html (MEDIUM, vendor)
- ShadowHQ features: https://marketplace.connectwise.com/shadowhq ; https://vmblog.com/bylines/introducing-shadowhq-notify-secure-mass-notifications-for-cyber-crisis-response/ (LOW-MEDIUM, vendor)
- CYGNVS: https://www.csoonline.com/article/3685941/cygnvs-exits-stealth-trumpeting-its-cyberattack-recovery-platform.html ; https://beazley.com/en-GB/cyber-customer-centre/cyber-risk-management-tools/risk-management-offerings/incident-preparation-room (MEDIUM)
- BreachRx: https://oodaloop.com/company-profiles/cybersecurity/breachrx/ (LOW-MEDIUM, vendor-sourced)
- Training data only (not re-verified this session): ABA Formal Opinion 483 (2018); HIPAA BA 60-day rule; Capital One (E.D. Va. 2020) forensic-report privilege ruling.

---
*Feature research for: out-of-band cyber incident response / crisis communications (Red Phone, HackUTD 2026)*
*Researched: 2026-11-07*
