#!/usr/bin/env node
// Automated checks for the tripwire relay. Run: node test.mjs
// Part 1: mock mode. Part 2: spacetime mode against an in-process fake
// SpacetimeDB HTTP server (asserts reducer names, args and Bearer header).
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 20000 + Math.floor(Math.random() * 20000);
const KEY = 'test-key-' + Math.random().toString(36).slice(2);
const PASSWORD = 'Sup3r-Secret-PW-' + Math.random().toString(36).slice(2);
const BASE = `http://127.0.0.1:${PORT}`;

let stdout = '';
let failures = 0;
let passes = 0;
function check(name, cond, extra = '') {
  if (cond) { passes++; console.log(`  ok   ${name}`); }
  else { failures++; console.log(`  FAIL ${name} ${extra}`); }
}

const baseEnv = { ...process.env };
delete baseEnv.DEMO_SOURCE_IP;
const child = spawn(process.execPath, [path.join(HERE, 'relay.mjs')], {
  // DEMO_KEY etc. passed explicitly; a local .env never overrides set vars.
  env: { ...baseEnv, PORT: String(PORT), DEMO_KEY: KEY, MODE: 'mock', ARM_STEP_MS: '20', RELAY_PUBLIC_URL: BASE },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', (d) => { stdout += d; });
child.stderr.on('data', (d) => { stdout += d; });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitUp() {
  for (let i = 0; i < 100; i++) {
    if (stdout.includes('listening')) return;
    await sleep(50);
  }
  throw new Error('relay did not start:\n' + stdout);
}
const hitCount = async () => (await (await fetch(`${BASE}/api/hits?key=${KEY}`)).json()).count;

// Collect SSE events until predicate or timeout.
async function collectSse(untilType, timeoutMs = 5000) {
  const ctrl = new AbortController();
  const res = await fetch(`${BASE}/api/events?key=${KEY}`, { signal: ctrl.signal });
  const events = [];
  const done = (async () => {
    const dec = new TextDecoder();
    let buf = '';
    try {
      for await (const chunk of res.body) {
        buf += dec.decode(chunk, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2);
          const line = block.split('\n').find((l) => l.startsWith('data: '));
          if (line) {
            const e = JSON.parse(line.slice(6));
            events.push(e);
            if (e.type === untilType) { ctrl.abort(); return; }
          }
        }
      }
    } catch { /* aborted */ }
  })();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  return { events, done: done.then(() => clearTimeout(timer)) };
}

try {
  await waitUp();
  console.log(`relay up on ${BASE}`);

  // --- page + static
  const page = await fetch(`${BASE}/`);
  const html = await page.text();
  check('GET / serves intranet page', page.status === 200 && html.includes('Halvorsen &amp; Pike Intranet'));
  check('no X-Powered-By header', !page.headers.get('x-powered-by'));

  // syntax-check inline script
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const tmp = path.join(os.tmpdir(), `tw-page-${PORT}.js`);
  fs.writeFileSync(tmp, script);
  let syntaxOk = true;
  try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); } catch (e) { syntaxOk = false; console.log(String(e.stderr)); }
  fs.unlinkSync(tmp);
  check('inline page script passes node --check', syntaxOk);

  // --- auth
  check('arm wrong key -> 401', (await fetch(`${BASE}/api/arm?key=nope`, { method: 'POST' })).status === 401);
  check('arm no key -> 401', (await fetch(`${BASE}/api/arm`, { method: 'POST' })).status === 401);
  check('events wrong key -> 401', (await fetch(`${BASE}/api/events?key=nope`)).status === 401);
  check('fire wrong key -> 401', (await fetch(`${BASE}/api/fire`, { method: 'POST', headers: { 'x-demo-key': 'nope' }, body: '{"id":"tw_partner_comp"}' })).status === 401);
  check('reset wrong key -> 401', (await fetch(`${BASE}/api/reset?key=nope`, { method: 'POST' })).status === 401);
  check('hits wrong key -> 401', (await fetch(`${BASE}/api/hits?key=nope`)).status === 401);
  check('files wrong key -> 401', (await fetch(`${BASE}/api/files?key=nope`)).status === 401);

  // --- arm with SSE
  const sse = await collectSse('done');
  await sleep(100);
  const armRes = await fetch(`${BASE}/api/arm`, { method: 'POST', headers: { 'x-demo-key': KEY } });
  const arm = await armRes.json();
  await sse.done;
  check('arm right key -> 200 with 3 decoys', armRes.status === 200 && arm.decoys.length === 3);
  const texts = sse.events.map((e) => e.text).filter(Boolean);
  check('SSE: generating tokens step', texts[0] === 'Generating secret tokens…');
  check('SSE: planting steps x3', texts.filter((t) => t.startsWith('Planting ')).length === 3);
  check('SSE: armed steps x3', texts.filter((t) => t.startsWith('✓ ') && t.includes('registered in Flare')).length === 3);
  check('SSE: final step', texts.at(-1) === 'All 3 tripwires armed. Only the token hashes are stored.');
  check('SSE: planting text format', texts.includes('Planting Partner_Compensation_2026.xlsx in Shared drives…'));

  const byId = Object.fromEntries(arm.decoys.map((d) => [d.tripwireId, d]));
  const tokenOf = (d) => d.url.split('/')[2];
  const docTok = tokenOf(byId.tw_partner_comp);
  const accTok = tokenOf(byId.tw_backup_admin);
  const keyTok = tokenOf(byId.tw_billing_keys);
  check('tokens are >= 32 chars base64url', [docTok, accTok, keyTok].every((t) => /^[A-Za-z0-9_-]{32,}$/.test(t)));
  check('raw tokens not logged', ![docTok, accTok, keyTok].some((t) => stdout.includes(t)));

  // attacker listing has no tripwire metadata
  const pub = await (await fetch(`${BASE}/api/decoys`)).json();
  const pubStr = JSON.stringify(pub);
  check('/api/decoys lists 3 files', pub.files.length === 3);
  check('/api/decoys has no tripwire metadata', !/tripwire|label|hitKind|armedAt/i.test(pubStr));

  // decoy contents
  const docPage = await fetch(`${BASE}/d/${docTok}/Partner_Compensation_2026.xlsx`);
  const docHtml = await docPage.text();
  check('decoy document page contains beacon', docPage.status === 200 && docHtml.includes(`<img src="/t/${docTok}"`));
  const readme = await (await fetch(`${BASE}${byId.tw_backup_admin.url}`)).text();
  check('README mentions svc_backup_admin + console URL', readme.includes('svc_backup_admin') && readme.includes(`${BASE}/login/${accTok}`));
  const keys = await (await fetch(`${BASE}${byId.tw_billing_keys.url}`)).text();
  check('keys file has bk_live_ key + curl example', keys.includes(`bk_live_${keyTok}`) && keys.includes(`curl`) && keys.includes(`${BASE}/k/${keyTok}/v1/invoices`));
  check('opening decoy pages records no hit', (await hitCount()) === 0);

  // --- hits
  const g = await fetch(`${BASE}/t/${docTok}`, { headers: { 'user-agent': 'TestAgent/1.0' } });
  const gif = Buffer.from(await g.arrayBuffer());
  check('beacon returns GIF', g.status === 200 && g.headers.get('content-type') === 'image/gif' && gif.subarray(0, 3).toString() === 'GIF');
  check('beacon -> 1 hit', (await hitCount()) === 1);
  await fetch(`${BASE}/t/${docTok}`);
  check('repeat beacon within 5 s not double-counted', (await hitCount()) === 1);

  const lg = await fetch(`${BASE}/login/${accTok}`);
  check('GET login page -> 200 Backup Console, no hit', lg.status === 200 && (await lg.text()).includes('Backup Console') && (await hitCount()) === 1);
  const lp = await fetch(`${BASE}/login/${accTok}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `username=svc_backup_admin&password=${encodeURIComponent(PASSWORD)}`,
  });
  const lpBody = await lp.text();
  check('POST login -> "Invalid username or password."', lpBody.includes('Invalid username or password.'));
  check('POST login body does not echo password', !lpBody.includes(PASSWORD));
  check('POST login -> 1 more hit', (await hitCount()) === 2);

  const k = await fetch(`${BASE}/k/${keyTok}/v1/invoices`, { headers: { authorization: `Bearer bk_live_${keyTok}` } });
  const kj = await k.json();
  check('key use -> 401 invalid_api_key', k.status === 401 && kj.error === 'invalid_api_key');
  check('key use -> 1 more hit', (await hitCount()) === 3);

  const hits = (await (await fetch(`${BASE}/api/hits?key=${KEY}`)).json()).hits;
  check('hit kinds correct', JSON.stringify(hits.map((h) => h.kind)) === JSON.stringify(['document_opened', 'login_attempt', 'key_used']));
  check('hit record has only allowed fields', hits.every((h) => Object.keys(h).sort().join() === 'kind,sourceIp,time,tripwireId,userAgent'));
  check('user agent captured', hits[0].userAgent === 'TestAgent/1.0');
  check('loopback source reported as DEMO_SOURCE_IP 10.20.4.17', hits.every((h) => h.sourceIp === '10.20.4.17'));
  check('log shows reported and actual loopback IP', /from 10\.20\.4\.17 \(actual (::ffff:)?127\.0\.0\.1\)/.test(stdout));

  // --- unknown tokens
  const fake = 'A'.repeat(32);
  const u1 = await fetch(`${BASE}/t/${fake}`);
  const u2 = await fetch(`${BASE}/login/${fake}`, { method: 'POST', body: 'password=x' });
  const u3 = await fetch(`${BASE}/k/${fake}/v1/invoices`);
  const u4 = await fetch(`${BASE}/d/${fake}/x.txt`);
  check('unknown tokens -> 404', [u1, u2, u3, u4].every((r) => r.status === 404));
  check('unknown tokens record no hit', (await hitCount()) === 3);
  check('wrong-kind token (doc token on /k) -> 404', (await fetch(`${BASE}/k/${docTok}/v1`)).status === 404);

  // --- fire (simulation profiles)
  const fire = (body) => fetch(`${BASE}/api/fire?key=${KEY}`, { method: 'POST', body: JSON.stringify(body) });
  const lastHit = async () => (await (await fetch(`${BASE}/api/hits?key=${KEY}`)).json()).hits.at(-1);
  const fr = await fire({ id: 'tw_billing_keys' });
  const frj = await fr.json();
  check('fire by id -> 200 and hit', fr.status === 200 && frj.ok && frj.mode === 'mock' && frj.sent === false && (await hitCount()) === 4);
  let h = await lastHit();
  check('fire default profile = attacker (10.20.4.17, Windows Chrome)', frj.profile === 'attacker' && h.sourceIp === '10.20.4.17' && /Windows NT.*Chrome\//.test(h.userAgent) && !/Edg\//.test(h.userAgent));
  const fi = await fire({ id: 'tw_partner_comp', profile: 'it_staff' });
  h = await lastHit();
  check('fire it_staff -> 10.10.2.5, normal UA', fi.status === 200 && h.sourceIp === '10.10.2.5' && h.tripwireId === 'tw_partner_comp' && /Mozilla/.test(h.userAgent) && !h.userAgent.includes('HP-IndexBot'));
  const fx = await fire({ id: 'tw_partner_comp', profile: 'indexer' });
  h = await lastHit();
  check('fire indexer -> 10.0.0.40, HP-IndexBot/2.1 (no debounce on fire)', fx.status === 200 && h.sourceIp === '10.0.0.40' && h.userAgent === 'HP-IndexBot/2.1' && (await hitCount()) === 6);
  check('fire unknown profile -> 400', (await fire({ id: 'tw_partner_comp', profile: 'ghost' })).status === 400);
  check('fire unknown id -> 404', (await fetch(`${BASE}/api/fire?key=${KEY}`, { method: 'POST', body: '{"id":"nope"}' })).status === 404);
  check('fire logs simulated profile', stdout.includes('(simulated it_staff)') && stdout.includes('(simulated indexer)'));

  // --- re-arm kills old tokens
  const arm2 = await (await fetch(`${BASE}/api/arm?key=${KEY}`, { method: 'POST' })).json();
  const newDocTok = tokenOf(arm2.decoys.find((d) => d.tripwireId === 'tw_partner_comp'));
  check('re-arm issues fresh tokens', newDocTok !== docTok);
  const old = await Promise.all([
    fetch(`${BASE}/t/${docTok}`), fetch(`${BASE}/login/${accTok}`), fetch(`${BASE}/k/${keyTok}/v1/invoices`),
    fetch(`${BASE}/d/${docTok}/Partner_Compensation_2026.xlsx`),
  ]);
  check('old tokens -> 404 after re-arm', old.every((r) => r.status === 404));
  check('old tokens record no hit', (await hitCount()) === 6);
  check('new token works', (await fetch(`${BASE}/t/${newDocTok}`)).status === 200 && (await hitCount()) === 7);

  // --- reset
  const rs = await fetch(`${BASE}/api/reset?key=${KEY}`, { method: 'POST' });
  check('reset -> 200', rs.status === 200 && (await rs.json()).ok === true);
  check('after reset: no decoys, no hits, token dead',
    (await (await fetch(`${BASE}/api/decoys`)).json()).files.length === 0 && (await hitCount()) === 0 &&
    (await fetch(`${BASE}/t/${newDocTok}`)).status === 404);

  // --- logging
  check('stdout logs TRIPWIRE HIT line', /TRIPWIRE HIT tw_partner_comp document_opened from 10\.20\.4\.17/.test(stdout));
  check('mock mode makes no SpacetimeDB calls', !stdout.includes('[stdb]'));
  check('password never appears in stdout', !stdout.includes(PASSWORD));
} catch (err) {
  failures++;
  console.error('test error:', err);
} finally {
  child.kill();
}

// ================================================================ part 2
// Spacetime mode against a fake SpacetimeDB HTTP API.
console.log('\n--- spacetime mode (fake SpacetimeDB) ---');
const calls = [];
const fake = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    let args;
    try { args = JSON.parse(body); } catch { args = Symbol('bad-json'); }
    calls.push({ method: req.method, url: req.url, auth: req.headers.authorization, type: req.headers['content-type'], args });
    res.writeHead(200); res.end();
  });
});
await new Promise((r) => fake.listen(0, '127.0.0.1', r));
const FAKE = `http://127.0.0.1:${fake.address().port}`;
const PORT2 = PORT + 1;
const BASE2 = `http://127.0.0.1:${PORT2}`;
let out2 = '';
const env2 = { ...baseEnv, PORT: String(PORT2), DEMO_KEY: KEY, ARM_STEP_MS: '5', RELAY_PUBLIC_URL: BASE2,
  STDB_HOST: FAKE, STDB_DB: 'fake-db', STDB_TOKEN: 'fake', STDB_ADMIN_TOKEN: '', MODE: '' };
const child2 = spawn(process.execPath, [path.join(HERE, 'relay.mjs')], { env: env2, stdio: ['ignore', 'pipe', 'pipe'] });
child2.stdout.on('data', (d) => { out2 += d; });
child2.stderr.on('data', (d) => { out2 += d; });
const waitFor = async (fn, ms = 3000) => { for (let i = 0; i < ms / 25; i++) { if (fn()) return true; await sleep(25); } return false; };
const named = (n) => calls.filter((c) => c.url === `/v1/database/fake-db/call/${n}`);
try {
  check('relay starts in spacetime mode when a token is set (MODE unset)', await waitFor(() => out2.includes('listening') && out2.includes('mode=spacetime')), out2);
  check('register_relay [] called at startup', named('register_relay').length === 1 && JSON.stringify(named('register_relay')[0].args) === '[]' && calls[0].url.endsWith('/register_relay'));
  check('every call: POST, Bearer fake, JSON', calls.length > 0 && calls.every((c) => c.method === 'POST' && c.auth === 'Bearer fake' && c.type === 'application/json'));
  check('register_relay OK logged', /\[stdb\] OK\s+register_relay/.test(out2));

  const arm = await (await fetch(`${BASE2}/api/arm?key=${KEY}`, { method: 'POST' })).json();
  const plants = named('plant_tripwire');
  check('plant_tripwire called 3x', plants.length === 3);
  const p0 = plants.find((c) => c.args[0] === 'tw_partner_comp');
  check('plant_tripwire has 6 args [id,label,kind,assetId,fileName,tokenHash]',
    plants.every((c) => Array.isArray(c.args) && c.args.length === 6 && /^[0-9a-f]{64}$/.test(c.args[5])) &&
    JSON.stringify(p0.args.slice(0, 5)) === JSON.stringify(['tw_partner_comp', 'Partner compensation spreadsheet', 'document', 'a_shares', 'Partner_Compensation_2026.xlsx']));
  const docTok = arm.decoys.find((d) => d.tripwireId === 'tw_partner_comp').url.split('/')[2];
  check('plant tokenHash = sha256(token)', p0.args[5] === (await import('node:crypto')).createHash('sha256').update(docTok).digest('hex'));

  await fetch(`${BASE2}/t/${docTok}`, { headers: { 'user-agent': 'StageBrowser/1.0' } });
  await waitFor(() => named('record_hit').length === 1);
  check('beacon -> record_hit [hash, document_opened, 10.20.4.17, ua]',
    JSON.stringify(named('record_hit')[0]?.args) === JSON.stringify([p0.args[5], 'document_opened', '10.20.4.17', 'StageBrowser/1.0']));

  const f = await fetch(`${BASE2}/api/fire?key=${KEY}`, { method: 'POST', body: JSON.stringify({ id: 'tw_partner_comp', profile: 'it_staff' }) });
  const fj = await f.json();
  const rh = named('record_hit');
  check('fire it_staff -> record_hit with 10.10.2.5, sent=true', f.status === 200 && fj.sent === true && fj.mode === 'spacetime' &&
    rh.length === 2 && rh[1].args[0] === p0.args[5] && rh[1].args[1] === 'document_opened' && rh[1].args[2] === '10.10.2.5');

  const r = await fetch(`${BASE2}/api/reset?key=${KEY}`, { method: 'POST' });
  const rj = await r.json();
  check('reset -> reset_tripwire_demo []', rj.ok && rj.sent === true && named('reset_tripwire_demo').length === 1 && JSON.stringify(named('reset_tripwire_demo')[0].args) === '[]');
  check('only expected reducers called', calls.every((c) => /\/call\/(register_relay|plant_tripwire|record_hit|reset_tripwire_demo)$/.test(c.url)));
  check('token never logged', !/\bfake\b/.test(out2.replace(/fake-db/g, '')));
} catch (err) {
  failures++;
  console.error('test error (part 2):', err);
} finally {
  child2.kill();
  fake.close();
}

console.log(`\n${passes} passed, ${failures} failed`);
if (failures) { console.log('\n--- relay output ---\n' + stdout + '\n--- relay output (spacetime) ---\n' + out2); }
process.exit(failures ? 1 : 0);
