import spacetimedb from './schema';
import { ensureSeed } from './seed';
import { appendAudit, requireMember } from './util';

/** Any member can reset the demo (hackathon convenience). */
export const resetDemo = spacetimedb.reducer((ctx) => {
  requireMember(ctx);
  for (const r of [...ctx.db.incident.iter()]) ctx.db.incident.id.delete(r.id);
  for (const r of [...ctx.db.alertReport.iter()]) ctx.db.alertReport.id.delete(r.id);
  for (const r of [...ctx.db.checkin.iter()]) ctx.db.checkin.id.delete(r.id);
  for (const r of [...ctx.db.task.iter()]) ctx.db.task.id.delete(r.id);
  for (const r of [...ctx.db.clock.iter()]) ctx.db.clock.id.delete(r.id);
  for (const r of [...ctx.db.message.iter()]) ctx.db.message.id.delete(r.id);
  for (const r of [...ctx.db.tripwireHit.iter()]) ctx.db.tripwireHit.id.delete(r.id);
  for (const r of [...ctx.db.jevTriage.iter()]) ctx.db.jevTriage.id.delete(r.id);
  for (const r of [...ctx.db.automationRun.iter()]) ctx.db.automationRun.id.delete(r.id);
  for (const a of [...ctx.db.asset.iter()]) {
    ctx.db.asset.id.update({ ...a, status: 'unknown', setBy: '', updatedAt: ctx.timestamp });
  }
  ensureSeed(ctx);
  appendAudit(ctx, 'demo.reset');
});
