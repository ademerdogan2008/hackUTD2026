// Task severity is encoded in the playbook step's `order` band so no schema migration is needed:
//   100-199 critical (do now), 200-299 high (first hour), 300+ normal.
export type Severity = 'critical' | 'high' | 'normal';

export const SEVERITY_BAND: Record<Severity, number> = { critical: 100, high: 200, normal: 300 };
export const SEVERITY_LABEL: Record<Severity, string> = { critical: 'Critical', high: 'High', normal: 'Normal' };

export function severityOf(order: number): Severity {
  if (order < SEVERITY_BAND.high) return 'critical';
  if (order < SEVERITY_BAND.normal) return 'high';
  return 'normal';
}

