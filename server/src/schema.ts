import { schema, table, t } from 'spacetimedb/server';

export const member = table(
  { name: 'member', public: true },
  {
    identity: t.identity().primaryKey(),
    name: t.string(),
    role: t.string(),
    pubkeyHex: t.string(),
    fingerprint: t.string(),
    invitedBy: t.string(),
    joinedAt: t.timestamp(),
  },
);

export const invite = table(
  { name: 'invite', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    secretHash: t.string().unique(),
    role: t.string(),
    name: t.string(),
    createdBy: t.identity(),
    expiresAt: t.timestamp(),
    used: t.bool(),
  },
);

export const incident = table(
  { name: 'incident', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    status: t.string(),
    attackType: t.string(),
    isDrill: t.bool(),
    raisedBy: t.identity(),
    confirmedBy: t.string(),
    createdAt: t.timestamp(),
    updatedAt: t.timestamp(),
  },
);

export const alertReport = table(
  { name: 'alert_report', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    incidentId: t.u64().index('btree'),
    reporter: t.identity(),
    at: t.timestamp(),
  },
);

export const checkin = table(
  { name: 'checkin', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    incidentId: t.u64().index('btree'),
    member: t.identity(),
    state: t.string(),
    at: t.timestamp(),
  },
);

export const playbookStep = table(
  { name: 'playbook_step', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    attackType: t.string(),
    order: t.u32(),
    role: t.string(),
    title: t.string(),
    detail: t.string(),
    dependsOn: t.u64(),
  },
);

export const task = table(
  { name: 'task', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    incidentId: t.u64().index('btree'),
    stepId: t.u64(),
    role: t.string(),
    assignedTo: t.string(),
    assignedName: t.string(),
    status: t.string(),
    title: t.string(),
    detail: t.string(),
    updatedAt: t.timestamp(),
  },
);

export const asset = table(
  { name: 'asset', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    name: t.string(),
    hasPii: t.bool(),
    regions: t.string(),
    status: t.string(),
    setBy: t.string(),
    updatedAt: t.timestamp(),
  },
);

export const clock = table(
  { name: 'clock', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    incidentId: t.u64().index('btree'),
    name: t.string(),
    startedAt: t.timestamp(),
    deadlineAt: t.timestamp(),
    note: t.string(),
    status: t.string(),
  },
);

// Private: clients read through all_messages / counsel_messages views.
export const message = table(
  { name: 'message' },
  {
    id: t.u64().primaryKey().autoInc(),
    incidentId: t.u64(),
    channel: t.string().index('btree'),
    author: t.identity(),
    authorName: t.string(),
    body: t.string(),
    at: t.timestamp(),
  },
);

export const auditLog = table(
  { name: 'audit_log', public: true },
  {
    seq: t.u64().primaryKey(),
    at: t.timestamp(),
    actor: t.identity(),
    action: t.string(),
    dataHash: t.string(),
    prevHash: t.string(),
    hash: t.string(),
  },
);

export const auditHead = table(
  { name: 'audit_head' },
  {
    id: t.u32().primaryKey(),
    seq: t.u64(),
    hash: t.string(),
  },
);

// Private: decoy registry. tokenHash is sha256 of the decoy's embedded token.
export const tripwire = table(
  { name: 'tripwire' },
  {
    id: t.string().primaryKey(),
    label: t.string(),
    kind: t.string(),
    assetId: t.string(),
    fileName: t.string(),
    tokenHash: t.string().unique(),
    active: t.bool(),
    plantedAt: t.timestamp(),
  },
);

// Private: the one identity allowed to report tripwire hits.
export const tripwireConfig = table(
  { name: 'tripwire_config' },
  {
    id: t.u32().primaryKey(),
    relayHex: t.string(),
  },
);

export const tripwireHit = table(
  { name: 'tripwire_hit', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    tripwireId: t.string(),
    label: t.string(),
    fileName: t.string(),
    assetId: t.string(),
    systemName: t.string(),
    hitKind: t.string(),
    sourceIp: t.string(),
    userAgent: t.string(),
    at: t.timestamp(),
    triageId: t.u64(),
  },
);

export const jevTriage = table(
  { name: 'jev_triage', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    hitId: t.u64(),
    incidentId: t.u64(),
    probability: t.u32(),
    incidentType: t.string(),
    scope: t.string(),
    page: t.string(),
    tier: t.string(),
    evidence: t.string(),
    decision: t.string(),
    reviewer: t.string(),
    decidedBy: t.string(),
    at: t.timestamp(),
  },
);

// One row per automatable task. status: 'ready' until someone runs it, then 'succeeded'.
// Runs are emulated (no real systems are touched); log is newline-separated step results.
export const automationRun = table(
  { name: 'automation_run', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    taskId: t.u64().unique(),
    incidentId: t.u64().index('btree'),
    kind: t.string(),
    params: t.string(),
    status: t.string(),
    log: t.string(),
    ranBy: t.string(),
    at: t.timestamp(),
  },
);

const spacetimedb = schema({
  member, invite, incident, alertReport, checkin, playbookStep, task, asset, clock, message, auditLog, auditHead,
  tripwire, tripwireConfig, tripwireHit, jevTriage, automationRun,
});
export default spacetimedb;
