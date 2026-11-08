#!/usr/bin/env node
// Flare tripwire relay.
// Serves the fake "Halvorsen & Pike LLP" intranet, plants decoy files with
// secret tokens, detects decoy use, and reports hits to SpacetimeDB.
//
// Guardrails: detect only (never touch the attacker machine), collect the
// minimum (tripwire id, kind, time, source IP, trimmed user agent), never read
// or log typed passwords, and keep attacker-facing responses plain.
//
// No npm dependencies. Node >= 18 (uses global fetch).

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- env
function loadDotEnv(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return; }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const k = line.slice(0, eq).trim().replace(/^export\s+/, '');
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
loadDotEnv(path.join(HERE, '.env'));

// Read one key from the repo root .env, the same way scripts/rp-spacetime.sh
// env_get does: first line starting with KEY=, CR stripped, quotes stripped.
// Values are never exported to process.env or logged.
function rootEnvGet(key) {
  let text;
  try { text = fs.readFileSync(path.join(HERE, '..', '.env'), 'utf8'); } catch { return ''; }
  for (let line of text.split('\n')) {
    line = line.replace(/\r$/, '');
    if (!line.startsWith(key + '=')) continue;
    let v = line.slice(key.length + 1);
    v = v.replace(/^"/, '').replace(/"$/, '');
    v = v.replace(/^'/, '').replace(/'$/, '');
    return v;
  }
  return '';
}

const PORT = Number(process.env.PORT || 8787);
const RELAY_PUBLIC_URL = (process.env.RELAY_PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
const STDB_HOST = (process.env.STDB_HOST || 'https://maincloud.spacetimedb.com').replace(/\/+$/, '');
const STDB_DB = process.env.STDB_DB || rootEnvGet('RP_DB_DEV') || 'red-phone-6h786-dev';
// One token for every reducer call. STDB_TOKEN wins; else root .env SPACETIME_TOKEN.
const STDB_TOKEN = process.env.STDB_TOKEN || rootEnvGet('SPACETIME_TOKEN') || '';
// Optional override for plant_tripwire / reset_tripwire_demo only.
const STDB_ADMIN_TOKEN = process.env.STDB_ADMIN_TOKEN || STDB_TOKEN;
const MODE = (() => {
  const m = (process.env.MODE || '').toLowerCase();
  if (m === 'spacetime' || m === 'mock') return m;
  return STDB_TOKEN ? 'spacetime' : 'mock';
})();
// Stage realism: hits from loopback are reported with this IP (empty disables).
const DEMO_SOURCE_IP = process.env.DEMO_SOURCE_IP ?? '10.20.4.17';
const ATTACKER_IP = DEMO_SOURCE_IP || '10.20.4.17';
const ARM_STEP_MS = Number(process.env.ARM_STEP_MS ?? 700);
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const DEBOUNCE_MS = 5000;

let DEMO_KEY = process.env.DEMO_KEY || '';

// ---------------------------------------------------------------- SpacetimeDB HTTP
async function callReducer(reducer, args, token, who) {
  if (!STDB_DB) { console.error(`[stdb] ${reducer}: STDB_DB not set`); return false; }
  if (!token) { console.error(`[stdb] ${reducer}: ${who} token not set`); return false; }
  const url = `${STDB_HOST}/v1/database/${encodeURIComponent(STDB_DB)}/call/${reducer}`;
  const auth = 'Bearer ' + token;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    if (res.ok) {
      console.log(`[stdb] OK   ${reducer} (${who}) -> ${res.status}${text ? ' ' + text.slice(0, 300) : ''}`);
      return true;
    }
    console.error(`[stdb] FAIL ${reducer} (${who}) -> ${res.status} ${text.slice(0, 500)}`);
    return false;
  } catch (err) {
    console.error(`[stdb] FAIL ${reducer} (${who}) -> network error: ${err.message}`);
    return false;
  }
}

if (!DEMO_KEY) {
  DEMO_KEY = crypto.randomBytes(12).toString('base64url');
  console.warn(`[relay] DEMO_KEY not set; generated one for this run: ${DEMO_KEY}`);
}

