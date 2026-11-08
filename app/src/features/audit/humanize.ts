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
  'task.help': 'Help requested on a task',
  'automation.run': 'Containment step automated',
  checkin: 'Check-in',
  'demo.reset': 'Demo reset',
  'tripwire.plant': 'Tripwire planted',
  'tripwire.hit': 'Tripwire triggered',
  'tripwire.reset': 'Tripwires reset',
  'jev.triage': 'Jev assessed a hit',
  'jev.auto_open': 'Jev opened the incident',
  'jev.confirm': 'Jev finding confirmed',
  'jev.dismiss': 'Jev finding dismissed',
};

export function humanizeAction(a: string): string {
  if (LABELS[a]) return LABELS[a];
  if (a.startsWith('tripwire.')) return `Tripwire ${a.slice(9).replace(/_/g, ' ')}`;
  if (a.startsWith('jev.')) return `Jev ${a.slice(4).replace(/_/g, ' ')}`;
  const s = a.replace(/[._]/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
