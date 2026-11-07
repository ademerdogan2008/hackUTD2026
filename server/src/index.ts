import { schema, table, t, SenderError } from 'spacetimedb/server';
import { verifySpikeSignature } from '@redphone/shared';

const MAX_SEED_PER_CALL = 500;
const MAX_ROWS_PER_OWNER = 1000;

// Base tables are private; clients only see the per-sender views below.
const spikeRow = table(
  { name: 'spike_row' },
  {
    id: t.u64().primaryKey().autoInc(),
    owner: t.identity().index('btree'),
    n: t.u32(),
    createdAt: t.timestamp(),
  },
);

const spikeVerifyResult = table(
  { name: 'spike_verify_result' },
  {
    owner: t.identity().primaryKey(),
    ok: t.bool(),
    checkedAt: t.timestamp(),
  },
);

const spacetimedb = schema({ spikeRow, spikeVerifyResult });
export default spacetimedb;

export const spikeSeed = spacetimedb.reducer({ count: t.u32() }, (ctx, { count }) => {
  if (count < 1 || count > MAX_SEED_PER_CALL) {
    throw new SenderError(`count must be 1..${MAX_SEED_PER_CALL}`);
  }
  let existing = 0;
  for (const _ of ctx.db.spikeRow.owner.filter(ctx.sender)) existing++;
  if (existing + count > MAX_ROWS_PER_OWNER) {
    throw new SenderError(`per-owner cap ${MAX_ROWS_PER_OWNER} exceeded`);
  }
  for (let i = 0; i < count; i++) {
    ctx.db.spikeRow.insert({ id: 0n, owner: ctx.sender, n: i, createdAt: ctx.timestamp });
  }
});

export const spikeTouch = spacetimedb.reducer((ctx) => {
  const row = [...ctx.db.spikeRow.owner.filter(ctx.sender)][0];
  if (!row) throw new SenderError('no rows to touch');
  ctx.db.spikeRow.id.update({ ...row, n: row.n + 1 });
});

export const spikeClear = spacetimedb.reducer((ctx) => {
  const rows = [...ctx.db.spikeRow.owner.filter(ctx.sender)];
  for (const row of rows) ctx.db.spikeRow.id.delete(row.id);
});

export const spikeVerify = spacetimedb.reducer(
  { pubkeyHex: t.string(), message: t.string(), sigHex: t.string() },
  (ctx, { pubkeyHex, message, sigHex }) => {
    if (pubkeyHex.length > 64 || sigHex.length > 128 || message.length > 256) {
      throw new SenderError('input too long');
    }
    const ok = verifySpikeSignature(pubkeyHex, message, sigHex);
    const prev = ctx.db.spikeVerifyResult.owner.find(ctx.sender);
    if (prev) {
      ctx.db.spikeVerifyResult.owner.update({ ...prev, ok, checkedAt: ctx.timestamp });
    } else {
      ctx.db.spikeVerifyResult.insert({ owner: ctx.sender, ok, checkedAt: ctx.timestamp });
    }
  },
);

export const mySpikeRows = spacetimedb.view(
  { name: 'my_spike_rows', public: true },
  t.array(spikeRow.rowType),
  (ctx) => [...ctx.db.spikeRow.owner.filter(ctx.sender)],
);

export const myVerifyResults = spacetimedb.view(
  { name: 'my_verify_results', public: true },
  t.array(spikeVerifyResult.rowType),
  (ctx) => {
    const r = ctx.db.spikeVerifyResult.owner.find(ctx.sender);
    return r ? [r] : [];
  },
);