// ---------------------------------------------------------------- tripwire catalogue
const SYSTEM_NAMES = {
  a_shares: 'Shared drives',
  a_docs: 'Document management',
  a_email: 'Email and calendar',
  a_billing: 'Billing and trust accounting',
  a_hr: 'HR and payroll',
};

const CATALOGUE = [
  {
    id: 'tw_partner_comp', kind: 'document', label: 'Partner compensation spreadsheet',
    system: 'a_shares', fileName: 'Partner_Compensation_2026.xlsx', hitKind: 'document_opened',
    modified: 'Oct 28, 2026', size: '84 KB',
  },
  {
    id: 'tw_backup_admin', kind: 'account', label: 'Backup admin service account',
    system: 'a_email', fileName: 'service_accounts_README.txt', hitKind: 'login_attempt',
    modified: 'Sep 30, 2026', size: '2 KB',
  },
  {
    id: 'tw_billing_keys', kind: 'secret', label: 'Billing API keys',
    system: 'a_billing', fileName: 'billing_api_keys.txt', hitKind: 'key_used',
    modified: 'Aug 19, 2026', size: '1 KB',
  },
];

// Live state (in memory only). Raw tokens live only inside the decoy content.
/** @type {Map<string, any>} id -> armed tripwire */
const armed = new Map();
/** @type {Map<string, string>} sha256(token) -> id */
const byHash = new Map();
const hits = [];
let arming = false;

const sha256hex = (s) => crypto.createHash('sha256').update(s).digest('hex');

function readmeText(token) {
  return [
    'SERVICE ACCOUNTS - IT OPERATIONS',
    'Halvorsen & Pike LLP  |  Internal  |  Last reviewed 2026-09-30',
    '',
    'This note lists non-human accounts used by scheduled jobs. Do not share',
    'outside IT. Rotate passwords every 90 days (see ticket ITOPS-2291).',
    '',
    'svc_backup_admin',
    '  Purpose : nightly Veeam-style backup jobs for file shares and DMS',
    '  Console : ' + `${RELAY_PUBLIC_URL}/login/${token}`,
    '  Owner   : IT Operations (M. Okafor)',
    '  Notes   : temporary password was reset after the August migration;',
    '            ask the on-call admin for the current one. MFA exempt',
    '            (service account) - pending review.',
    '',
    'svc_scan_relay',
    '  Purpose : scan-to-email from floor 12 and 14 copiers',
    '  Owner   : Facilities / IT',
    '',
    'svc_dms_index',
    '  Purpose : full-text indexing for document management',
    '  Owner   : Practice Support',
    '',
  ].join('\n');
}

function keysText(token) {
  return [
    '# Billing system API keys (production)',
    '# Used by the time-entry sync and the trust ledger export.',
    '# Owner: Finance Systems. Do NOT paste into tickets or email.',
    '',
    `BILLING_API_BASE=${RELAY_PUBLIC_URL}/k/${token}`,
    `BILLING_API_KEY=bk_live_${token}`,
    '',
    '# Example: list open invoices',
    `curl -H "Authorization: Bearer bk_live_${token}" \\`,
    `     ${RELAY_PUBLIC_URL}/k/${token}/v1/invoices`,
    '',
    '# Rotation: quarterly, next due 2026-12-01',
    '',
  ].join('\n');
}

