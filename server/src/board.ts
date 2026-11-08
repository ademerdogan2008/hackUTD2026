import { SenderError, t } from 'spacetimedb/server';
import spacetimedb from './schema';
import { appendAudit, currentIncident, DAY, HOUR, plus, requireMember, type Ctx } from './util';

const ASSET_STATUSES = ['unknown', 'locked', 'stolen', 'contained', 'restored', 'safe'];
const NOTE = 'Possible obligation — confirm with counsel.';

// Texas §521.053 covers sensitive personal information and runs from the breach determination (data acquired = Stolen).
// GDPR Art. 33: loss of availability (encryption = Locked) is itself a personal data breach, so 72h can start on Locked.
function startClocks(ctx: Ctx, incidentId: bigint, assetName: string, regions: string, status: string) {
  const have = new Set([...ctx.db.clock.incidentId.filter(incidentId)].map((c) => c.name));
  const regs = regions.split(',').map((r) => r.trim());
  const defs: [string, bigint][] = [];
  if (regs.includes('TX') && status === 'stolen') {
    defs.push(['Texas AG notice (30 days)', 30n * DAY], ['Texas individuals notice (60 days)', 60n * DAY]);
  }
  if (regs.includes('EU')) defs.push(['GDPR supervisory authority (72 hours)', 72n * HOUR]);
  for (const [name, dur] of defs) {
    if (have.has(name)) continue;
    ctx.db.clock.insert({
      id: 0n, incidentId, name, startedAt: ctx.timestamp, deadlineAt: plus(ctx.timestamp, dur),
      note: `${NOTE} Triggered by ${assetName} (${status === 'stolen' ? 'data stolen' : 'data encrypted'}).`, status: 'running',
    });
  }
}

export const setAssetStatus = spacetimedb.reducer(
  { assetId: t.u64(), status: t.string() },
  (ctx, { assetId, status }) => {
    const me = requireMember(ctx);
    if (!ASSET_STATUSES.includes(status)) throw new SenderError('bad status');
    const a = ctx.db.asset.id.find(assetId);
    if (!a) throw new SenderError('no such asset');
    ctx.db.asset.id.update({ ...a, status, setBy: me.name, updatedAt: ctx.timestamp });
    const inc = currentIncident(ctx);
    if ((status === 'stolen' || status === 'locked') && a.hasPii && inc && inc.status === 'active') {
      startClocks(ctx, inc.id, a.name, a.regions, status);
    }
    appendAudit(ctx, 'asset.status', { assetId, status });
  },
);

export const markClockFiled = spacetimedb.reducer({ clockId: t.u64() }, (ctx, { clockId }) => {
  const me = requireMember(ctx);
  if (me.role !== 'counsel' && me.role !== 'lead' && me.role !== 'admin') throw new SenderError('counsel, lead or admin only');
  const c = ctx.db.clock.id.find(clockId);
  if (!c) throw new SenderError('no such clock');
  ctx.db.clock.id.update({ ...c, status: 'filed' });
  appendAudit(ctx, 'clock.filed', { clockId });
});
