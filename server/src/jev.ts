// Jev: deterministic tripwire triage. Pure functions only, so it is easy to unit test.

export type IncidentType = 'ransomware' | 'exfiltration' | 'credential_theft' | 'false_positive';
export type Tier = 'high' | 'mid' | 'low';

/** Intranet system id -> display name shown to responders. */
export const SYSTEM_NAMES: Record<string, string> = {
  a_shares: 'Shared drives',
  a_docs: 'Document management',
  a_email: 'Email and calendar',
  a_billing: 'Billing and trust accounting',
  a_hr: 'HR and payroll',
};

/** Intranet system id -> module asset row name (board). a_hr has no board asset. */
export const ASSET_ROW_NAMES: Record<string, string> = {
  a_shares: 'Client File Server',
  a_docs: 'Document Mgmt',
  a_email: 'Email',
  a_billing: 'Billing DB',
};

export const systemNameOf = (assetId: string) => SYSTEM_NAMES[assetId] ?? assetId;

const BASE: Record<string, number> = { document_opened: 85, login_attempt: 88, key_used: 90 };

const PAGE: Record<IncidentType, string> = {
  exfiltration: 'it,lead,counsel,comms',
  credential_theft: 'it,lead',
  ransomware: 'it,lead,counsel,comms,executive,finance',
  false_positive: '',
};

export const WINDOW_MICROS = 30n * 60n * 1_000_000n;

export interface JevHit {
  tripwireId: string;
  label: string;
  fileName: string;
  assetId: string;
  hitKind: string;
  sourceIp: string;
  userAgent: string;
}

/** Another tripwire hit inside the 30-minute window (any tripwire; duplicates are fine). */
export interface JevRecent {
  tripwireId: string;
  label: string;
  assetId: string;
}

export interface JevResult {
  probability: number;
  incidentType: IncidentType;
  scope: string[]; // display names
  scopeAssetIds: string[];
  page: string;
  tier: Tier;
  evidence: string[];
}

export const isIndexer = (userAgent: string) => userAgent.includes('HP-IndexBot');

function shortUa(ua: string) {
  const s = ua.trim();
  if (!s) return 'no user agent';
  return s.length > 60 ? s.slice(0, 57) + '...' : s;
}

function hitSentence(hit: JevHit) {
  const sys = systemNameOf(hit.assetId);
  switch (hit.hitKind) {
    case 'document_opened':
      return `Decoy file ${hit.fileName} in ${sys} was opened.`;
    case 'login_attempt':
      return 'Someone tried to sign in to the fake Backup Console as the decoy service account.';
    case 'key_used':
      return `Someone called the billing API with a fake key from ${hit.fileName}.`;
    default:
      return `Decoy ${hit.label} in ${sys} was touched (${hit.hitKind}).`;
  }
}

export function scoreHit(hit: JevHit, recent: JevRecent[]): JevResult {
  const others = new Map<string, JevRecent>();
  for (const r of recent) if (r.tripwireId !== hit.tripwireId && !others.has(r.tripwireId)) others.set(r.tripwireId, r);
  const evidence = [hitSentence(hit), `Source ${hit.sourceIp || 'unknown'} · ${shortUa(hit.userAgent)}.`];

  if (isIndexer(hit.userAgent)) {
    evidence.push("User agent is HP-IndexBot, the firm's own allowlisted indexer, so this is most likely routine indexing.");
    return {
      probability: 18, incidentType: 'false_positive', scope: [systemNameOf(hit.assetId)],
      scopeAssetIds: [hit.assetId], page: '', tier: 'low', evidence,
    };
  }

  evidence.push('Decoys are never used in normal work, so any touch is a strong signal.');
  let p = BASE[hit.hitKind] ?? 72;
  p += Math.min(16, 8 * others.size);
  if (others.size > 0) {
    const labels = [...others.values()].map((o) => o.label).join(', ');
    evidence.push(`${others.size} other tripwire(s) fired in the last 30 minutes: ${labels}.`);
  }
  if (hit.sourceIp.startsWith('10.10.')) {
    p -= 20;
    evidence.push('Source is in the IT admin subnet (10.10.x.x), so this may be a staff mistake.');
  }
  p = Math.max(1, Math.min(99, p));

  const incidentType: IncidentType =
    others.size >= 1 ? 'ransomware' : hit.hitKind === 'login_attempt' ? 'credential_theft' : 'exfiltration';
  const scopeAssetIds: string[] = [];
  for (const a of [hit.assetId, ...[...others.values()].map((o) => o.assetId)]) {
    if (!scopeAssetIds.includes(a)) scopeAssetIds.push(a);
  }
  return {
    probability: p,
    incidentType,
    scope: scopeAssetIds.map(systemNameOf),
    scopeAssetIds,
    page: PAGE[incidentType],
    tier: p >= 80 ? 'high' : p >= 50 ? 'mid' : 'low',
    evidence,
  };
}

