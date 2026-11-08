# Flare — Notes

## Run automatically (IT containment)

### Why it exists

Run automatically is an ease-of-use feature. During an attack, the person holding the phone may not be a
security specialist and is under pressure. Instead of reading a runbook and working through admin consoles,
they see one card with their next step and a single **Run automatically** button. One tap carries out the
whole step, shows each action as it completes, and lists anything that still needs a human (for example,
"leave the computer on and put a do-not-touch note on it"). The plain-language checklist stays below the
button, so the step can still be done by hand.

The button appears on the "Your next step" card on both the **Home** and **Tasks** tabs.

### How Jev plans the steps

Jev is a deterministic triage engine (`server/src/jev.ts`), not a language model. The same evidence always
produces the same result, so the plan is predictable, testable and explainable to a judge or an auditor.

1. **Score the hit.** When a decoy file, fake login or fake API key is touched, the tripwire relay reports
   the hit to SpacetimeDB. `scoreHit` turns the hit kind, source IP, user agent and any other tripwire hits
   in the last 30 minutes into a probability, a tier (high, mid or low), an incident type (exfiltration,
   credential theft, ransomware or false positive), the affected systems, and cited evidence sentences.
2. **Decide what to do.** A high-tier hit opens the incident automatically, a mid-tier hit waits for a lead
   to confirm, and a low-tier hit is only logged.
3. **Plan the actionable points.** `jevTasks` / `itTasks` turn the incident type and evidence into concrete
   steps for each role, filled in with the real IP address, file name, system and time of the hit. For IT
   these are: cut off the computer, lock the account, revoke what the decoy exposed (billing keys, backup
   passwords or sharing links, depending on the decoy), stop large uploads, and save the logs. Credential
   theft gets a shorter plan; ransomware adds "protect backups".
4. **Attach an automation.** Every IT step carries an automation kind (`AutoKind`). When Jev creates the
   task, it also creates a `ready` row in the `automation_run` table with the evidence parameters.

### What one tap does

The `runAutomation` reducer (`server/src/automation.ts`) runs inside one SpacetimeDB transaction:

- builds the step log from `automationPlan` (`server/src/automation-plan.ts`) and stores it on the
  `automation_run` row as `succeeded`;
- marks the task done;
- posts the result to the team chat;
- moves the affected systems on the board from "Attacker active" to "Contained" where that applies;
- appends an `automation.run` entry to the hash-chained audit log.

Because everything lives in SpacetimeDB, every responder's phone sees the result at the same moment, and
both demo reset buttons clear the runs and undo the board changes.

### Emulated, not real

For the demo, the automations are emulated: no real endpoint, directory, firewall, SIEM or backup system is
touched, and the result card says so. Each `AutoKind` maps one-to-one to an API call that a real
integration would make (EDR network isolation, directory account disable and session revoke, firewall
deny and egress rules, SIEM log export, backup console). Replacing the emulated plan with those calls does
not change the task, chat, board or audit flow.
