import { describe, expect, it } from 'vitest';
import { ConnectionId, TimeDuration } from 'spacetimedb';
import { createModuleTestHarness, TestAuth } from 'spacetimedb/server/test-utils';
import { pubkeyOf, sha256Hex, signJoin, verifyChain } from '@redphone/shared';
import spacetimedb from './index';
import * as m from './index';

const auth = (sub: string, n: bigint) =>
  TestAuth.fromJwtPayload(JSON.stringify({ iss: 'test', sub }), new ConnectionId(n));
const A = auth('admin', 1n);
const L = auth('lead', 2n);
const IT = auth('it', 3n);
const CO = auth('counsel', 4n);
const sk = (b: number) => new Uint8Array(32).fill(b);
const hex = (n: number) => n.toString(16).padStart(2, '0');

function world() {
  const test = createModuleTestHarness(spacetimedb, m);
  const idOf = (a: typeof A) => test.withReducerTx(a, (ctx) => ctx.sender);
  test.withReducerTx(A, (ctx) => m.bootstrapAdmin(ctx, { name: 'Ada', pubkeyHex: pubkeyOf(sk(1)) }));
  const secret = (n: number) => hex(n).repeat(32);
  const join = (inviter: typeof A, who: typeof A, role: string, n: number) => {
    const s = secret(n);
    const h = sha256Hex(s);
    test.withReducerTx(inviter, (ctx) => m.createInvite(ctx, { role, name: role + n, secretHash: h }));
    const sig = signJoin(sk(n), h, idOf(who).toHexString());
    test.withReducerTx(who, (ctx) =>
      m.redeemInvite(ctx, { secretHex: s, pubkeyHex: pubkeyOf(sk(n)), sigHex: sig }),
    );
  };
  join(A, L, 'lead', 2);
  join(L, IT, 'it', 3);
  join(L, CO, 'counsel', 4);
  return { test, idOf, join, secret };
}

describe('seed', () => {
  it('bootstrap seeds playbook and assets', () => {
    const { test } = world();
    expect(test.db.playbookStep.count()).toBe(10n);
    expect(test.db.asset.count()).toBe(5n);
    expect(test.db.member.count()).toBe(4n);
  });
});

describe('redeem_invite', () => {
  it('rejects used and expired invites and bad signatures', () => {
    const { test, idOf } = world();
    const stranger = auth('stranger', 9n);
    const s = 'ab'.repeat(32);
    const h = sha256Hex(s);
    test.withReducerTx(L, (ctx) => m.createInvite(ctx, { role: 'hr', name: 'Hal', secretHash: h }));
    const sid = idOf(stranger).toHexString();
    const bad = signJoin(sk(9), sha256Hex('other'), sid);
    expect(() =>
      test.withReducerTx(stranger, (ctx) => m.redeemInvite(ctx, { secretHex: s, pubkeyHex: pubkeyOf(sk(9)), sigHex: bad })),
    ).toThrow();
    const good = signJoin(sk(9), h, sid);
    const args = { secretHex: s, pubkeyHex: pubkeyOf(sk(9)), sigHex: good };
    test.withReducerTx(stranger, (ctx) => m.redeemInvite(ctx, args));
    const second = auth('second', 10n);
    expect(() => test.withReducerTx(second, (ctx) => m.redeemInvite(ctx, args))).toThrow();

    const s2 = 'cd'.repeat(32);
    const h2 = sha256Hex(s2);
    test.withReducerTx(L, (ctx) => m.createInvite(ctx, { role: 'hr', name: 'Hel', secretHash: h2 }));
    test.clock.advance(new TimeDuration(11n * 60n * 1_000_000n));
    const sig2 = signJoin(sk(10), h2, idOf(second).toHexString());
    expect(() =>
      test.withReducerTx(second, (ctx) =>
        m.redeemInvite(ctx, { secretHex: s2, pubkeyHex: pubkeyOf(sk(10)), sigHex: sig2 }),
      ),
    ).toThrow();
  });

  it('createInvite enforces canInvite', () => {
    const { test } = world();
    expect(() =>
      test.withReducerTx(IT, (ctx) => m.createInvite(ctx, { role: 'guest', name: 'g', secretHash: sha256Hex('x') })),
    ).toThrow();
  });
});

