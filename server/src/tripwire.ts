import { SenderError, t } from 'spacetimedb/server';
import spacetimedb from './schema';
import { ASSET_ROW_NAMES, isIndexer, jevTasks, scoreHit, systemNameOf, WINDOW_MICROS, type IncidentType } from './jev';
import { offerAutomation } from './automation-plan';
import { appendAudit, currentIncident, isStaff, requireMember, setIncidentStatus, type Ctx } from './util';

const HEX64 = /^[0-9a-f]{64}$/;
const JEV = 'jev';

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

/** "14:32 UTC" (the module has no local time zone). */
function utcTime(at: { toDate(): Date }) {
  return at.toDate().toISOString().slice(11, 16) + ' UTC';
}

function isRelay(ctx: Ctx) {
  const cfg = ctx.db.tripwireConfig.id.find(0);
  return !!cfg && cfg.relayHex === ctx.sender.toHexString();
}

function isAdmin(ctx: Ctx) {
  return ctx.db.member.identity.find(ctx.sender)?.role === 'admin';
}

function requireRelayOrAdmin(ctx: Ctx) {
  if (!isRelay(ctx) && !isAdmin(ctx)) throw new SenderError('relay or admin only');
}

function membersByJoin(ctx: Ctx) {
  return [...ctx.db.member.iter()].sort((a, b) =>
    a.joinedAt.microsSinceUnixEpoch < b.joinedAt.microsSinceUnixEpoch ? -1 : 1,
  );
}

/** First member holding the role, or none: the task then waits for someone with that role to join. */
function firstOfRole(ctx: Ctx, role: string) {
  return membersByJoin(ctx).find((m) => m.role === role);
}

export const registerRelay = spacetimedb.reducer((ctx) => {
  const me = ctx.sender.toHexString();
  const cfg = ctx.db.tripwireConfig.id.find(0);
  if (!cfg) {
    ctx.db.tripwireConfig.insert({ id: 0, relayHex: me });
  } else if (cfg.relayHex === me) {
    return;
  } else if (isAdmin(ctx)) {
    ctx.db.tripwireConfig.id.update({ id: 0, relayHex: me });
  } else {
    throw new SenderError('relay already registered');
  }
  appendAudit(ctx, 'tripwire.relay', { relayHex: me });
});

export const plantTripwire = spacetimedb.reducer(
  { id: t.string(), label: t.string(), kind: t.string(), assetId: t.string(), fileName: t.string(), tokenHash: t.string() },
  (ctx, { id, label, kind, assetId, fileName, tokenHash }) => {
    requireRelayOrAdmin(ctx);
    if (!HEX64.test(tokenHash)) throw new SenderError('bad token hash');
    if (!id || id.length > 64) throw new SenderError('bad id');
    const old = ctx.db.tripwire.id.find(id);
    if (old) ctx.db.tripwire.id.delete(id);
    const clash = ctx.db.tripwire.tokenHash.find(tokenHash);
    if (clash) throw new SenderError('token hash already planted');
    ctx.db.tripwire.insert({
      id, label: clip(label, 120), kind: clip(kind, 40), assetId: clip(assetId, 40), fileName: clip(fileName, 120),
      tokenHash, active: true, plantedAt: ctx.timestamp,
    });
    appendAudit(ctx, 'tripwire.plant', { tripwireId: id, assetId });
  },
);

