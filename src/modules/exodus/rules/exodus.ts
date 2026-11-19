// Exodus (plan Phase 8): who leaves when, and whether enough people stay for the final sweep.
// Pure rules, no database. The sweep-crew numbers come from camp.config.ts.
import { SWEEP_CREW_RULE } from "@/lib/camp";

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

export interface SweepRule {
  min: number;
  perCampers: number;
}

/**
 * Sweep crew wanted: max(min, ceil(campSize / perCampers)). The rule comes from camp.config.ts
 * (exodus.sweepCrew) and is a placeholder, by default max(2, ceil(campers / 10)).
 */
export function sweepCrewWanted(campSize: number, rule: SweepRule = SWEEP_CREW_RULE): number {
  return Math.max(rule.min, Math.ceil(campSize / rule.perCampers));
}

/** How the sweep crew stands: who's staying, how many are wanted, how many are missing. */
export function sweepCrew(
  rows: readonly Departure[],
  campSize: number,
  rule: SweepRule = SWEEP_CREW_RULE,
) {
  const staying = rows.filter((r) => r.staysForSweep).map((r) => r.name);
  const wanted = sweepCrewWanted(campSize, rule);
  return { staying, wanted, short: Math.max(0, wanted - staying.length) };
}
