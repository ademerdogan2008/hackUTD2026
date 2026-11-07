import { sha256Hex } from './crypto';

export const GENESIS = '0'.repeat(64);

export interface AuditHashInput {
  seq: bigint | number;
  atMicros: bigint | number;
  actorHex: string;
  action: string;
  dataHash: string;
  prevHash: string;
}

export function auditHash(i: AuditHashInput): string {
  return sha256Hex(
    `redphone/v1|audit|${i.seq}|${i.atMicros}|${i.actorHex}|${i.action}|${i.dataHash}|${i.prevHash}`,
  );
}

/** Deterministic hash of the audit payload fields (keys sorted). */
export function auditDataHash(fields: Record<string, string | number | bigint | boolean>): string {
  const body = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${String(fields[k])}`)
    .join('&');
  return sha256Hex(`redphone/v1|data|${body}`);
}

/** Structurally matches the generated `audit_log` row. */
export interface AuditRowLike {
  seq: bigint;
  at: { microsSinceUnixEpoch: bigint };
  actor: { toHexString(): string };
  action: string;
  dataHash: string;
  prevHash: string;
  hash: string;
}

export function verifyChain(rows: readonly AuditRowLike[]): { ok: boolean; brokenAt?: bigint } {
  const sorted = [...rows].sort((a, b) => (a.seq < b.seq ? -1 : a.seq > b.seq ? 1 : 0));
  let prev: AuditRowLike | undefined;
  for (const r of sorted) {
    if (prev) {
      if (r.seq !== prev.seq + 1n || r.prevHash !== prev.hash) return { ok: false, brokenAt: r.seq };
    } else if (r.seq === 1n && r.prevHash !== GENESIS) {
      return { ok: false, brokenAt: r.seq };
    }
    const expect = auditHash({
      seq: r.seq,
      atMicros: r.at.microsSinceUnixEpoch,
      actorHex: r.actor.toHexString(),
      action: r.action,
      dataHash: r.dataHash,
      prevHash: r.prevHash,
    });
    if (expect !== r.hash) return { ok: false, brokenAt: r.seq };
    prev = r;
  }
  return { ok: true };
}
