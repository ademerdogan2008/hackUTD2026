import { describe, expect, it } from 'vitest';
import {
  GENESIS, ROLES, auditHash, canInvite, fingerprint, joinMessage, pubkeyOf, sha256Hex,
  signJoin, verifyChain, verifyJoin, type AuditRowLike, type Role,
} from './index';

const SK = new Uint8Array(32).fill(7);

describe('canInvite', () => {
  const allowed = (r: Role) => ROLES.filter((t) => canInvite(r, t));
  it('admin invites anyone but admin', () => {
    expect(allowed('admin')).toEqual(ROLES.filter((r) => r !== 'admin'));
  });
  it('lead invites non-admin non-lead', () => {
    expect(allowed('lead')).toEqual(['it', 'counsel', 'comms', 'executive', 'finance', 'hr', 'guest', 'observer']);
  });
  it('counsel invites guest only; others none', () => {
    expect(allowed('counsel')).toEqual(['guest']);
    for (const r of ['it', 'comms', 'executive', 'finance', 'hr', 'guest', 'observer'] as Role[]) {
      expect(allowed(r)).toEqual([]);
    }
  });
});

describe('crypto', () => {
  it('sha256Hex known vector', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('fingerprint format', () => {
    const fp = fingerprint(pubkeyOf(SK));
    expect(fp).toMatch(/^[0-9A-F]{4}( [0-9A-F]{4}){3}$/);
  });
  it('join sign/verify roundtrip and tamper', () => {
    const h = sha256Hex('secret');
    const sig = signJoin(SK, h, 'aa'.repeat(32));
    const pk = pubkeyOf(SK);
    expect(verifyJoin(pk, joinMessage(h, 'aa'.repeat(32)), sig)).toBe(true);
    expect(verifyJoin(pk, joinMessage(h, 'bb'.repeat(32)), sig)).toBe(false);
    expect(verifyJoin(pk, joinMessage(h, 'aa'.repeat(32)), 'zz')).toBe(false);
    expect(verifyJoin('nothex', 'x', sig)).toBe(false);
  });
});

function chain(n: number): AuditRowLike[] {
  const rows: AuditRowLike[] = [];
  let prev = GENESIS;
  for (let i = 1; i <= n; i++) {
    const base = { seq: BigInt(i), atMicros: BigInt(1000 * i), actorHex: 'ab', action: 'x', dataHash: 'd', prevHash: prev };
    const hash = auditHash(base);
    rows.push({
      seq: base.seq, at: { microsSinceUnixEpoch: base.atMicros }, actor: { toHexString: () => 'ab' },
      action: 'x', dataHash: 'd', prevHash: prev, hash,
    });
    prev = hash;
  }
  return rows;
}

describe('verifyChain', () => {
  it('accepts a valid chain and empty', () => {
    expect(verifyChain(chain(4))).toEqual({ ok: true });
    expect(verifyChain([])).toEqual({ ok: true });
  });
  it('detects tamper, gap, bad genesis', () => {
    const c = chain(4);
    expect(verifyChain(c.map((r, i) => (i === 2 ? { ...r, action: 'evil' } : r)))).toEqual({ ok: false, brokenAt: 3n });
    expect(verifyChain([c[0], c[2]])).toEqual({ ok: false, brokenAt: 3n });
    expect(verifyChain([{ ...c[0], prevHash: 'f'.repeat(64) }]).ok).toBe(false);
  });
});
