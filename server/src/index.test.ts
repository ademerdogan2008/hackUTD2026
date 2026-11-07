import { describe, expect, it } from 'vitest';
import { ConnectionId } from 'spacetimedb';
import { createModuleTestHarness, TestAuth } from 'spacetimedb/server/test-utils';
import { SPIKE_TEST_VECTOR as V } from '@redphone/shared';
import spacetimedb, * as m from './index';

const alice = TestAuth.fromJwtPayload(JSON.stringify({ iss: 'test', sub: 'alice' }), new ConnectionId(1n));
const bob = TestAuth.fromJwtPayload(JSON.stringify({ iss: 'test', sub: 'bob' }), new ConnectionId(2n));

function setup() {
  const test = createModuleTestHarness(spacetimedb, m);
  const who = (auth: typeof alice) => test.withReducerTx(auth, (ctx) => ctx.sender);
  return { test, aliceId: who(alice), bobId: who(bob) };
}

describe('spike_seed', () => {
  it('seeds rows owned by the caller and isolates owners', () => {
    const { test, aliceId, bobId } = setup();
    test.withReducerTx(alice, (ctx) => m.spikeSeed(ctx, { count: 150 }));
    expect(test.db.spikeRow.count()).toBe(150n);
    for (const r of test.db.spikeRow.iter()) expect(r.owner.isEqual(aliceId)).toBe(true);
    test.withReducerTx(bob, (ctx) => m.spikeSeed(ctx, { count: 2 }));
    const bobRows = test.withReducerTx(bob, (ctx) => [...ctx.db.spikeRow.owner.filter(ctx.sender)]);
    expect(bobRows.length).toBe(2);
    expect(bobRows.every((r) => r.owner.isEqual(bobId))).toBe(true);
  });

  it('rejects count 0 and 501', () => {
    const { test } = setup();
    expect(() => test.withReducerTx(alice, (ctx) => m.spikeSeed(ctx, { count: 0 }))).toThrow();
    expect(() => test.withReducerTx(alice, (ctx) => m.spikeSeed(ctx, { count: 501 }))).toThrow();
    expect(test.db.spikeRow.count()).toBe(0n);
  });

  it('enforces the 1000 per-owner cap', () => {
    const { test } = setup();
    test.withReducerTx(alice, (ctx) => m.spikeSeed(ctx, { count: 500 }));
    test.withReducerTx(alice, (ctx) => m.spikeSeed(ctx, { count: 500 }));
    expect(test.db.spikeRow.count()).toBe(1000n);
    expect(() => test.withReducerTx(alice, (ctx) => m.spikeSeed(ctx, { count: 1 }))).toThrow();
    expect(test.db.spikeRow.count()).toBe(1000n);
  });
});

describe('spike_touch / spike_clear', () => {
  it('touch increments exactly one of the callers rows, never bobs', () => {
    const { test } = setup();
    test.withReducerTx(alice, (ctx) => m.spikeSeed(ctx, { count: 3 }));
    test.withReducerTx(bob, (ctx) => m.spikeSeed(ctx, { count: 3 }));
    const before = [...test.db.spikeRow.iter()].map((r) => ({ id: r.id, n: r.n }));
    test.withReducerTx(alice, (ctx) => m.spikeTouch(ctx, {}));
    const after = [...test.db.spikeRow.iter()];
    const changed = after.filter((r) => before.find((b) => b.id === r.id)!.n !== r.n);
    expect(changed.length).toBe(1);
    const bobRows = test.withReducerTx(bob, (ctx) => [...ctx.db.spikeRow.owner.filter(ctx.sender)]);
    expect(changed[0].owner.isEqual(bobRows[0].owner)).toBe(false);
  });

  it('touch with no rows throws', () => {
    const { test } = setup();
    expect(() => test.withReducerTx(alice, (ctx) => m.spikeTouch(ctx, {}))).toThrow();
  });

  it('clear deletes the callers rows only', () => {
    const { test } = setup();
    test.withReducerTx(alice, (ctx) => m.spikeSeed(ctx, { count: 4 }));
    test.withReducerTx(bob, (ctx) => m.spikeSeed(ctx, { count: 2 }));
    test.withReducerTx(alice, (ctx) => m.spikeClear(ctx, {}));
    expect(test.db.spikeRow.count()).toBe(2n);
  });
});

describe('spike_verify', () => {
  const args = { pubkeyHex: V.publicKeyHex, message: V.message, sigHex: V.signatureHex };

  it('stores ok=true for the shared vector, then ok=false when tampered (one row)', () => {
    const { test, aliceId } = setup();
    test.withReducerTx(alice, (ctx) => m.spikeVerify(ctx, args));
    let rows = [...test.db.spikeVerifyResult.iter()];
    expect(rows.length).toBe(1);
    expect(rows[0].owner.isEqual(aliceId)).toBe(true);
    expect(rows[0].ok).toBe(true);
    test.withReducerTx(alice, (ctx) =>
      m.spikeVerify(ctx, { ...args, message: V.message.slice(0, -1) + '0' }),
    );
    rows = [...test.db.spikeVerifyResult.iter()];
    expect(rows.length).toBe(1);
    expect(rows[0].ok).toBe(false);
  });

  it('stores ok=false for a message without the prefix', () => {
    const { test } = setup();
    test.withReducerTx(alice, (ctx) => m.spikeVerify(ctx, { ...args, message: 'nope|' + V.nonceHex }));
    expect([...test.db.spikeVerifyResult.iter()][0].ok).toBe(false);
  });

  it('throws on oversize inputs', () => {
    const { test } = setup();
    expect(() =>
      test.withReducerTx(alice, (ctx) => m.spikeVerify(ctx, { ...args, pubkeyHex: 'a'.repeat(65) })),
    ).toThrow();
    expect(() =>
      test.withReducerTx(alice, (ctx) => m.spikeVerify(ctx, { ...args, message: 'a'.repeat(257) })),
    ).toThrow();
    expect(() =>
      test.withReducerTx(alice, (ctx) => m.spikeVerify(ctx, { ...args, sigHex: 'a'.repeat(129) })),
    ).toThrow();
  });
});
