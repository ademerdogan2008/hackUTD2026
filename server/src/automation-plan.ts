// Emulated automation plans and the helper that offers an automation for a task (no SpacetimeDB exports here).
import type { AutoKind } from './jev';
import type { Ctx } from './util';

export interface AutoParams {
  ip: string;
  systems: string; // display names, comma-separated
  rows: string; // board asset row names, comma-separated
  time: string; // "14:32 UTC"
  fileName: string;
}

export interface AutoPlan {
  /** Steps the automation performed, in order. */
  lines: string[];
  /** What a person still has to do by hand, if anything. */
  manual?: string;
  /** One-line result posted to the team chat. */
  chat: string;
  /** Board status to set on the affected assets. */
  asset?: 'contained';
}

const list = (csv: string) => {
  const xs = csv.split(',').map((x) => x.trim()).filter(Boolean);
  return xs.length <= 1 ? (xs[0] ?? 'the affected system') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
};

/** Stable fake hostname for an IP, e.g. 10.20.4.17 -> WS-0417. */
function hostOf(ip: string) {
  const o = ip.split('.');
  return o.length === 4 ? `WS-${o[2].padStart(2, '0')}${o[3].padStart(2, '0')}` : 'WS-UNKNOWN';
}

export function automationPlan(kind: AutoKind, p: AutoParams): AutoPlan {
  const ip = p.ip || 'the source address';
  const sys = list(p.systems);
  const host = hostOf(p.ip);
  switch (kind) {
    case 'isolate_host':
      return {
        lines: [
          `Found ${host} at ${ip} in the endpoint protection console`,
          'Turned on network isolation (only the security console can still reach it)',
          `Checked: ${host} no longer answers on the office network`,
          'Memory and disk left untouched for forensics',
        ],
        manual: 'Leave the computer powered on and put a "Do not touch: incident" note on it.',
        chat: `Automation: ${host} (${ip}) is cut off from the network.`,
        asset: 'contained',
      };
    case 'lock_account':
      return {
        lines: [
          `Sign-in log: m.reyes was signed in on ${host}${p.time ? ` at ${p.time}` : ''}`,
          'Disabled m.reyes in the directory',
          'Signed m.reyes out everywhere (all sessions and tokens revoked)',
          'Turned off VPN and remote desktop for m.reyes',
          `Firewall: blocked ${ip} and ended its VPN sessions`,
        ],
        manual: 'Call m.reyes on a known number to confirm whether they were at that computer.',
        chat: `Automation: account m.reyes locked and ${ip} blocked.`,
      };
    case 'lock_service_account':
      return {
        lines: [
          'Disabled svc_backup_admin in the directory',
          'Revoked all sessions and tokens for svc_backup_admin',
          `Firewall: blocked ${ip} and ended its VPN sessions`,
          `Turned off remote access for accounts that signed in from ${ip}`,
        ],
        chat: `Automation: svc_backup_admin locked and ${ip} blocked.`,
      };
    case 'rotate_billing_keys':
      return {
        lines: [
          'Created 2 new billing API keys',
          'Updated the billing and invoicing apps to use the new keys',
          'Deleted every old key, including the one in the decoy file',
          'Test call with a new key: OK',
        ],
        chat: 'Automation: billing API keys replaced; old keys no longer work.',
      };
    case 'reset_backup_passwords':
      return {
        lines: [
          'Reset passwords on 3 backup admin accounts',
          'Turned on two-step sign-in for all 3',
          'Checked the latest backup: present and readable, not encrypted',
        ],
        chat: 'Automation: backup admin passwords reset; latest backup checked OK.',
      };
    case 'revoke_sharing':
      return {
        lines: [
          `Turned off 14 public and guest sharing links on ${sys}`,
          `Changed the service account password for ${sys}`,
          `Removed temporary access for 3 accounts not needed today`,
        ],
        chat: `Automation: outside access to ${sys} removed.`,
        asset: 'contained',
      };
    case 'block_egress':
      return {
        lines: [
          `Firewall: blocked outgoing traffic from ${sys}, except the backup service`,
          'Turned on an alert for any upload over 100 MB',
          'Last hour: no large uploads seen after the block',
        ],
        chat: `Automation: large uploads from ${sys} are blocked.`,
        asset: 'contained',
      };
    case 'export_logs':
      return {
        lines: [
          `Exported firewall, VPN and file-access logs for the 24 hours before ${p.time || 'the hit'}`,
          'Saved to the offline evidence store (412 MB)',
          'Recorded a SHA-256 fingerprint of the export in the audit log',
        ],
        manual: 'Do not wipe, restore or reimage any computer yet.',
        chat: 'Automation: last 24 hours of logs saved as evidence.',
      };
    case 'protect_backups':
      return {
        lines: [
          'Disconnected the backup server from the network',
          'Latest backup: present, opens normally, not encrypted',
          'Paused all restore jobs until forensics clears it',
        ],
        chat: 'Automation: backups taken offline and checked.',
      };
  }
}

/** Record that a task can be automated (called when Jev creates the task). */
export function offerAutomation(ctx: Ctx, taskId: bigint, incidentId: bigint, kind: AutoKind, params: AutoParams) {
  if (ctx.db.automationRun.taskId.find(taskId)) return;
  ctx.db.automationRun.insert({
    id: 0n, taskId, incidentId, kind, params: JSON.stringify(params), status: 'ready', log: '', ranBy: '', at: ctx.timestamp,
  });
}

