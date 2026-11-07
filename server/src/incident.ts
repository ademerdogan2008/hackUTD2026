import { SenderError, t } from 'spacetimedb/server';
import spacetimedb from './schema';
import { appendAudit, currentIncident, requireMember, requireStaff, setIncidentStatus } from './util';

export const raiseAlert = spacetimedb.reducer({ isDrill: t.bool() }, (ctx, { isDrill }) => {
  requireMember(ctx);
  const inc = currentIncident(ctx);
  if (inc) {
    const reports = [...ctx.db.alertReport.incidentId.filter(inc.id)];
    if (!reports.some((r) => r.reporter.isEqual(ctx.sender))) {
      ctx.db.alertReport.insert({ id: 0n, incidentId: inc.id, reporter: ctx.sender, at: ctx.timestamp });
    }
    if (inc.status === 'possible') {
      const distinct = new Set(
        [...ctx.db.alertReport.incidentId.filter(inc.id)].map((r) => r.reporter.toHexString()),
      );
      if (distinct.size >= 2) setIncidentStatus(ctx, inc, { status: 'active', confirmedBy: 'reports' });
    }
    appendAudit(ctx, 'alert.report', { incidentId: inc.id });
    return;
  }
  const row = ctx.db.incident.insert({
    id: 0n, status: 'possible', attackType: '', isDrill, raisedBy: ctx.sender, confirmedBy: '',
    createdAt: ctx.timestamp, updatedAt: ctx.timestamp,
  });
  ctx.db.alertReport.insert({ id: 0n, incidentId: row.id, reporter: ctx.sender, at: ctx.timestamp });
  appendAudit(ctx, 'alert.raise', { incidentId: row.id, isDrill });
});

export const confirmAlert = spacetimedb.reducer((ctx) => {
  requireStaff(ctx);
  const inc = currentIncident(ctx);
  if (!inc || inc.status !== 'possible') throw new SenderError('no possible incident');
  if (inc.raisedBy.isEqual(ctx.sender)) throw new SenderError('a different lead or admin must confirm');
  setIncidentStatus(ctx, inc, { status: 'active', confirmedBy: ctx.sender.toHexString() });
  appendAudit(ctx, 'alert.confirm', { incidentId: inc.id });
});

export const dismissAlert = spacetimedb.reducer((ctx) => {
  requireStaff(ctx);
  const inc = currentIncident(ctx);
  if (!inc || inc.status !== 'possible') throw new SenderError('no possible incident');
  setIncidentStatus(ctx, inc, { status: 'false_alarm' });
  appendAudit(ctx, 'alert.dismiss', { incidentId: inc.id });
});

const NEXT: Record<string, string> = { active: 'contained', contained: 'recovered', recovered: 'closed' };

export const advanceIncident = spacetimedb.reducer({ status: t.string() }, (ctx, { status }) => {
  requireStaff(ctx);
  const inc = currentIncident(ctx);
  if (!inc || NEXT[inc.status] !== status) throw new SenderError('invalid transition');
  setIncidentStatus(ctx, inc, { status });
  appendAudit(ctx, 'incident.advance', { incidentId: inc.id, status });
});

const CHECKIN_STATES = ['here', 'unavailable', 'device_affected'];

export const checkIn = spacetimedb.reducer({ state: t.string() }, (ctx, { state }) => {
  requireMember(ctx);
  if (!CHECKIN_STATES.includes(state)) throw new SenderError('bad state');
  const inc = currentIncident(ctx);
  if (!inc) throw new SenderError('no open incident');
  const prev = [...ctx.db.checkin.incidentId.filter(inc.id)].find((c) => c.member.isEqual(ctx.sender));
  if (prev) ctx.db.checkin.id.update({ ...prev, state, at: ctx.timestamp });
  else ctx.db.checkin.insert({ id: 0n, incidentId: inc.id, member: ctx.sender, state, at: ctx.timestamp });
  appendAudit(ctx, 'checkin', { incidentId: inc.id, state });
});