const list = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

/** Automation kinds the module can emulate for a task (see automation.ts). */
export type AutoKind =
  | 'isolate_host' | 'lock_account' | 'lock_service_account' | 'rotate_billing_keys'
  | 'reset_backup_passwords' | 'revoke_sharing' | 'block_egress' | 'export_logs' | 'protect_backups';

export interface JevTask { role: string; title: string; detail: string; auto?: AutoKind }

/** What the hit tells IT, used to fill in plain-language steps. */
export interface JevTaskInput {
  systems: string[];
  ip: string;
  label: string;
  evidence: string;
  hitKind?: string;
  fileName?: string;
  /** Time of the hit, already formatted (e.g. "14:32 UTC"). */
  time?: string;
}

/**
 * Task detail format (parsed by the app): first line says why, each "- " line is one plain-language
 * substep, and " Evidence: ..." is appended last.
 */
const steps = (why: string, ...items: string[]) => [why, ...items.map((i) => `- ${i}`)].join('\n');

/**
 * IT containment steps after a tripwire hit, written for someone who is not a security specialist:
 * 1 cut off the source machine, 2 lock its account and remote access, 3 revoke what the decoy exposed,
 * 4 stop large uploads, 5 save logs. Credential theft skips 1 and 4 (no file or machine was touched).
 */
export function itTasks(incidentType: IncidentType, o: JevTaskInput): JevTask[] {
  const sys = list(o.systems) || 'the affected system';
  const ip = o.ip || 'the source address';
  const when = o.time ? ` at ${o.time}` : '';
  const isolate: JevTask = {
    role: 'it', auto: 'isolate_host', title: `Cut off the computer at ${ip}`,
    detail: steps(
      'The attacker is using this computer. Cutting it off stops them, and keeping it on keeps the evidence.',
      `Find the computer with address ${ip}. The help desk asset list or the router's device list shows it.`,
      'Unplug its network cable and turn off its Wi-Fi.',
      'Leave it powered on. Do not restart, log off or shut it down.',
      'Put a "Do not touch: incident" note on it.',
    ),
  };
  const lockAccount: JevTask = incidentType === 'credential_theft'
    ? {
        role: 'it', auto: 'lock_service_account', title: 'Lock the svc_backup_admin account and block remote access',
        detail: steps(
          'Someone tried to sign in with the decoy backup account. Lock it and shut the door they came through.',
          'In the admin console (Microsoft 365 or Active Directory), disable svc_backup_admin.',
          `Block ${ip} on the firewall and end any VPN sessions from it.`,
          'Turn off remote desktop and VPN for any account that signed in from that address.',
        ),
      }
    : {
        role: 'it', auto: 'lock_account', title: `Lock the account used on ${ip}`,
        detail: steps(
          'Whoever is signed in on that computer may be the attacker. Lock the account so it stops working everywhere.',
          `Check who was signed in on ${ip}${when}. The sign-in log in the admin console shows it.`,
          'Disable that account in the admin console (Microsoft 365 or Active Directory).',
          'Turn off VPN and remote desktop for that account.',
          `Block ${ip} on the firewall and end any VPN sessions from it.`,
        ),
      };
  const revoke: JevTask =
    o.hitKind === 'key_used'
      ? {
          role: 'it', auto: 'rotate_billing_keys', title: 'Replace the billing API keys',
          detail: steps(
            `The attacker found the keys in ${o.fileName || 'the decoy file'}. Real keys stored nearby may also be exposed.`,
            'Sign in to the billing system\'s admin page.',
            'Create new API keys, then delete every old key.',
            'Update the apps that use the keys, and note each change in the chat.',
          ),
        }
      : o.hitKind === 'login_attempt'
        ? {
            role: 'it', auto: 'reset_backup_passwords', title: 'Reset every backup admin password',
            detail: steps(
              'The attacker is after the backups. Change the passwords they would need to reach them.',
              'Change the password on every real backup admin account.',
              'Turn on two-step sign-in for those accounts if it is off.',
              'Check that the latest backup still exists and is not encrypted.',
            ),
          }
        : {
            role: 'it', auto: 'revoke_sharing', title: `Remove outside access to ${sys}`,
            detail: steps(
              `The attacker opened ${o.fileName || 'a decoy file'}. Close every way they could keep reading files there.`,
              `Turn off all public and guest sharing links on ${sys}.`,
              `Change the password of the service account that runs ${sys}.`,
              'Remove access for anyone who does not need it today.',
            ),
          };
  const egress: JevTask = {
    role: 'it', auto: 'block_egress', title: `Stop large uploads from ${sys}`,
    detail: steps(
      'Attackers copy files out before anyone notices. Blocking big uploads stops the theft.',
      `On the firewall, block outgoing traffic from ${sys} except to your backup service.`,
      'Watch the firewall for any upload larger than 100 MB.',
      'Post a screenshot of anything you see in the chat.',
    ),
  };
  const logs: JevTask = {
    role: 'it', auto: 'export_logs', title: 'Save the logs from the last 24 hours',
    detail: steps(
      'Logs show what the attacker did. They are overwritten quickly, and lawyers and insurers will need them.',
      `Export firewall, VPN and file-access logs for the 24 hours before the hit${when}.`,
      'Copy them to a USB drive and keep it unplugged from the network.',
      'Do not wipe, restore or reimage any computer yet.',
    ),
  };
  return incidentType === 'credential_theft'
    ? [lockAccount, revoke, logs]
    : [isolate, lockAccount, revoke, egress, logs];
}

