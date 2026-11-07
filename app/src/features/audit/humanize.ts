const LABELS: Record<string, string> = {
  'member.bootstrap': 'Admin enrolled',
  'member.join': 'Member joined',
  'invite.create': 'Invite created',
  'chat.send': 'Message sent',
  'alert.report': 'Alert reported',
  'alert.raise': 'Alert raised',
  'alert.confirm': 'Alert confirmed',
  'alert.dismiss': 'Alert dismissed',
  'incident.advance': 'Incident advanced',
  'incident.attack_type': 'Attack type set',
  'asset.status': 'Asset status changed',
  'clock.filed': 'Clock marked filed',
  'task.accept': 'Task accepted',
  'task.complete': 'Task completed',
  checkin: 'Check-in',
  'demo.reset': 'Demo reset',
};

export function humanizeAction(a: string): string {
  if (LABELS[a]) return LABELS[a];
  const s = a.replace(/[._]/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