/** Open (or join) the incident for a triage and push Jev's pre-filled tasks. */
function openFromTriage(ctx: Ctx, triageId: bigint) {
  const tr = ctx.db.jevTriage.id.find(triageId)!;
  const hit = ctx.db.tripwireHit.id.find(tr.hitId);
  const type = tr.incidentType as IncidentType;
  let inc = currentIncident(ctx);
  if (!inc) {
    inc = ctx.db.incident.insert({
      id: 0n, status: 'active', attackType: type, isDrill: false, raisedBy: ctx.sender, confirmedBy: JEV,
      createdAt: ctx.timestamp, updatedAt: ctx.timestamp,
    });
  } else {
    const patch: Partial<typeof inc> = {};
    if (inc.status === 'possible') { patch.status = 'active'; patch.confirmedBy = JEV; }
    if (inc.status === 'contained' || inc.status === 'recovered') patch.status = 'active';
    if (!inc.attackType || (type === 'ransomware' && inc.attackType !== 'ransomware')) patch.attackType = type;
    if (Object.keys(patch).length) {
      setIncidentStatus(ctx, inc, patch);
      inc = ctx.db.incident.id.find(inc.id)!;
    }
  }
  const systems = tr.scope ? tr.scope.split(',') : [];
  const rowNames = new Set<string>();
  for (const [aid, row] of Object.entries(ASSET_ROW_NAMES)) if (systems.includes(systemNameOf(aid))) rowNames.add(row);
  for (const a of [...ctx.db.asset.iter()]) {
    if (rowNames.has(a.name)) ctx.db.asset.id.update({ ...a, status: 'attacker_active', setBy: JEV, updatedAt: ctx.timestamp });
  }
  ctx.db.jevTriage.id.update({ ...tr, incidentId: inc.id });

  const existing = new Set(
    [...ctx.db.task.incidentId.filter(inc.id)].filter((x) => x.stepId === 0n).map((x) => x.title),
  );
  const tasks = jevTasks(type, {
    systems, ip: hit?.sourceIp ?? '', label: hit?.label ?? 'the decoy', evidence: tr.evidence.split('\n')[0] ?? '',
    hitKind: hit?.hitKind, fileName: hit?.fileName, time: hit ? utcTime(hit.at) : undefined,
  });
  const autoParams = {
    ip: hit?.sourceIp ?? '', systems: systems.join(','), rows: [...rowNames].join(','),
    time: hit ? utcTime(hit.at) : '', fileName: hit?.fileName ?? '',
  };
  for (const tk of tasks) {
    if (existing.has(tk.title)) continue;
    const who = firstOfRole(ctx, tk.role);
    const row = ctx.db.task.insert({
      id: 0n, incidentId: inc.id, stepId: 0n, role: tk.role,
      assignedTo: who ? who.identity.toHexString() : '', assignedName: who?.name ?? '',
      status: 'open', title: tk.title, detail: tk.detail, updatedAt: ctx.timestamp,
    });
    if (tk.auto) offerAutomation(ctx, row.id, inc.id, tk.auto, autoParams);
  }
  return inc.id;
}

export const recordHit = spacetimedb.reducer(
  { tokenHash: t.string(), hitKind: t.string(), sourceIp: t.string(), userAgent: t.string() },
  (ctx, { tokenHash, hitKind, sourceIp, userAgent }) => {
    if (!isRelay(ctx)) throw new SenderError('relay only');
    const tw = ctx.db.tripwire.tokenHash.find(tokenHash);
    if (!tw || !tw.active) throw new SenderError('unknown tripwire');
    const kind = clip(hitKind, 40);
    const ip = clip(sourceIp, 64);
    const ua = clip(userAgent, 200);

    const since = ctx.timestamp.microsSinceUnixEpoch - WINDOW_MICROS;
    const recent = [...ctx.db.tripwireHit.iter()]
      .filter((h) => h.at.microsSinceUnixEpoch >= since && !isIndexer(h.userAgent))
      .map((h) => ({ tripwireId: h.tripwireId, label: h.label, assetId: h.assetId }));

    const hit = ctx.db.tripwireHit.insert({
      id: 0n, tripwireId: tw.id, label: tw.label, fileName: tw.fileName, assetId: tw.assetId,
      systemName: systemNameOf(tw.assetId), hitKind: kind, sourceIp: ip, userAgent: ua, at: ctx.timestamp, triageId: 0n,
    });
    appendAudit(ctx, 'tripwire.hit', { source: 'tripwire', tripwireId: tw.id, hitKind: kind, assetId: tw.assetId });

    const r = scoreHit(
      { tripwireId: tw.id, label: tw.label, fileName: tw.fileName, assetId: tw.assetId, hitKind: kind, sourceIp: ip, userAgent: ua },
      recent,
    );
    let reviewer = '';
    if (r.tier === 'mid') {
      const ms = membersByJoin(ctx);
      const who = ms.find((m) => m.role === 'lead') ?? ms.find((m) => m.role === 'admin');
      reviewer = who ? who.identity.toHexString() : '';
    }
    const decision = r.tier === 'high' ? 'auto_opened' : r.tier === 'mid' ? 'pending' : 'logged';
    const tr = ctx.db.jevTriage.insert({
      id: 0n, hitId: hit.id, incidentId: 0n, probability: r.probability, incidentType: r.incidentType,
      scope: r.scope.join(','), page: r.page, tier: r.tier, evidence: r.evidence.join('\n'),
      decision, reviewer, decidedBy: r.tier === 'mid' ? '' : JEV, at: ctx.timestamp,
    });
    ctx.db.tripwireHit.id.update({ ...hit, triageId: tr.id });
    appendAudit(ctx, 'jev.triage', { probability: r.probability, tier: r.tier, incidentType: r.incidentType });
    if (r.tier === 'high') {
      const incidentId = openFromTriage(ctx, tr.id);
      appendAudit(ctx, 'jev.auto_open', { triageId: tr.id, incidentId });
    }
  },
);

