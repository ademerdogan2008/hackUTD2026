import { SenderError, t } from 'spacetimedb/server';
import spacetimedb from './schema';
import { ensureSeed } from './seed';
import { appendAudit, currentIncident, requireMember, requireStaff, setIncidentStatus } from './util';
import { finishTask, loadTask } from './task-helpers';

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


export const acceptTask = spacetimedb.reducer({ taskId: t.u64() }, (ctx, { taskId }) => {
  const tk = loadTask(ctx, taskId);
  if (tk.status !== 'open') throw new SenderError('task not open');
  ctx.db.task.id.update({ ...tk, status: 'accepted', updatedAt: ctx.timestamp });
  appendAudit(ctx, 'task.accept', { taskId });
});

export const completeTask = spacetimedb.reducer({ taskId: t.u64() }, (ctx, { taskId }) => {
  const tk = loadTask(ctx, taskId);
  if (tk.status !== 'open' && tk.status !== 'accepted') throw new SenderError('task not actionable');
  finishTask(ctx, tk);
  appendAudit(ctx, 'task.complete', { taskId });
});

/** "I'm stuck": posts a help request to the all-hands chat so IT or the lead can step in. */
export const askForHelp = spacetimedb.reducer({ taskId: t.u64() }, (ctx, { taskId }) => {
  const tk = loadTask(ctx, taskId);
  if (tk.status === 'done') throw new SenderError('task already done');
  const me = requireMember(ctx);
  ctx.db.message.insert({
    id: 0n, incidentId: tk.incidentId, channel: 'all', author: ctx.sender, authorName: me.name,
    body: `I'm stuck on "${tk.title}" and need help. Can someone call me?`, at: ctx.timestamp,
  });
  appendAudit(ctx, 'task.help', { taskId });
});
