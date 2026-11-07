import { SenderError, t } from 'spacetimedb/server';
import spacetimedb, { message } from './schema';
import { appendAudit, currentIncident, requireMember } from './util';

const COUNSEL_ROLES = ['counsel', 'lead', 'admin'];

export const sendMessage = spacetimedb.reducer(
  { channel: t.string(), body: t.string() },
  (ctx, { channel, body }) => {
    const me = requireMember(ctx);
    if (channel !== 'all' && channel !== 'counsel') throw new SenderError('bad channel');
    if (channel === 'counsel' && !COUNSEL_ROLES.includes(me.role)) throw new SenderError('counsel channel restricted');
    const text = body.trim();
    if (text.length < 1 || text.length > 1000) throw new SenderError('message must be 1..1000 chars');
    const inc = currentIncident(ctx);
    ctx.db.message.insert({
      id: 0n, incidentId: inc?.id ?? 0n, channel, author: ctx.sender, authorName: me.name, body: text, at: ctx.timestamp,
    });
    appendAudit(ctx, 'chat.send', { channel });
  },
);

export const allMessages = spacetimedb.view(
  { name: 'all_messages', public: true },
  t.array(message.rowType),
  (ctx) => (ctx.db.member.identity.find(ctx.sender) ? [...ctx.db.message.channel.filter('all')] : []),
);

export const counselMessages = spacetimedb.view(
  { name: 'counsel_messages', public: true },
  t.array(message.rowType),
  (ctx) => {
    const m = ctx.db.member.identity.find(ctx.sender);
    return m && COUNSEL_ROLES.includes(m.role) ? [...ctx.db.message.channel.filter('counsel')] : [];
  },
);
