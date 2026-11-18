// Pure: the small lead toolset in the Burn pack (Burn Mode, Oct 28 2026): shift gaps and handovers.

interface Slot {
  id: string;
  startsAt: Date;
  endsAt: Date;
  dutyName: string;
  category: string;
  minStaff: number;
  liveCount: number;
}

/** Upcoming shifts still short of their minimum, soonest first. */
export function shiftGaps<S extends Slot>(slots: readonly S[], now: Date, limit = 5) {
  return slots
    .filter((s) => s.endsAt > now && s.liveCount < s.minStaff)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .slice(0, limit)
    .map((s) => ({ ...s, short: s.minStaff - s.liveCount }));
}

const HANDOVER_GAP_MS = 12 * 3_600_000;

/** Where one crew hands over to the next in the same area (next shift starts within 12 h). */
export function handovers<S extends Slot>(slots: readonly S[], now: Date, limit = 3) {
  const byStart = [...slots].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const out: { from: S; to: S }[] = [];
  for (const from of byStart) {
    if (from.endsAt <= now) continue;
    const to = byStart.find(
      (s) =>
        s.id !== from.id &&
        s.category === from.category &&
        s.startsAt >= from.endsAt &&
        s.startsAt.getTime() - from.endsAt.getTime() <= HANDOVER_GAP_MS,
    );
    if (to) out.push({ from, to });
    if (out.length === limit) break;
  }
  return out;
}
