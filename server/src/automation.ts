// Emulated one-tap containment for Jev's IT tasks. Nothing here touches a real system: each run writes
// the steps a real integration (EDR, directory, firewall, SIEM, backup console) would perform, marks the
// task done, posts the result to the team chat and updates the board, so the demo shows "success".
import { SenderError, t } from 'spacetimedb/server';
import spacetimedb from './schema';
import type { AutoKind } from './jev';
import { automationPlan, type AutoParams } from './automation-plan';
import { finishTask, loadTask } from './task-helpers';
import { appendAudit, requireMember, type Ctx } from './util';

export const runAutomation = spacetimedb.reducer({ taskId: t.u64() }, (ctx, { taskId }) => {
  const me = requireMember(ctx);
  const tk = loadTask(ctx, taskId);
  if (tk.status === 'done' || tk.status === 'locked') throw new SenderError('task not actionable');
  const run = ctx.db.automationRun.taskId.find(taskId);
  if (!run) throw new SenderError('this step cannot be automated');
  if (run.status !== 'ready') throw new SenderError('already ran');
  const params = JSON.parse(run.params) as AutoParams;
  const plan = automationPlan(run.kind as AutoKind, params);
  const log = [...plan.lines.map((l) => `ok: ${l}`), ...(plan.manual ? [`todo: ${plan.manual}`] : [])].join('\n');
  ctx.db.automationRun.id.update({ ...run, status: 'succeeded', log, ranBy: me.name, at: ctx.timestamp });

  if (plan.asset) {
    const rows = new Set(params.rows.split(',').filter(Boolean));
    for (const a of [...ctx.db.asset.iter()]) {
      if (rows.has(a.name) && a.status === 'attacker_active') {
        ctx.db.asset.id.update({ ...a, status: plan.asset, setBy: 'automation', updatedAt: ctx.timestamp });
      }
    }
  }
  ctx.db.message.insert({
    id: 0n, incidentId: tk.incidentId, channel: 'all', author: ctx.sender, authorName: me.name,
    body: `${plan.chat} (run by ${me.name})`, at: ctx.timestamp,
  });
  finishTask(ctx, tk);
  appendAudit(ctx, 'automation.run', { taskId, kind: run.kind });
});
