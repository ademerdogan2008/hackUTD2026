import type { Ctx } from './util';

const R = 'ransomware';
// key, role, title, detail, dependsOn key
// Ransomware playbook for a law firm, first hours. Sources: CISA/MS-ISAC #StopRansomware Guide (2023),
// OFAC ransomware advisory (2021), ABA Formal Op. 483, NYC Bar Formal Op. 2024-3, Tex. Bus. & Com. Code §521.053.
const STEPS: [string, string, string, string, string][] = [
  ['isolate', 'it', 'Disconnect affected machines', 'Unplug cables or turn off Wi-Fi on affected devices. Leave them powered on; shut down only if you cannot disconnect.', ''],
  ['backups', 'it', 'Protect backups from the attacker', 'Take backups offline now and check they were not deleted or encrypted. Do not restore until forensics clears it.', ''],
  ['insurer', 'lead', 'Call the cyber insurance hotline', 'Report the claim now. Policies often require approved lawyers and vendors, and written consent before costs or payments.', ''],
  ['nopay', 'executive', 'Do not contact the attacker or pay', 'No one replies to the attacker. Any payment needs counsel, insurer consent and an OFAC sanctions check first.', ''],
  ['staff', 'comms', 'Tell staff through Red Phone, not email', 'Email may be watched. Tell staff: no email or chat about this, keep computers on, report anything suspicious.', ''],
  ['wires', 'finance', 'Hold and verify all outgoing wires', 'Pause trust-account and wire transfers. Confirm any payment instruction by phone using a known number, never email.', ''],
  ['accounts', 'it', 'Lock down accounts and remote access', 'Disable suspicious or new admin accounts, VPN and remote access. Full password resets come after systems are cleaned.', 'isolate'],
  ['evidence', 'it', 'Preserve logs and evidence', 'Save firewall, VPN, email and security logs and the ransom note. Do not wipe or reimage any machine.', 'isolate'],
  ['forensics', 'counsel', 'Retain forensics through outside counsel', 'Outside counsel hires the insurer-approved forensic firm to support legal advice. Limit who receives its reports.', 'insurer'],
  ['report', 'counsel', 'Report to FBI and CISA', 'File with IC3 or the local FBI field office and CISA. Counsel limits what client information is shared.', ''],
  ['exfil', 'it', 'Check whether data was stolen', 'With forensics, look for large outbound transfers and leak-site claims. Mark affected systems Stolen on the board.', 'forensics'],
  ['deadlines', 'counsel', 'Map notification deadlines and duties', 'Check Texas, clients\' home states, GDPR, client contracts and insurer notice terms against the clocks.', ''],
  ['clients', 'counsel', 'Notify affected clients and courts', 'Tell clients whose data was exposed or whose matters are delayed. Seek extensions for court deadlines at risk.', 'exfil'],
  ['holding', 'comms', 'Prepare a holding statement', 'Draft a short factual statement for clients and press. Counsel approves before release; no guessing about cause.', ''],
];

const ASSETS: [string, boolean, string][] = [
  ['Client File Server', true, 'TX'],
  ['Email', true, 'TX'],
  ['Billing DB', true, 'TX,EU'],
  ['Document Mgmt', false, ''],
  ['Backups', false, ''],
];

/** Idempotent: fills empty tables, and replaces the ransomware playbook if it differs from STEPS. */
export function ensureSeed(ctx: Ctx) {
  const current = [...ctx.db.playbookStep.iter()].filter((p) => p.attackType === R).sort((a, b) => a.order - b.order);
  const upToDate = current.length === STEPS.length && current.every((p, i) => p.title === STEPS[i][2] && p.detail === STEPS[i][3]);
  if (!upToDate) for (const p of current) ctx.db.playbookStep.id.delete(p.id);
  if (!upToDate) {
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
