import type { Ctx } from './util';

const R = 'ransomware';
// key, role, title, detail, dependsOn key
const STEPS: [string, string, string, string, string][] = [
  ['isolate', 'it', 'Isolate affected machines', 'Unplug affected machines from the network. Do not power them off: memory holds evidence.', ''],
  ['backups', 'it', 'Check backups are intact and offline', 'Confirm the most recent backups are offline and untouched before any restore.', 'isolate'],
  ['patient0', 'it', 'Find the first infected machine', 'Identify the earliest infected machine and note when and how it was hit.', 'isolate'],
  ['insurer', 'lead', 'Call the cyber insurance hotline first', 'Insurers often require their approved firms. Call before engaging vendors.', ''],
  ['assign', 'lead', 'Assign an owner to every task', 'Make sure each open task has a named owner in Red Phone.', 'insurer'],
  ['forensics', 'counsel', 'Engage outside forensics through counsel', 'Hire the forensics firm via counsel to protect attorney-client privilege.', ''],
  ['deadlines', 'counsel', 'Review which notification deadlines apply', 'Check state, federal and GDPR obligations against the status board.', 'forensics'],
  ['staff', 'comms', 'Tell staff through Red Phone, not email', 'Company email may be compromised. Send staff instructions here only.', ''],
  ['holding', 'comms', 'Prepare a holding statement', 'Draft a short holding statement for clients and press. Counsel reviews before use.', 'staff'],
  ['nopay', 'executive', 'Do not contact the attacker or pay yet', 'Wait for counsel and the insurer. Paying certain groups can violate sanctions law.', 'deadlines'],
];

const ASSETS: [string, boolean, string][] = [
  ['Client File Server', true, 'TX'],
  ['Email', true, 'TX'],
  ['Billing DB', true, 'TX,EU'],
  ['Document Mgmt', false, ''],
  ['Backups', false, ''],
];

/** Idempotent: only fills empty tables. */
export function ensureSeed(ctx: Ctx) {
  if (ctx.db.playbookStep.count() === 0n) {
    const ids = new Map<string, bigint>();
    STEPS.forEach(([key, role, title, detail, dep], i) => {
      const row = ctx.db.playbookStep.insert({
        id: 0n, attackType: R, order: i + 1, role, title, detail, dependsOn: dep ? ids.get(dep)! : 0n,
      });
      ids.set(key, row.id);
    });
  }
  if (ctx.db.asset.count() === 0n) {
    for (const [name, hasPii, regions] of ASSETS) {
      ctx.db.asset.insert({ id: 0n, name, hasPii, regions, status: 'unknown', setBy: '', updatedAt: ctx.timestamp });
    }
  }
}
