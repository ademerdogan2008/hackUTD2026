// Display helpers for Jev triage rows and tripwire hits.

const TYPE_LABEL: Record<string, string> = {
  exfiltration: 'Exfiltration',
  credential_theft: 'Credential theft',
  ransomware: 'Ransomware',
  false_positive: 'False positive',
};

/** "credential_theft" -> "Credential theft"; empty -> "Type pending". */
export function attackTypeLabel(t: string): string {
  if (!t) return 'Type pending';
  return TYPE_LABEL[t] ?? t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ');
}

/** "Jev · 92% likely exfiltration" */
export function jevHeadline(probability: number, incidentType: string): string {
  return `Jev · ${probability}% likely ${attackTypeLabel(incidentType).toLowerCase()}`;
}

const PAGE_ROLE: Record<string, string> = {
  it: 'IT',
  lead: 'Lead',
  counsel: 'Counsel',
  comms: 'Comms',
  executive: 'Executive',
  finance: 'Finance',
};

/** "it,lead,counsel" -> "IT, Lead, Counsel" */
export function pageLabel(page: string): string {
  return page
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => PAGE_ROLE[r] ?? r)
    .join(', ');
}

export function evidenceLines(evidence: string): string[] {
  return evidence
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export function localTime(at: { toDate(): Date }): string {
  try {
    return at.toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** Splits a Jev task detail "Do X. Evidence: Y" into its action and cited evidence. */
export function splitEvidence(detail: string): { action: string; evidence?: string } {
  const i = detail.lastIndexOf(' Evidence: ');
  if (i < 0) return { action: detail };
  return { action: detail.slice(0, i), evidence: detail.slice(i + ' Evidence: '.length) };
}

/** Splits a task action into its "why" line and its "- " substeps (plain-language how-to). */
export function parseSteps(action: string): { why: string; steps: string[] } {
  const lines = action.split('\n').map((l) => l.trim()).filter(Boolean);
  const steps = lines.filter((l) => l.startsWith('- ')).map((l) => l.slice(2));
  const why = lines.filter((l) => !l.startsWith('- ')).join(' ');
  return { why, steps };
}
