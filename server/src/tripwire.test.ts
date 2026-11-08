import { describe, expect, it } from 'vitest';
import { ConnectionId, TimeDuration } from 'spacetimedb';
import { createModuleTestHarness, TestAuth } from 'spacetimedb/server/test-utils';
import { pubkeyOf, sha256Hex, signJoin, verifyChain } from '@redphone/shared';
import spacetimedb from './index';
import * as m from './index';
import { scoreHit } from './jev';

const auth = (sub: string, n: bigint) =>
  TestAuth.fromJwtPayload(JSON.stringify({ iss: 'test', sub }), new ConnectionId(n));
const A = auth('admin', 1n);
const L = auth('lead', 2n);
const IT = auth('it', 3n);
const CO = auth('counsel', 4n);
const R = auth('relay', 5n);
const X = auth('stranger', 6n);
const sk = (b: number) => new Uint8Array(32).fill(b);
const hex = (n: number) => n.toString(16).padStart(2, '0');

const H_DOC = sha256Hex('tok-doc');
const H_ACC = sha256Hex('tok-acc');
const H_KEY = sha256Hex('tok-key');
const EXT = '203.0.113.9';
const UA = 'curl/8.4.0';

function world({ withIt = true } = {}) {
  const test = createModuleTestHarness(spacetimedb, m);
  const idOf = (a: typeof A) => test.withReducerTx(a, (ctx) => ctx.sender);
  test.withReducerTx(A, (ctx) => m.bootstrapAdmin(ctx, { name: 'Ada', pubkeyHex: pubkeyOf(sk(1)) }));
  const join = (inviter: typeof A, who: typeof A, role: string, n: number) => {
    const s = hex(n).repeat(32);
    const h = sha256Hex(s);
    test.withReducerTx(inviter, (ctx) => m.createInvite(ctx, { role, name: role + n, secretHash: h }));
    const sig = signJoin(sk(n), h, idOf(who).toHexString());
    test.withReducerTx(who, (ctx) => m.redeemInvite(ctx, { secretHex: s, pubkeyHex: pubkeyOf(sk(n)), sigHex: sig }));
  };
  join(A, L, 'lead', 2);
  if (withIt) join(L, IT, 'it', 3);
  join(L, CO, 'counsel', 4);
  test.withReducerTx(R, (ctx) => m.registerRelay(ctx, {}));
  const plant = (id: string, label: string, kind: string, assetId: string, fileName: string, tokenHash: string) =>
    test.withReducerTx(R, (ctx) => m.plantTripwire(ctx, { id, label, kind, assetId, fileName, tokenHash }));
  plant('tw_partner_comp', 'Partner compensation spreadsheet', 'document', 'a_shares', 'Partner_Compensation_2026.xlsx', H_DOC);
  plant('tw_backup_admin', 'Backup admin service account', 'account', 'a_email', 'service_accounts_README.txt', H_ACC);
  plant('tw_billing_keys', 'Billing API keys', 'secret', 'a_billing', 'billing_api_keys.txt', H_KEY);
  const hit = (tokenHash: string, hitKind: string, sourceIp = EXT, userAgent = UA) =>
    test.withReducerTx(R, (ctx) => m.recordHit(ctx, { tokenHash, hitKind, sourceIp, userAgent }));
  return { test, idOf, hit, plant, join };
}

const asset = (test: ReturnType<typeof world>['test'], name: string) => [...test.db.asset.iter()].find((a) => a.name === name)!;

describe('jev scoring', () => {
  it('is deterministic and clamps', () => {
    const base = { tripwireId: 'a', label: 'A', fileName: 'f', assetId: 'a_shares', sourceIp: EXT, userAgent: UA };
    expect(scoreHit({ ...base, hitKind: 'document_opened' }, []).probability).toBe(85);
    expect(scoreHit({ ...base, hitKind: 'login_attempt' }, []).incidentType).toBe('credential_theft');
    const many = [1, 2, 3].map((i) => ({ tripwireId: 'o' + i, label: 'O' + i, assetId: 'a_docs' }));
    const r = scoreHit({ ...base, hitKind: 'key_used' }, many);
    expect(r.probability).toBe(99);
    expect(r.incidentType).toBe('ransomware');
  });
});

