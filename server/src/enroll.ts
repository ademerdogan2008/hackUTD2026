import { SenderError, t } from 'spacetimedb/server';
import { canInvite, fingerprint, isRole, joinMessage, sha256Hex, verifyJoin, type Role } from '@redphone/shared';
import spacetimedb from './schema';
import { appendAudit, MIN, plus, requireMember } from './util';
import { ensureSeed } from './seed';

const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;

function cleanName(name: string): string {
  const n = name.trim();
  if (n.length < 1 || n.length > 40) throw new SenderError('name must be 1..40 chars');
  return n;
}

export const init = spacetimedb.init((ctx) => {
  ensureSeed(ctx);
});

export const bootstrapAdmin = spacetimedb.reducer(
  { name: t.string(), pubkeyHex: t.string() },
  (ctx, { name, pubkeyHex }) => {
    if (ctx.db.member.count() > 0n) throw new SenderError('already bootstrapped');
    if (!HEX64.test(pubkeyHex)) throw new SenderError('bad pubkey');
    ctx.db.member.insert({
      identity: ctx.sender, name: cleanName(name), role: 'admin', pubkeyHex,
      fingerprint: fingerprint(pubkeyHex), invitedBy: '', joinedAt: ctx.timestamp,
    });
    ensureSeed(ctx);
    appendAudit(ctx, 'member.bootstrap', { pubkeyHex });
  },
);

export const createInvite = spacetimedb.reducer(
  { role: t.string(), name: t.string(), secretHash: t.string() },
  (ctx, { role, name, secretHash }) => {
    const me = requireMember(ctx);
    if (!isRole(role) || !isRole(me.role) || !canInvite(me.role, role as Role)) {
      throw new SenderError('not allowed to invite that role');
    }
    if (!HEX64.test(secretHash)) throw new SenderError('bad secret hash');
    if (ctx.db.invite.secretHash.find(secretHash)) throw new SenderError('duplicate invite');
    ctx.db.invite.insert({
      id: 0n, secretHash, role, name: cleanName(name), createdBy: ctx.sender,
      expiresAt: plus(ctx.timestamp, 10n * MIN), used: false,
    });
    appendAudit(ctx, 'invite.create', { role, secretHash });
  },
);

export const redeemInvite = spacetimedb.reducer(
  { secretHex: t.string(), pubkeyHex: t.string(), sigHex: t.string() },
  (ctx, { secretHex, pubkeyHex, sigHex }) => {
    if (secretHex.length > 128 || !HEX64.test(pubkeyHex) || !HEX128.test(sigHex)) {
      throw new SenderError('bad input');
    }
    if (ctx.db.member.identity.find(ctx.sender)) throw new SenderError('already a member');
    const secretHash = sha256Hex(secretHex);
    const inv = ctx.db.invite.secretHash.find(secretHash);
    if (!inv) throw new SenderError('invalid invite');
    if (inv.used) throw new SenderError('invite already used');
    if (inv.expiresAt.microsSinceUnixEpoch <= ctx.timestamp.microsSinceUnixEpoch) {
      throw new SenderError('invite expired');
    }
    if (!verifyJoin(pubkeyHex, joinMessage(secretHash, ctx.sender.toHexString()), sigHex)) {
      throw new SenderError('bad signature');
    }
    ctx.db.invite.id.update({ ...inv, used: true });
    ctx.db.member.insert({
      identity: ctx.sender, name: inv.name, role: inv.role, pubkeyHex,
      fingerprint: fingerprint(pubkeyHex), invitedBy: inv.createdBy.toHexString(), joinedAt: ctx.timestamp,
    });
    appendAudit(ctx, 'member.join', { role: inv.role, inviteId: inv.id, pubkeyHex });
  },
);
