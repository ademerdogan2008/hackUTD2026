import { SenderError, t } from 'spacetimedb/server';
import spacetimedb from './schema';
import { ensureSeed } from './seed';
import { appendAudit, currentIncident, isStaff, requireMember, requireStaff, setIncidentStatus, type Ctx } from './util';

export const setAttackType = spacetimedb.reducer({ attackType: t.string() }, (ctx, { attackType }) => {
  const me = requireStaff(ctx);
  const inc = currentIncident(ctx);
  if (!inc || inc.status !== 'active') throw new SenderError('incident must be active');
  if (inc.attackType) throw new SenderError('attack type already set');
  ensureSeed(ctx); // picks up playbook revisions on already-seeded databases
  const steps = [...ctx.db.playbookStep.iter()]
    .filter((s) => s.attackType === attackType)
    .sort((a, b) => a.order - b.order);
  if (steps.length === 0) throw new SenderError('no playbook for that attack type');
  const members = [...ctx.db.member.iter()].sort((a, b) =>
    a.joinedAt.microsSinceUnixEpoch < b.joinedAt.microsSinceUnixEpoch ? -1 : 1,
  );
  for (const s of steps) {
    const assignee = members.find((m) => m.role === s.role) ?? me;
    ctx.db.task.insert({
      id: 0n, incidentId: inc.id, stepId: s.id, role: s.role,
      assignedTo: assignee.identity.toHexString(), assignedName: assignee.name,
      status: s.dependsOn === 0n ? 'open' : 'locked',
      title: s.title, detail: s.detail, updatedAt: ctx.timestamp,
    });
  }
  setIncidentStatus(ctx, inc, { attackType });
  appendAudit(ctx, 'incident.attack_type', { incidentId: inc.id, attackType });
});

function loadTask(ctx: Ctx, taskId: bigint) {
  const me = requireMember(ctx);
  const tk = ctx.db.task.id.find(taskId);
  if (!tk) throw new SenderError('no such task');
  if (tk.assignedTo !== ctx.sender.toHexString() && !isStaff(me.role)) throw new SenderError('not your task');
  return tk;
}

export const acceptTask = spacetimedb.reducer({ taskId: t.u64() }, (ctx, { taskId }) => {
  const tk = loadTask(ctx, taskId);
  if (tk.status !== 'open') throw new SenderError('task not open');
  ctx.db.task.id.update({ ...tk, status: 'accepted', updatedAt: ctx.timestamp });
  appendAudit(ctx, 'task.accept', { taskId });
});

export const completeTask = spacetimedb.reducer({ taskId: t.u64() }, (ctx, { taskId }) => {
  const tk = loadTask(ctx, taskId);
  if (tk.status !== 'open' && tk.status !== 'accepted') throw new SenderError('task not actionable');
  ctx.db.task.id.update({ ...tk, status: 'done', updatedAt: ctx.timestamp });
  for (const other of [...ctx.db.task.incidentId.filter(tk.incidentId)]) {
    if (other.status !== 'locked') continue;
    const step = ctx.db.playbookStep.id.find(other.stepId);
    if (step && step.dependsOn === tk.stepId) {
      ctx.db.task.id.update({ ...other, status: 'open', updatedAt: ctx.timestamp });
    }
  }
  appendAudit(ctx, 'task.complete', { taskId });
});
