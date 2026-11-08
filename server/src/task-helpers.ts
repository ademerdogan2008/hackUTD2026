import { SenderError } from 'spacetimedb/server';
import { isStaff, requireMember, type Ctx } from './util';

export function loadTask(ctx: Ctx, taskId: bigint) {
  const me = requireMember(ctx);
  const tk = ctx.db.task.id.find(taskId);
  if (!tk) throw new SenderError('no such task');
  if (tk.assignedTo !== ctx.sender.toHexString() && !isStaff(me.role)) throw new SenderError('not your task');
  return tk;
}

/** Mark a task done and unlock playbook steps that were waiting on it. */
export function finishTask(ctx: Ctx, tk: NonNullable<ReturnType<typeof ctx.db.task.id.find>>) {
  ctx.db.task.id.update({ ...tk, status: 'done', updatedAt: ctx.timestamp });
  for (const other of tk.stepId === 0n ? [] : [...ctx.db.task.incidentId.filter(tk.incidentId)]) {
    if (other.status !== 'locked' || other.stepId === 0n) continue;
    const step = ctx.db.playbookStep.id.find(other.stepId);
    if (step && step.dependsOn === tk.stepId) {
      ctx.db.task.id.update({ ...other, status: 'open', updatedAt: ctx.timestamp });
    }
  }
}