/** Pre-filled tasks Jev pushes when it opens (or joins) an incident. IT tasks come first. */
export function jevTasks(incidentType: IncidentType, o: JevTaskInput): JevTask[] {
  const sys = list(o.systems);
  const review: JevTask = {
    role: 'lead', title: "Review Jev's evidence and approve containment",
    detail: 'Read the tripwire evidence, confirm the containment steps, and note your decision in the chat.',
  };
  let tasks: JevTask[];
  switch (incidentType) {
    case 'exfiltration':
      tasks = [
        ...itTasks(incidentType, o),
        review,
        { role: 'counsel', title: `Assess exposure of ${o.label}`, detail: 'Decide whether real client or firm data near the decoy may have been read or copied.' },
        { role: 'comms', title: `Tell staff to stay off ${sys}`, detail: 'Post through Red Phone, not email: nobody opens or copies files from this system until IT clears it.' },
      ];
      break;
    case 'credential_theft':
      tasks = [...itTasks(incidentType, o), review];
      break;
    case 'ransomware':
      tasks = [
        ...itTasks(incidentType, o),
        {
          role: 'it', auto: 'protect_backups', title: 'Protect backups from the attacker',
          detail: steps(
            'Ransomware goes after backups first. Offline backups are how the firm recovers without paying.',
            'Unplug backup drives, or turn off the backup server\'s network connection.',
            'Check that the latest backup exists and opens normally.',
            'Do not restore anything until forensics says it is safe.',
          ),
        },
        review,
        { role: 'executive', title: 'Do not contact the attacker or pay', detail: 'No one replies to the attacker. Any payment needs counsel, insurer consent and an OFAC check.' },
        { role: 'finance', title: 'Hold and verify all outgoing wires', detail: 'Pause trust-account and wire transfers. Confirm payment instructions by phone using a known number.' },
        { role: 'counsel', title: `Assess exposure across ${sys}`, detail: 'Decide which client matters and personal data these systems hold and what notice duties may follow.' },
        { role: 'comms', title: 'Tell staff through Red Phone, not email', detail: 'Email may be watched. Tell staff: no email or chat about this, keep computers on.' },
      ];
      break;
    default:
      tasks = [];
  }
  return tasks.map((t) => ({ ...t, detail: `${t.detail} Evidence: ${o.evidence}` }));
}