function loadPending(ctx: Ctx, triageId: bigint) {
  const me = requireMember(ctx);
  const tr = ctx.db.jevTriage.id.find(triageId);
  if (!tr) throw new SenderError('no such triage');
  if (tr.decision !== 'pending') throw new SenderError('triage not pending');
  if (tr.reviewer !== ctx.sender.toHexString() && !isStaff(me.role)) throw new SenderError('not your review');
  return tr;
}

export const confirmTriage = spacetimedb.reducer({ triageId: t.u64() }, (ctx, { triageId }) => {
  const tr = loadPending(ctx, triageId);
  ctx.db.jevTriage.id.update({ ...tr, decision: 'confirmed', decidedBy: ctx.sender.toHexString() });
  const incidentId = openFromTriage(ctx, triageId);
  appendAudit(ctx, 'jev.confirm', { triageId, incidentId });
});

export const dismissTriage = spacetimedb.reducer({ triageId: t.u64() }, (ctx, { triageId }) => {
  const tr = loadPending(ctx, triageId);
  ctx.db.jevTriage.id.update({ ...tr, decision: 'dismissed', decidedBy: ctx.sender.toHexString() });
  appendAudit(ctx, 'jev.dismiss', { triageId });
});

/** The relay or any member can reset the tripwire demo. */
export const resetTripwireDemo = spacetimedb.reducer((ctx) => {
  if (!isRelay(ctx)) requireMember(ctx);
  for (const r of [...ctx.db.tripwireHit.iter()]) ctx.db.tripwireHit.id.delete(r.id);
  for (const r of [...ctx.db.jevTriage.iter()]) ctx.db.jevTriage.id.delete(r.id);
  for (const r of [...ctx.db.task.iter()]) if (r.stepId === 0n) ctx.db.task.id.delete(r.id);
  for (const r of [...ctx.db.automationRun.iter()]) ctx.db.automationRun.id.delete(r.id);
  for (const inc of [...ctx.db.incident.iter()]) {
    if (inc.confirmedBy !== JEV) continue;
    for (const r of [...ctx.db.checkin.incidentId.filter(inc.id)]) ctx.db.checkin.id.delete(r.id);
    for (const r of [...ctx.db.alertReport.incidentId.filter(inc.id)]) ctx.db.alertReport.id.delete(r.id);
    for (const r of [...ctx.db.clock.incidentId.filter(inc.id)]) ctx.db.clock.id.delete(r.id);
    for (const r of [...ctx.db.task.incidentId.filter(inc.id)]) ctx.db.task.id.delete(r.id);
    ctx.db.incident.id.delete(inc.id);
  }
  for (const a of [...ctx.db.asset.iter()]) {
    if (a.setBy === JEV || a.setBy === 'automation') ctx.db.asset.id.update({ ...a, status: 'unknown', setBy: '', updatedAt: ctx.timestamp });
  }
  appendAudit(ctx, 'tripwire.reset');
});
