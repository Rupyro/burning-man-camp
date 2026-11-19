// Exodus (plan Phase 8): who leaves when, and whether enough people stay for the final sweep.
// Pure rules, no database.

export interface Departure {
  name: string;
  /** Camp-time day, YYYY-MM-DD. */
  day: string;
  staysForSweep: boolean;
}

/** Departures grouped by day, in day order. */
export function byDay<T extends Departure>(rows: readonly T[]): { day: string; rows: T[] }[] {
  const map = new Map<string, T[]>();
  for (const r of [...rows].sort((a, b) => a.day.localeCompare(b.day))) {
    map.set(r.day, [...(map.get(r.day) ?? []), r]);
  }
  return [...map].map(([day, rows]) => ({ day, rows }));
}

/** Sweep crew wanted: one in ten of the camp, never fewer than two. */
export function sweepCrewWanted(campSize: number): number {
  return Math.max(2, Math.ceil(campSize / 10));
}

/** How the sweep crew stands: who's staying, how many are wanted, how many are missing. */
export function sweepCrew(rows: readonly Departure[], campSize: number) {
  const staying = rows.filter((r) => r.staysForSweep).map((r) => r.name);
  const wanted = sweepCrewWanted(campSize);
  return { staying, wanted, short: Math.max(0, wanted - staying.length) };
}