describe('tripwire + jev', () => {
  it('high: attacker hit auto-opens an exfiltration incident with evidence tasks', () => {
    const { test, hit } = world();
    hit(H_KEY, 'key_used');
    const [tr] = [...test.db.jevTriage.iter()];
    expect(tr.probability).toBe(90);
    expect(tr.tier).toBe('high');
    expect(tr.decision).toBe('auto_opened');
    expect(tr.incidentType).toBe('exfiltration');
    expect(tr.scope).toBe('Billing and trust accounting');
    expect(tr.page).toBe('it,lead,counsel,comms');
    const [inc] = [...test.db.incident.iter()];
    expect(inc.status).toBe('active');
    expect(inc.attackType).toBe('exfiltration');
    expect(inc.confirmedBy).toBe('jev');
    expect(tr.incidentId).toBe(inc.id);
    expect(asset(test, 'Billing DB').status).toBe('attacker_active');
    expect(asset(test, 'Billing DB').setBy).toBe('jev');
    const tasks = [...test.db.task.iter()];
    expect(tasks.length).toBe(8);
    expect(tasks.every((x) => x.stepId === 0n && x.status === 'open')).toBe(true);
    expect(tasks.every((x) => x.detail.includes(' Evidence: Someone called the billing API'))).toBe(true);
    expect(tasks.find((x) => x.title === `Cut off the computer at ${EXT}`)!.assignedName).toBe('it3');
    // key_used hit: IT gets the plain-language key rotation step with numbered substeps
    const keys = tasks.find((x) => x.title === 'Replace the billing API keys')!;
    expect(keys.role).toBe('it');
    expect(keys.detail).toContain('\n- Create new API keys');
    expect(tasks.filter((x) => x.role === 'it').map((x) => x.title)).toEqual([
      `Cut off the computer at ${EXT}`, `Lock the account used on ${EXT}`, 'Replace the billing API keys',
      'Stop large uploads from Billing and trust accounting', 'Save the logs from the last 24 hours',
    ]);
    const [h] = [...test.db.tripwireHit.iter()];
    expect(h.triageId).toBe(tr.id);
    // completing a Jev task (stepId 0) must not unlock anything or crash
    const t0 = tasks[0];
    // "I'm stuck" posts a help request to the all-hands chat
    test.withReducerTx(IT, (ctx) => m.askForHelp(ctx, { taskId: t0.id }));
    const [msg] = [...test.db.message.iter()];
    expect(msg.channel).toBe('all');
    expect(msg.body).toContain(`I'm stuck on "${t0.title}"`);
    test.withReducerTx(IT, (ctx) => m.completeTask(ctx, { taskId: t0.id }));
    expect(() => test.withReducerTx(IT, (ctx) => m.askForHelp(ctx, { taskId: t0.id }))).toThrow();
    expect(verifyChain([...test.db.auditLog.iter()])).toEqual({ ok: true });
  });

  it('automation: one tap runs an IT step, marks it done, posts to chat and contains the asset', () => {
    const { test, hit } = world();
    hit(H_DOC, 'document_opened');
    const runs = () => [...test.db.automationRun.iter()];
    // every IT task is automatable; non-IT tasks are not
    const it = [...test.db.task.iter()].filter((x) => x.role === 'it');
    expect(runs().length).toBe(it.length);
    expect(runs().every((r) => r.status === 'ready')).toBe(true);
    const iso = it.find((x) => x.title === `Cut off the computer at ${EXT}`)!;
    test.withReducerTx(IT, (ctx) => m.runAutomation(ctx, { taskId: iso.id }));
    const run = runs().find((r) => r.taskId === iso.id)!;
    expect(run.status).toBe('succeeded');
    expect(run.log).toContain('ok: Turned on network isolation');
    expect(run.log).toContain('todo: Leave the computer powered on');
    expect(run.ranBy).toBe('it3');
    expect(test.db.task.id.find(iso.id)!.status).toBe('done');
    expect(asset(test, 'Client File Server').status).toBe('contained');
    expect([...test.db.message.iter()].some((x) => x.body.includes('is cut off from the network'))).toBe(true);
    // cannot run twice; counsel task has no automation
    expect(() => test.withReducerTx(IT, (ctx) => m.runAutomation(ctx, { taskId: iso.id }))).toThrow();
    const counsel = [...test.db.task.iter()].find((x) => x.role === 'counsel')!;
    expect(() => test.withReducerTx(L, (ctx) => m.runAutomation(ctx, { taskId: counsel.id }))).toThrow();
    // reset clears runs and the automation's board change
    test.withReducerTx(R, (ctx) => m.resetTripwireDemo(ctx, {}));
    expect(runs().length).toBe(0);
    expect(asset(test, 'Client File Server').status).toBe('unknown');
  });

  it('no IT member yet: IT tasks stay unassigned, then go to the first IT member who joins', () => {
    const { test, hit, join } = world({ withIt: false });
    hit(H_DOC, 'document_opened');
    const itTasks = () => [...test.db.task.iter()].filter((x) => x.role === 'it');
    expect(itTasks().length).toBe(5);
    expect(itTasks().every((x) => x.assignedTo === '' && x.assignedName === '')).toBe(true);
    // a lead can still act on an unassigned task
    const first = itTasks()[0].id;
    test.withReducerTx(L, (ctx) => m.acceptTask(ctx, { taskId: first }));
    join(L, IT, 'it', 3);
    expect(itTasks().every((x) => x.assignedName === 'it3')).toBe(true);
  });

  it('mid: IT subnet hit is pending for the lead; confirm opens, dismiss works', () => {
    const { test, hit, idOf } = world();
    hit(H_KEY, 'key_used', '10.10.2.15');
    const [tr] = [...test.db.jevTriage.iter()];
    expect(tr.probability).toBe(70);
    expect(tr.tier).toBe('mid');
    expect(tr.decision).toBe('pending');
    expect(tr.reviewer).toBe(idOf(L).toHexString());
    expect(tr.evidence).toContain('IT admin subnet');
    expect(test.db.incident.count()).toBe(0n);
    expect(() => test.withReducerTx(CO, (ctx) => m.confirmTriage(ctx, { triageId: tr.id }))).toThrow();
    test.withReducerTx(L, (ctx) => m.confirmTriage(ctx, { triageId: tr.id }));
    const after = test.db.jevTriage.id.find(tr.id)!;
    expect(after.decision).toBe('confirmed');
    expect(after.decidedBy).toBe(idOf(L).toHexString());
    expect([...test.db.incident.iter()][0].status).toBe('active');
    expect(after.incidentId).toBe([...test.db.incident.iter()][0].id);
    expect(() => test.withReducerTx(L, (ctx) => m.confirmTriage(ctx, { triageId: tr.id }))).toThrow();

    hit(H_ACC, 'login_attempt', '10.10.2.15');
    const second = [...test.db.jevTriage.iter()].find((x) => x.id !== tr.id)!;
    expect(second.decision).toBe('pending');
    test.withReducerTx(L, (ctx) => m.dismissTriage(ctx, { triageId: second.id }));
    expect(test.db.jevTriage.id.find(second.id)!.decision).toBe('dismissed');
  });

  it('low: HP-IndexBot is logged without an incident', () => {
    const { test, hit } = world();
    hit(H_DOC, 'document_opened', '10.20.1.4', 'Mozilla/5.0 (compatible; HP-IndexBot/2.1)');
    const [tr] = [...test.db.jevTriage.iter()];
    expect(tr.probability).toBe(18);
    expect(tr.incidentType).toBe('false_positive');
    expect(tr.tier).toBe('low');
    expect(tr.decision).toBe('logged');
    expect(tr.page).toBe('');
    expect(test.db.incident.count()).toBe(0n);
  });

  it('corroboration: a second tripwire within 30 min makes it ransomware', () => {
    const { test, hit } = world();
    hit(H_DOC, 'document_opened');
    test.clock.advance(new TimeDuration(5n * 60n * 1_000_000n));
    hit(H_KEY, 'key_used');
    const trs = [...test.db.jevTriage.iter()].sort((a, b) => (a.id < b.id ? -1 : 1));
    expect(trs[0].decision).toBe('auto_opened');
    expect(trs[1].probability).toBe(98);
    expect(trs[1].incidentType).toBe('ransomware');
    expect(trs[1].scope).toBe('Billing and trust accounting,Shared drives');
    expect(trs[1].evidence).toContain('1 other tripwire(s) fired in the last 30 minutes: Partner compensation spreadsheet.');
    const [inc] = [...test.db.incident.iter()];
    expect(inc.attackType).toBe('ransomware');
    expect(asset(test, 'Client File Server').status).toBe('attacker_active');
    expect(asset(test, 'Billing DB').status).toBe('attacker_active');
    expect(test.db.task.count()).toBe(15n);
  });

  it('record_hit is relay-only and rejects unknown hashes', () => {
    const { hit, test } = world();
    expect(() =>
      test.withReducerTx(A, (ctx) => m.recordHit(ctx, { tokenHash: H_KEY, hitKind: 'key_used', sourceIp: EXT, userAgent: UA })),
    ).toThrow();
    expect(() => hit(sha256Hex('nope'), 'key_used')).toThrow();
  });

  it('register_relay: first claim wins; non-admin overwrite rejected; admin may overwrite', () => {
    const { test, idOf } = world();
    test.withReducerTx(R, (ctx) => m.registerRelay(ctx, {}));
    expect(() => test.withReducerTx(X, (ctx) => m.registerRelay(ctx, {}))).toThrow();
    expect(() => test.withReducerTx(L, (ctx) => m.registerRelay(ctx, {}))).toThrow();
    test.withReducerTx(A, (ctx) => m.registerRelay(ctx, {}));
    expect(() =>
      test.withReducerTx(R, (ctx) => m.recordHit(ctx, { tokenHash: H_KEY, hitKind: 'key_used', sourceIp: EXT, userAgent: UA })),
    ).toThrow();
    expect(idOf(A)).toBeTruthy();
  });

  it('re-plant replaces the old token hash', () => {
    const { test, hit, plant } = world();
    const fresh = sha256Hex('tok-key-2');
    plant('tw_billing_keys', 'Billing API keys', 'secret', 'a_billing', 'billing_api_keys.txt', fresh);
    expect(() => hit(H_KEY, 'key_used')).toThrow();
    hit(fresh, 'key_used');
    expect(test.db.tripwireHit.count()).toBe(1n);
    expect(() =>
      test.withReducerTx(X, (ctx) =>
        m.plantTripwire(ctx, { id: 'x', label: 'x', kind: 'x', assetId: 'a_docs', fileName: 'x', tokenHash: sha256Hex('x') }),
      ),
    ).toThrow();
  });

  it('reset_tripwire_demo cleans up Jev state', () => {
    const { test, hit } = world();
    hit(H_KEY, 'key_used');
    test.withReducerTx(IT, (ctx) => m.checkIn(ctx, { state: 'here' }));
    test.withReducerTx(R, (ctx) => m.resetTripwireDemo(ctx, {}));
    expect(test.db.tripwireHit.count()).toBe(0n);
    expect(test.db.jevTriage.count()).toBe(0n);
    expect(test.db.task.count()).toBe(0n);
    expect(test.db.incident.count()).toBe(0n);
    expect(test.db.checkin.count()).toBe(0n);
    expect(asset(test, 'Billing DB').status).toBe('unknown');
    expect(() => test.withReducerTx(X, (ctx) => m.resetTripwireDemo(ctx, {}))).toThrow();
    // any member (not only admins) can reset; strangers cannot
    test.withReducerTx(CO, (ctx) => m.resetTripwireDemo(ctx, {}));
    test.withReducerTx(CO, (ctx) => m.resetDemo(ctx, {}));
    expect(test.db.incident.count()).toBe(0n);
    expect(() => test.withReducerTx(X, (ctx) => m.resetDemo(ctx, {}))).toThrow();
    // tripwires survive the reset
    hit(H_KEY, 'key_used');
    expect(test.db.incident.count()).toBe(1n);
  });
});
