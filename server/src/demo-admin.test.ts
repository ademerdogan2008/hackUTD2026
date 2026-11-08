import { describe, expect, it } from 'vitest';
import { ConnectionId } from 'spacetimedb';
import { createModuleTestHarness, TestAuth } from 'spacetimedb/server/test-utils';
import { pubkeyOf } from '@redphone/shared';
import spacetimedb from './index';
import * as m from './index';

const auth = (sub: string, n: bigint) =>
  TestAuth.fromJwtPayload(JSON.stringify({ iss: 'test', sub }), new ConnectionId(n));

describe('demo_join_admin', () => {
  it('lets a non-member join as admin even after bootstrap, once', () => {
    const test = createModuleTestHarness(spacetimedb, m);
    const A = auth('a', 1n);
    const B = auth('b', 2n);
    test.withReducerTx(A, (ctx) => m.bootstrapAdmin(ctx, { name: 'Ada', pubkeyHex: pubkeyOf(new Uint8Array(32).fill(1)) }));
    test.withReducerTx(B, (ctx) => m.demoJoinAdmin(ctx, { name: 'Bo', pubkeyHex: pubkeyOf(new Uint8Array(32).fill(2)) }));
    const roles = [...test.db.member.iter()].map((r) => `${r.name}:${r.role}`).sort();
    expect(roles).toEqual(['Ada:admin', 'Bo:admin']);
    expect(() =>
      test.withReducerTx(B, (ctx) => m.demoJoinAdmin(ctx, { name: 'Bo', pubkeyHex: pubkeyOf(new Uint8Array(32).fill(2)) })),
    ).toThrow(/already a member/);
  });
});
