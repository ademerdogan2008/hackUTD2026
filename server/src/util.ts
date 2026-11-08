import { SenderError, type InferSchema, type ReducerCtx } from 'spacetimedb/server';
import { Timestamp } from 'spacetimedb';
import { auditDataHash, auditHash, GENESIS } from '@redphone/shared';
import type spacetimedb from './schema';

export type Ctx = ReducerCtx<InferSchema<typeof spacetimedb>>;

export const MIN = 60n * 1_000_000n;
export const HOUR = 60n * MIN;
export const DAY = 24n * HOUR;

export const plus = (ts: Timestamp, micros: bigint) => new Timestamp(ts.microsSinceUnixEpoch + micros);

export const OPEN_STATUSES = ['possible', 'active', 'contained', 'recovered'];

export function appendAudit(ctx: Ctx, action: string, fields: Record<string, string | number | bigint | boolean> = {}) {
  const head = ctx.db.auditHead.id.find(0);
  const prevHash = head?.hash ?? GENESIS;
  const seq = (head?.seq ?? 0n) + 1n;
  const dataHash = auditDataHash(fields);
  const hash = auditHash({
    seq,
    atMicros: ctx.timestamp.microsSinceUnixEpoch,
    actorHex: ctx.sender.toHexString(),
    action,
    dataHash,
    prevHash,
  });
  ctx.db.auditLog.insert({ seq, at: ctx.timestamp, actor: ctx.sender, action, dataHash, prevHash, hash });
  if (head) ctx.db.auditHead.id.update({ id: 0, seq, hash });
  else ctx.db.auditHead.insert({ id: 0, seq, hash });
}

export function requireMember(ctx: Ctx) {
  const m = ctx.db.member.identity.find(ctx.sender);
  if (!m) throw new SenderError('not a member');
  return m;
}

export const isStaff = (role: string) => role === 'lead' || role === 'admin';

/** A new member picks up the current incident's unassigned tasks for their role. */
export function claimUnassignedTasks(ctx: Ctx, member: { identity: { toHexString(): string }; name: string; role: string }) {
  const inc = currentIncident(ctx);
  if (!inc) return;
  for (const tk of [...ctx.db.task.incidentId.filter(inc.id)]) {
    if (tk.assignedTo || tk.role !== member.role || tk.status === 'done') continue;
    ctx.db.task.id.update({ ...tk, assignedTo: member.identity.toHexString(), assignedName: member.name, updatedAt: ctx.timestamp });
  }
}

export function requireStaff(ctx: Ctx) {
  const m = requireMember(ctx);
  if (!isStaff(m.role)) throw new SenderError('lead or admin only');
  return m;
}

export function currentIncident(ctx: Ctx) {
  let best;
  for (const i of ctx.db.incident.iter()) {
    if (OPEN_STATUSES.includes(i.status) && (!best || i.id > best.id)) best = i;
  }
  return best;
}

export function setIncidentStatus(ctx: Ctx, inc: NonNullable<ReturnType<typeof currentIncident>>, patch: Partial<typeof inc>) {
  ctx.db.incident.id.update({ ...inc, ...patch, updatedAt: ctx.timestamp });
}
