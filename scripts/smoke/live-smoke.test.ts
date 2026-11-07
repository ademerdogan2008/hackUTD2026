// Live smoke test against the published dev database on Maincloud.
// Exercises the same client path as the app (generated bindings, compression 'none',
// per-sender views, reducers, Ed25519 verify) from Node instead of a phone.
// Run: npm run smoke   (requires network; no Spacetime login needed — uses an anonymous identity)
import { randomBytes } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { bytesToHex } from '@noble/hashes/utils.js';
import { signSpikeMessage } from '../../shared/src/index';
import { DbConnection } from '../../app/src/module_bindings';

const HOST = process.env.RP_SMOKE_HOST ?? 'wss://maincloud.spacetimedb.com';
const DB = process.env.RP_SMOKE_DB ?? 'red-phone-6h786-dev';
const TIMEOUT = 20_000;

type Conn = InstanceType<typeof DbConnection>;

function connect(token?: string): Promise<{ conn: Conn; identityHex: string; token: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('connect timeout')), TIMEOUT);
    DbConnection.builder()
      .withUri(HOST)
      .withDatabaseName(DB)
      .withToken(token)
      .withCompression('none')
      .onConnect((conn, identity, tok) => {
        clearTimeout(timer);
        resolve({ conn, identityHex: identity.toHexString(), token: tok });
      })
      .onConnectError((_ctx, err) => {
        clearTimeout(timer);
        reject(err);
      })
      .build();
  });
}

function subscribe(conn: Conn): Promise<void> {
  return new Promise((resolve, reject) => {
    conn
      .subscriptionBuilder()
      .onApplied(() => resolve())
      .onError((ctx) => reject(new Error(String((ctx as { event?: unknown }).event ?? 'subscription error'))))
      .subscribe(['SELECT * FROM my_spike_rows', 'SELECT * FROM my_verify_results']);
  });
}

function waitFor(cond: () => boolean, label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (cond()) return resolve();
      if (Date.now() - start > TIMEOUT) return reject(new Error(`timeout waiting for ${label}`));
      setTimeout(tick, 100);
    };
    tick();
  });
}

const open: Conn[] = [];
afterAll(() => {
  for (const c of open) c.disconnect();
});

describe(`live smoke: ${DB}`, () => {
  let first: Awaited<ReturnType<typeof connect>>;

  it('connects with compression none and subscribes to per-sender views', async () => {
    first = await connect();
    open.push(first.conn);
    await subscribe(first.conn);
    expect(first.identityHex).toMatch(/^[0-9a-f]{64}$/);
    expect(first.conn.db.mySpikeRows.count()).toBe(0n);
  }, TIMEOUT);

  it('seeds 150 rows and receives them live', async () => {
    await first.conn.reducers.spikeSeed({ count: 150 });
    await waitFor(() => first.conn.db.mySpikeRows.count() === 150n, '150 rows');
    expect(first.conn.db.mySpikeRows.count()).toBe(150n);
  }, TIMEOUT);

  it('touch updates a row live', async () => {
    const before = [...first.conn.db.mySpikeRows.iter()].reduce((s, r) => s + r.n, 0);
    let updated = false;
    first.conn.db.mySpikeRows.onUpdate(() => {
      updated = true;
    });
    await first.conn.reducers.spikeTouch();
    await waitFor(() => updated, 'onUpdate');
    const after = [...first.conn.db.mySpikeRows.iter()].reduce((s, r) => s + r.n, 0);
    expect(after).toBe(before + 1);
  }, TIMEOUT);

  it('server verifies a real Ed25519 signature (true) and rejects a tampered one (false)', async () => {
    const sk = new Uint8Array(randomBytes(32));
    const { pubkeyHex, message, sigHex } = signSpikeMessage(sk, bytesToHex(new Uint8Array(randomBytes(16))));
    const result = () => [...first.conn.db.myVerifyResults.iter()][0];

    await first.conn.reducers.spikeVerify({ pubkeyHex, message, sigHex });
    await waitFor(() => result()?.ok === true, 'verify true');

    const tampered = message.slice(0, -1) + (message.endsWith('0') ? '1' : '0');
    await first.conn.reducers.spikeVerify({ pubkeyHex, message: tampered, sigHex });
    await waitFor(() => result()?.ok === false, 'verify false');
  }, TIMEOUT);

  it('a different identity sees none of these rows', async () => {
    const other = await connect();
    open.push(other.conn);
    await subscribe(other.conn);
    expect(other.identityHex).not.toBe(first.identityHex);
    expect(other.conn.db.mySpikeRows.count()).toBe(0n);
  }, TIMEOUT);

  it('reconnecting with the saved token restores the same identity and rows (cold restart)', async () => {
    first.conn.disconnect();
    const again = await connect(first.token);
    open.push(again.conn);
    await subscribe(again.conn);
    expect(again.identityHex).toBe(first.identityHex);
    expect(again.conn.db.mySpikeRows.count()).toBe(150n);
    await again.conn.reducers.spikeClear();
    await waitFor(() => again.conn.db.mySpikeRows.count() === 0n, 'clear');
  }, TIMEOUT);
});
