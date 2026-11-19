// Sound plan and neighbor log (plan Phase 6, Sound pack). Pure rules, no database.

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isClockTime(s: string): boolean {
  return HHMM.test(s);
}

const minutes = (s: string) => {
  const m = HHMM.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : Number.NaN;
};

/** Whether `time` (HH:MM) falls in the quiet window, which may run past midnight. */
export function inQuietHours(time: string, from: string, until: string): boolean {
  const t = minutes(time);
  const a = minutes(from);
  const b = minutes(until);
  if ([t, a, b].some(Number.isNaN) || a === b) return false;
  return a < b ? t >= a && t < b : t >= a || t < b;
}

export interface LogEntry {
  neighbor: string;
  at: Date;
}

/** Visits and complaints per neighbor, most first, for the sound officer's summary. */
export function byNeighbor(entries: readonly LogEntry[]): { neighbor: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    const k = e.neighbor.trim();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts]
    .map(([neighbor, count]) => ({ neighbor, count }))
    .sort((x, y) => y.count - x.count || x.neighbor.localeCompare(y.neighbor));
}