describe('incident flow', () => {
  it('raiser cannot confirm; other lead/admin can; second reporter also activates', () => {
    const { test } = world();
    test.withReducerTx(L, (ctx) => m.raiseAlert(ctx, { isDrill: true }));
    expect(() => test.withReducerTx(L, (ctx) => m.confirmAlert(ctx, {}))).toThrow();
    test.withReducerTx(A, (ctx) => m.confirmAlert(ctx, {}));
    expect([...test.db.incident.iter()][0].status).toBe('active');
  });

  it('two distinct reporters activate', () => {
    const { test } = world();
    test.withReducerTx(IT, (ctx) => m.raiseAlert(ctx, { isDrill: false }));
    test.withReducerTx(IT, (ctx) => m.raiseAlert(ctx, { isDrill: false }));
    expect([...test.db.incident.iter()][0].status).toBe('possible');
    test.withReducerTx(CO, (ctx) => m.raiseAlert(ctx, { isDrill: false }));
    expect([...test.db.incident.iter()][0].status).toBe('active');
  });

  it('set_attack_type assigns by role, unlocks dependents, starts clocks, chain verifies', () => {
    const { test } = world();
    test.withReducerTx(IT, (ctx) => m.raiseAlert(ctx, { isDrill: false }));
    test.withReducerTx(L, (ctx) => m.confirmAlert(ctx, {}));
    test.withReducerTx(L, (ctx) => m.setAttackType(ctx, { attackType: 'ransomware' }));
    const tasks = [...test.db.task.iter()];
    expect(tasks.length).toBe(10);
    const itTasks = tasks.filter((x) => x.role === 'it');
    expect(itTasks.every((x) => x.assignedName === 'it3')).toBe(true);
    expect(tasks.find((x) => x.role === 'counsel')!.assignedName).toBe('counsel4');
    const first = itTasks.find((x) => x.status === 'open')!;
    expect(itTasks.filter((x) => x.status === 'locked').length).toBe(2);
    expect(() => test.withReducerTx(CO, (ctx) => m.completeTask(ctx, { taskId: first.id }))).toThrow();
    test.withReducerTx(IT, (ctx) => m.acceptTask(ctx, { taskId: first.id }));
    test.withReducerTx(IT, (ctx) => m.completeTask(ctx, { taskId: first.id }));
    expect([...test.db.task.iter()].filter((x) => x.role === 'it' && x.status === 'open').length).toBe(2);

    const billing = [...test.db.asset.iter()].find((a) => a.name === 'Billing DB')!;
    test.withReducerTx(IT, (ctx) => m.setAssetStatus(ctx, { assetId: billing.id, status: 'stolen' }));
    expect([...test.db.clock.iter()].map((c) => c.name).sort()).toEqual([
      'GDPR supervisory authority (72 hours)',
      'Texas AG notice (30 days)',
      'Texas individuals notice (60 days)',
    ]);
    test.withReducerTx(IT, (ctx) => m.setAssetStatus(ctx, { assetId: billing.id, status: 'stolen' }));
    expect(test.db.clock.count()).toBe(3n);
    expect(verifyChain([...test.db.auditLog.iter()])).toEqual({ ok: true });
  });
});

describe('chat views', () => {
  it('counsel channel hidden from IT', () => {
    const { test } = world();
    test.withReducerTx(CO, (ctx) => m.sendMessage(ctx, { channel: 'counsel', body: 'privileged' }));
    test.withReducerTx(IT, (ctx) => m.sendMessage(ctx, { channel: 'all', body: 'hi' }));
    expect(() => test.withReducerTx(IT, (ctx) => m.sendMessage(ctx, { channel: 'counsel', body: 'x' }))).toThrow();
    expect(m.counselMessages(test.viewContext(IT)).length).toBe(0);
    expect(m.counselMessages(test.viewContext(CO)).length).toBe(1);
    expect(m.allMessages(test.viewContext(IT)).length).toBe(1);
    expect(m.allMessages(test.viewContext(auth('nobody', 99n))).length).toBe(0);
  });
});