function spreadsheetHtml(token) {
  const rows = [
    ['E. Halvorsen', 'Managing Partner', 'Corporate', '1,240,000', '310,000', '1,550,000'],
    ['R. Pike', 'Senior Partner', 'Litigation', '1,120,000', '265,000', '1,385,000'],
    ['D. Castellanos', 'Equity Partner', 'Real Estate', '845,000', '190,000', '1,035,000'],
    ['A. Nwosu', 'Equity Partner', 'Tax', '790,000', '175,000', '965,000'],
    ['L. Brandt', 'Equity Partner', 'IP & Technology', '760,000', '160,000', '920,000'],
    ['S. Marchetti', 'Income Partner', 'Employment', '520,000', '85,000', '605,000'],
    ['J. Whitcombe', 'Income Partner', 'Trusts & Estates', '495,000', '70,000', '565,000'],
    ['K. Iyer', 'Income Partner', 'Litigation', '480,000', '65,000', '545,000'],
  ];
  const tr = rows.map((r, i) =>
    `<tr><td class="n">${i + 2}</td>${r.map((c, j) => `<td${j >= 3 ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Partner_Compensation_2026.xlsx</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{margin:0;font:13px Calibri,Segoe UI,Arial,sans-serif;background:#fff;color:#222}
.bar{background:#217346;color:#fff;padding:6px 12px;font-weight:600}
.fx{border-bottom:1px solid #d4d4d4;padding:4px 12px;color:#555;font-family:Consolas,monospace}
table{border-collapse:collapse;margin:0}
td,th{border:1px solid #d4d4d4;padding:3px 10px;white-space:nowrap}
th{background:#f3f3f3;font-weight:400;color:#555}
.n{background:#f3f3f3;color:#555;text-align:center}
.num{text-align:right}
tr.h td{font-weight:700;background:#e8f1ec}
.tabs{border-top:1px solid #d4d4d4;padding:4px 12px;color:#555;background:#f7f7f7}
.tabs b{color:#217346}
</style></head><body>
<div class="bar">Partner_Compensation_2026.xlsx</div>
<div class="fx">fx&nbsp;&nbsp;=SUM(D2:E2)</div>
<table><tr><th></th><th>A</th><th>B</th><th>C</th><th>D</th><th>E</th><th>F</th></tr>
<tr class="h"><td class="n">1</td><td>Partner</td><td>Tier</td><td>Practice group</td><td>Base draw (USD)</td><td>Bonus pool (USD)</td><td>Total 2026 (USD)</td></tr>
${tr}
</table>
<div class="tabs"><b>FY2026 Draft</b> &nbsp;|&nbsp; Points &nbsp;|&nbsp; Origination credit</div>
<img src="/t/${token}" width="1" height="1" alt="" style="position:absolute;left:-9999px">
</body></html>`;
}

function loginHtml(error) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Backup Console - Sign in</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{margin:0;font:14px Segoe UI,Arial,sans-serif;background:#eef1f5;color:#1f2933;display:flex;min-height:100vh;align-items:center;justify-content:center}
.card{background:#fff;border:1px solid #d5dbe3;border-radius:6px;padding:28px 32px;width:320px;box-shadow:0 2px 8px rgba(0,0,0,.06)}
h1{font-size:18px;margin:0 0 4px}
p.sub{margin:0 0 18px;color:#61707f;font-size:12px}
label{display:block;font-size:12px;color:#3e4c59;margin:10px 0 4px}
input{width:100%;box-sizing:border-box;padding:8px;border:1px solid #c3ccd6;border-radius:4px;font-size:14px}
button{margin-top:16px;width:100%;padding:9px;background:#2f5d8a;color:#fff;border:0;border-radius:4px;font-size:14px;cursor:pointer}
.err{background:#fdecea;color:#a61b1b;border:1px solid #f5c2c0;padding:8px;border-radius:4px;font-size:13px;margin-bottom:6px}
</style></head><body><form class="card" method="post" autocomplete="off">
<h1>Backup Console</h1><p class="sub">Halvorsen &amp; Pike LLP - IT Operations</p>
${error ? '<div class="err">Invalid username or password.</div>' : ''}
<label for="u">Username</label><input id="u" name="username" autocomplete="off">
<label for="p">Password</label><input id="p" name="password" type="password" autocomplete="off">
<button type="submit">Sign in</button></form></body></html>`;
}

function decoyEntry(tw, withMeta) {
  const e = {
    name: tw.fileName, modified: tw.modified, size: tw.size, system: tw.system,
    url: `/d/${tw.token}/${tw.fileName}`,
    type: tw.kind === 'document' ? 'sheet' : 'text',
  };
  if (withMeta) Object.assign(e, { tripwire: true, tripwireId: tw.id, label: tw.label, armedAt: tw.armedAt, hitKind: tw.hitKind });
  return e;
}

// ---------------------------------------------------------------- SSE
const sseClients = new Set();
function emit(evt) {
  const data = `data: ${JSON.stringify(evt)}\n\n`;
  for (const res of sseClients) res.write(data);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- arming
function disarmAll() {
  armed.clear();
  byHash.clear();
}

async function armAll() {
  arming = true;
  try {
    disarmAll();
    emit({ type: 'start' });
    emit({ type: 'step', text: 'Generating secret tokens…' });
    const fresh = CATALOGUE.map((c) => {
      const token = crypto.randomBytes(24).toString('base64url');
      return { ...c, token, hash: sha256hex(token) };
    });
    await sleep(ARM_STEP_MS);
    const out = [];
    for (const tw of fresh) {
      const where = SYSTEM_NAMES[tw.system];
      emit({ type: 'step', text: `Planting ${tw.fileName} in ${where}…`, id: tw.id });
      await sleep(ARM_STEP_MS);
      let registered = true;
      if (MODE === 'spacetime') {
        registered = await callReducer('plant_tripwire', [tw.id, tw.label, tw.kind, tw.system, tw.fileName, tw.hash], STDB_ADMIN_TOKEN, 'admin');
      }
      tw.armedAt = new Date().toISOString();
      tw.lastHitAt = 0;
      tw.content = tw.kind === 'document' ? spreadsheetHtml(tw.token)
        : tw.kind === 'account' ? readmeText(tw.token) : keysText(tw.token);
      armed.set(tw.id, tw);
      byHash.set(tw.hash, tw.id);
      const entry = decoyEntry(tw, true);
      out.push(entry);
      emit({
        type: 'armed', id: tw.id, file: entry, registered,
        text: registered
          ? `✓ ${tw.fileName} armed in ${where} · registered in Flare`
          : `⚠ ${tw.fileName} armed in ${where} · Flare registration failed (see relay log)`,
      });
      console.log(`[arm] ${tw.id} armed (${tw.fileName} in ${where}) hash=${tw.hash.slice(0, 12)}…`);
    }
    emit({ type: 'done', text: 'All 3 tripwires armed. Only the token hashes are stored.' });
    return out;
  } finally {
    arming = false;
  }
}

// ---------------------------------------------------------------- hits
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

// Returns { actual, reported }. Loopback is reported as DEMO_SOURCE_IP when set.
function sourceIp(req) {
  let actual = req.socket.remoteAddress || '';
  if (TRUST_PROXY) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff) actual = xff.split(',')[0].trim();
  }
  const reported = LOOPBACK.has(actual) && DEMO_SOURCE_IP ? DEMO_SOURCE_IP : actual.replace(/^::ffff:/, '');
  return { actual, reported };
}

// Simulated hits from the IT panel (POST /api/fire {id, profile}).
const PROFILES = {
  attacker: {
    sourceIp: ATTACKER_IP,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  },
  it_staff: {
    sourceIp: '10.10.2.5',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  },
  indexer: { sourceIp: '10.0.0.40', userAgent: 'HP-IndexBot/2.1' },
};

// Records a hit. Resolves to true/false (SpacetimeDB result), null in mock
// mode, or 'debounced' when ignored.
async function recordHit(tw, req, { force = false, profile = null } = {}) {
  const now = Date.now();
  if (!force && tw.lastHitAt && now - tw.lastHitAt < DEBOUNCE_MS) {
    console.log(`[hit] ${tw.id} repeat within 5 s, ignored`);
    return 'debounced';
  }
  tw.lastHitAt = now;
  let ip; let ua; let note;
  if (req) {
    ip = sourceIp(req);
    ua = String(req.headers['user-agent'] || '').slice(0, 200);
    note = ip.actual !== ip.reported ? ` (actual ${ip.actual})` : '';
  } else {
    const p = PROFILES[profile] || PROFILES.attacker;
    ip = { reported: p.sourceIp };
    ua = p.userAgent;
    note = ` (simulated ${profile || 'attacker'})`;
  }
  const hit = {
    tripwireId: tw.id,
    kind: tw.hitKind,
    time: new Date(now).toISOString(),
    sourceIp: ip.reported,
    userAgent: ua,
  };
  hits.push(hit);
  console.log(`🚨 TRIPWIRE HIT ${hit.tripwireId} ${hit.kind} from ${hit.sourceIp}${note} at ${hit.time} ua="${hit.userAgent}"`);
  const sent = MODE !== 'spacetime'
    ? null
    : await callReducer('record_hit', [tw.hash, hit.kind, hit.sourceIp, hit.userAgent], STDB_TOKEN, 'relay');
  // Live feed for the IT view (the event stream requires the demo key, so the attacker never sees it).
  emit({
    type: 'hit', id: tw.id, label: tw.label, fileName: tw.fileName, system: tw.system, kind: hit.kind,
    sourceIp: hit.sourceIp, time: hit.time, simulated: req ? null : (profile || 'attacker'),
    sent: sent === true ? 'ok' : sent === false ? 'failed' : 'mock',
  });
  return sent;
}

function lookup(token, kind) {
  if (!token || token.length > 200) return null;
  const id = byHash.get(sha256hex(token));
  if (!id) return null;
  const tw = armed.get(id);
  if (!tw || (kind && tw.kind !== kind)) return null;
  return tw;
}

// ---------------------------------------------------------------- http helpers
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

function send(res, status, body, type = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...extra });
  res.end(body);
}
const notFound = (res) => send(res, 404, 'Not found');
const json = (res, status, obj) => send(res, status, JSON.stringify(obj), 'application/json');

// Drain a request body without keeping it (used for login and fake API).
function drain(req) {
  return new Promise((resolve) => {
    let n = 0;
    req.on('data', (c) => { n += c.length; if (n > 64 * 1024) req.destroy(); });
    req.on('end', resolve);
    req.on('error', resolve);
    req.on('close', resolve);
  });
}

function readJson(req) {
  return new Promise((resolve) => {
    let buf = '';
    req.on('data', (c) => { buf += c; if (buf.length > 16 * 1024) req.destroy(); });
    req.on('end', () => { try { resolve(buf ? JSON.parse(buf) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function authorized(req, url) {
  const given = url.searchParams.get('key') || req.headers['x-demo-key'] || '';
  const a = crypto.createHash('sha256').update(String(given)).digest();
  const b = crypto.createHash('sha256').update(DEMO_KEY).digest();
  return crypto.timingSafeEqual(a, b);
}

let indexHtml = null;
function getIndex() {
  if (!indexHtml || process.env.NODE_ENV !== 'production') {
    indexHtml = fs.readFileSync(path.join(HERE, 'public', 'index.html'));
  }
  return indexHtml;
}

// ---------------------------------------------------------------- server
const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://x'); } catch { return notFound(res); }
  const p = url.pathname;
  const seg = p.split('/').filter(Boolean);

  try {
    // Intranet page
    if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
      return send(res, 200, getIndex(), 'text/html; charset=utf-8');
    }

    // Decoy listing for the file server (no tripwire metadata).
    if (req.method === 'GET' && p === '/api/decoys') {
      return json(res, 200, { files: [...armed.values()].map((tw) => decoyEntry(tw, false)) });
    }

    // Decoy content. Opening this page does NOT record a hit; only the beacon does.
    if (req.method === 'GET' && seg[0] === 'd' && seg.length >= 2) {
      const tw = lookup(seg[1]);
      if (!tw) return notFound(res);
      if (tw.kind === 'document') return send(res, 200, tw.content, 'text/html; charset=utf-8');
      return send(res, 200, tw.content, 'text/plain; charset=utf-8');
    }

    // Beacon
    if (req.method === 'GET' && seg[0] === 't' && seg.length === 2) {
      const tw = lookup(seg[1], 'document');
      if (!tw) return notFound(res);
      recordHit(tw, req);
      return send(res, 200, GIF, 'image/gif');
    }

    // Fake backup console login
    if (seg[0] === 'login' && seg.length === 2) {
      const tw = lookup(seg[1], 'account');
      if (!tw) { if (req.method === 'POST') await drain(req); return notFound(res); }
      if (req.method === 'GET') return send(res, 200, loginHtml(false), 'text/html; charset=utf-8');
      if (req.method === 'POST') {
        await drain(req); // body (username/password) is discarded unread
        recordHit(tw, req);
        return send(res, 200, loginHtml(true), 'text/html; charset=utf-8');
      }
      return notFound(res);
    }

    // Fake billing API
    if (seg[0] === 'k' && seg.length >= 2) {
      await drain(req);
      const tw = lookup(seg[1], 'secret');
      if (!tw) return notFound(res);
      recordHit(tw, req);
      return json(res, 401, { error: 'invalid_api_key' });
    }

    // ---------------- IT / demo API (DEMO_KEY required)
    if (seg[0] === 'api') {
      if (!authorized(req, url)) { await drain(req); return json(res, 401, { error: 'unauthorized' }); }

      if (req.method === 'GET' && p === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        res.write(': ok\n\n');
        sseClients.add(res);
        const ka = setInterval(() => res.write(': ka\n\n'), 15000);
        req.on('close', () => { clearInterval(ka); sseClients.delete(res); });
        return;
      }
      if (req.method === 'GET' && p === '/api/files') {
        return json(res, 200, { mode: MODE, files: [...armed.values()].map((tw) => decoyEntry(tw, true)) });
      }
      if (req.method === 'GET' && p === '/api/hits') {
        return json(res, 200, { count: hits.length, hits });
      }
      if (req.method === 'POST' && p === '/api/arm') {
        await drain(req);
        if (arming) return json(res, 409, { error: 'arming_in_progress' });
        const files = await armAll();
        return json(res, 200, { ok: true, mode: MODE, decoys: files });
      }
      if (req.method === 'POST' && p === '/api/fire') {
        const body = await readJson(req);
        const profile = body.profile === undefined ? 'attacker' : String(body.profile);
        if (!PROFILES[profile]) return json(res, 400, { error: 'unknown_profile' });
        const tw = armed.get(String(body.id || ''));
        if (!tw) return json(res, 404, { error: 'unknown_or_unarmed_tripwire' });
        const sent = await recordHit(tw, null, { force: true, profile });
        if (sent === false) return json(res, 502, { ok: false, id: tw.id, profile, mode: MODE, error: 'spacetime_call_failed' });
        return json(res, 200, { ok: true, id: tw.id, profile, mode: MODE, sent: sent === true });
      }
      if (req.method === 'POST' && p === '/api/reset') {
        await drain(req);
        disarmAll();
        hits.length = 0;
        emit({ type: 'reset' });
        console.log('[reset] all tripwires disarmed, hit log cleared');
        let sent = null;
        if (MODE === 'spacetime') sent = await callReducer('reset_tripwire_demo', [], STDB_ADMIN_TOKEN, 'admin');
        return json(res, 200, { ok: sent !== false, mode: MODE, sent: sent === true });
      }
      return json(res, 404, { error: 'not_found' });
    }

    return notFound(res);
  } catch (err) {
    console.error('[relay] error', err);
    if (!res.headersSent) send(res, 500, 'Internal error');
    else res.end();
  }
});

server.listen(PORT, async () => {
  if (MODE === 'spacetime') {
    console.log(`[relay] SpacetimeDB ${STDB_HOST} db=${STDB_DB} token=${STDB_TOKEN ? 'set' : 'MISSING'}${process.env.STDB_ADMIN_TOKEN ? ' adminOverride=set' : ''}`);
    await callReducer('register_relay', [], STDB_TOKEN, 'relay');
  }
  console.log(`[relay] listening on http://localhost:${PORT} mode=${MODE} public=${RELAY_PUBLIC_URL} demoSourceIp=${DEMO_SOURCE_IP || '(off)'}`);
});
