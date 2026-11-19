// Mutant vehicle drivers (plan Phase 7): who offers to drive the camp's art car, and who the
// DMV contact has cleared. Pure rules.

export interface DriverLine {
  name: string;
  cleared: boolean;
}

/** Cleared drivers first, then by name; and how many are cleared. */
export function driverRoster<T extends DriverLine>(rows: readonly T[]) {
  const sorted = [...rows].sort(
    (a, b) => Number(b.cleared) - Number(a.cleared) || a.name.localeCompare(b.name),
  );
  return { sorted, cleared: rows.filter((r) => r.cleared).length };
}
